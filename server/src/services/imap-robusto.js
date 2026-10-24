// Motor IMAP robusto — lecciones aprendidas el 14-15/10/2026 con Gmail:
//
// 1. NUNCA pedir de golpe la estructura de muchos mensajes: Gmail responde
//    bien a trozos de ≤8 y se atasca (socket timeout) con listas largas,
//    aunque el mismo trabajo a trozos pase sin problema.
// 2. Cuando Gmail se satura, reconectar enseguida NO ayuda: hay que esperar
//    entre intentos (30s, 60s, 120s...) y, si un buzón falla varias veces
//    seguidas, no volver a tocarlo en un buen rato (backoff por buzón).
// 3. Cada mensaje procesado se persiste en el momento: una pasada que se
//    rompe a mitad se reanuda sin repetir trabajo.
// 4. Los fallos de conexión no deben tirar el proceso (listener "error"
//    controlado en el cliente).
//
// Este módulo es compartido por la recogida de campañas de energía y por la
// lectura de facturas "Del correo", para cualquier cliente/tenant.
import { ImapFlow } from "imapflow";

const TROZO = 8; // mensajes por comando FETCH (ver lección 1)
const MAX_INTENTOS = 3; // intentos por trozo antes de rendirse
const ESPERA_BASE_MS = 30_000; // primer backoff; luego 60s, 90s...

// Si porMensaje devuelve este símbolo, la pasada termina en orden: ya no
// hace falta seguir (p. ej. "ya tengo los N mensajes que pedían").
export const DETENER = Symbol("imap-robusto.detener");

// Conexión IMAP con los timeouts ya ajustados. Sin el listener "error", un
// timeout de socket emitiría "error" sin oyentes y Node tiraría todo el
// proceso (afecta a toda la API, no solo al correo).
export function conexionImap(conf, password) {
  const client = new ImapFlow({
    host: conf.host,
    port: Number(conf.puerto) || 993,
    secure: true, // IMAP moderno es siempre TLS (993)
    auth: { user: conf.usuario, pass: password },
    logger: false,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 120000,
  });
  client.on("error", (e) => {
    console.warn("[correo-imap] Error de conexión (controlado):", e?.message || e);
  });
  return client;
}

// Traduce errores IMAP a mensajes entendibles para el usuario final.
export function mensajeErrorEntrante(error, tipo) {
  const codigo = error?.authenticationFailed || error?.code;
  const texto = error?.response || error?.message || "";
  if (tipo === "gmail" && (codigo === "AuthenticationFailed" || /AUTHENTICATIONFAILED/i.test(texto))) {
    return "Gmail ha rechazado el acceso. Activa la verificación en dos pasos, permite IMAP en Gmail y usa una contraseña de aplicación.";
  }
  if (/AuthenticationFailed|INVALID/i.test(texto)) return "El servidor de correo ha rechazado el usuario o la contraseña.";
  if (codigo === "ENOTFOUND" || codigo === "ECONNREFUSED" || codigo === "ETIMEDOUT") {
    return "No se puede conectar con el servidor IMAP. Revisa host, puerto y que el puerto 993 esté abierto.";
  }
  if (/nonexistent|UNKNOWN\]/i.test(texto)) return "La carpeta/etiqueta indicada no existe en el buzón.";
  return texto || "No se pudo conectar con el buzón";
}

// Cierra la conexión sin estallar aunque esté a medias.
export function cerrarSeguro(client) {
  try {
    Promise.resolve(client?.close?.()).catch(() => {});
  } catch { /* ya estaba cerrada */ }
}

async function desconectar(client, lock) {
  try { lock?.release(); } catch { /* nada */ }
  try { await client?.logout(); } catch { /* nada */ }
  cerrarSeguro(client);
}

/**
 * Recorre una lista de UIDs llamando a porMensaje(msg, client) por cada uno,
 * en trozos pequeños y con reconexión + backoff si un trozo falla.
 *
 * La función porMensaje recibe el objeto msg de imapflow (con los campos
 * pedidos en `campos`, p. ej. { envelope: true, bodyStructure: true }) y el
 * propio client (por si necesita operar, p. ej. marcar como leído).
 * Si porMensaje lanza para UN mensaje, se anota el error y se sigue con el
 * siguiente: un correo corrupto no rompe la pasada entera.
 *
 * Devuelve { procesados, errores: [{uid, error}], trozosFallidos }.
 * Lanza Error solo si ni siquiera se pudo conectar o el buzón no existe.
 */
export async function recorrerMensajesRobusto({
  conf,
  password,
  uids,
  campos,
  porMensaje,
  trozo = TROZO,
  maxIntentos = MAX_INTENTOS,
  alReintentar = null, // opcional: (trozoN, intento, error) => void
}) {
  const resumen = { procesados: 0, errores: [], trozosFallidos: 0 };
  if (!uids?.length) return resumen;

  let client = null;
  let lock = null;
  let detener = false;

  const conectar = async () => {
    client = conexionImap(conf, password);
    await client.connect();
    lock = await client.getMailboxLock(conf.carpeta || "INBOX");
  };

  await conectar();

  try {
    for (let i = 0; i < uids.length && !detener; i += trozo) {
      const lote = uids.slice(i, i + trozo);
      let completado = false;

      for (let intento = 1; intento <= maxIntentos && !completado && !detener; intento++) {
        try {
          for await (const msg of client.fetch(lote, campos, { uid: true })) {
            try {
              const r = await porMensaje(msg, client);
              if (r === DETENER) { detener = true; break; }
              resumen.procesados++;
            } catch (e) {
              // Error de UN mensaje (OCR, parseo...): no rompe la pasada.
              resumen.errores.push({ uid: msg.uid, error: e?.message ?? String(e) });
            }
          }
          completado = true;
        } catch (e) {
          const nTrozo = Math.floor(i / trozo) + 1;
          const total = Math.ceil(uids.length / trozo);
          alReintentar?.(nTrozo, total, intento, e);
          if (intento < maxIntentos) {
            // Lección 2: esperar ANTES de reconectar; reconectar en caliente
            // alimenta el bloqueo de Gmail.
            await new Promise((r) => setTimeout(r, ESPERA_BASE_MS * intento));
            await desconectar(client, lock);
            await conectar();
          } else {
            resumen.trozosFallidos++;
          }
        }
      }
    }
  } finally {
    await desconectar(client, lock);
  }

  return resumen;
}

/**
 * Descarga un adjunto concreto de un mensaje, con un reintento de conexión.
 * Pensado para el endpoint de "bajar adjunto" del correo entrante.
 */
export async function descargarAdjuntoRobusto({
  conf,
  password,
  uid,
  part,
  esValido, // (nodo) => boolean, mismo criterio que el listado
  trozoEstructura = null, // opcional: bodyStructure ya conocida
}) {
  let client = null;
  let lock = null;
  try {
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      try {
        client = conexionImap(conf, password);
        await client.connect();
        lock = await client.getMailboxLock(conf.carpeta || "INBOX");

        const estructura = trozoEstructura
          ? { bodyStructure: trozoEstructura }
          : await client.fetchOne(uid, { bodyStructure: true }, { uid: true });

        const nodos = [];
        const recorrer = (nodo) => {
          if (nodo.disposition === "attachment" || nodo.dispositionParameters?.filename || nodo.parameters?.name) {
            nodos.push(nodo);
          }
          (nodo.childNodes ?? []).forEach(recorrer);
        };
        recorrer(estructura?.bodyStructure ?? {});
        const validos = nodos.filter(esValido);
        const nodo = validos[part];
        if (!nodo) {
          const e = new Error("Ese adjunto ya no está en el correo");
          e.status = 404;
          throw e;
        }
        // La parte a bajar: el part id del nodo (p. ej. "2") o su posición.
        const parte = nodo.part || String(nodos.indexOf(nodo) + 1);
        const descarga = await client.download(uid, parte, { uid: true });
        const chunks = [];
        for await (const chunk of descarga.content) chunks.push(chunk);
        return { buffer: Buffer.concat(chunks), nombre: nodo.dispositionParameters?.filename ?? nodo.parameters?.name ?? "adjunto" };
      } catch (e) {
        if (e?.status === 404) throw e; // no es problema de conexión
        if (intento >= MAX_INTENTOS) throw e;
        await new Promise((r) => setTimeout(r, ESPERA_BASE_MS * intento));
      } finally {
        await desconectar(client, lock);
        client = null; lock = null;
      }
    }
    throw new Error("No se pudo descargar el adjunto tras varios intentos");
  } finally {
    await desconectar(client, lock);
  }
}

/**
 * Backoff por buzón: ¿hay que saltarse esta pasada?
 * Gmail bloquea el buzón un rato tras varios fallos seguidos; insistir cada
 * 15 min solo alarga el castigo. Con 3 fallos seguidos se espera 1 hora.
 */
export function buzonEnCastigo(confEntrante, ahora = new Date()) {
  const fallos = Number(confEntrante?.fallosConsecutivos ?? 0);
  if (fallos < 3) return false;
  const ultima = confEntrante?.ultimoIntento ? new Date(confEntrante.ultimoIntento) : null;
  if (!ultima) return false;
  const esperaMs = Math.min(fallos, 6) * 20 * 60 * 1000; // 3 fallos=1h, 4=1h20, ...
  return ahora.getTime() - ultima.getTime() < esperaMs;
}

/**
 * Extrae los adjuntos "válidos" (PDF o imagen) de la estructura de un
 * mensaje, en el mismo formato para listados y descargas.
 */
export function adjuntosValidosDe(bodyStructure, esValido) {
  const nodos = [];
  const recorrer = (nodo) => {
    if (nodo.disposition === "attachment" || nodo.dispositionParameters?.filename || nodo.parameters?.name) {
      nodos.push(nodo);
    }
    (nodo.childNodes ?? []).forEach(recorrer);
  };
  recorrer(bodyStructure ?? {});
  return nodos.filter(esValido);
}
