// Recogida automática de campañas de precios desde el correo (Fase 2).
//
// Las comercializadoras mandan sus campañas de precios por email. Este
// servicio sondea por IMAP el buzón configurado en Energía → Campañas
// (cuenta Gmail con contraseña de aplicación o cualquier IMAP), saca los
// adjuntos (PDF o imagen), los lee con la misma IA que el OCR manual y
// crea las campañas como "pendientes de revisión": nada se publica sin
// que un humano lo confirme.
//
// El sondeo corre para cada empresa (multiempresa) siguiendo el patrón de
// verifactu-reintento.js, y también se puede disparar a mano desde la
// pantalla de campañas ("Revisar ahora").
import { simpleParser } from "mailparser";
import Empresa from "../models/Empresa.js";
import CampanaPrecios from "../models/CampanaPrecios.js";
import Comercializadora from "../models/Comercializadora.js";
import Tenant from "../models/plataforma/Tenant.js";
import { alsEmpresa, conexionTenant } from "../models/tenant.js";
import { extraerCampanaPrecios } from "./ocr-gemini.js";
import { descifrar } from "./cifrado.js";
import {
  recorrerMensajesRobusto,
  buzonEnCastigo,
  conexionImap,
  cerrarSeguro,
  mensajeErrorEntrante,
} from "./imap-robusto.js";

// Re-exportados para mantener los imports existentes (p. ej. routes/correo.js).
export { conexionImap, mensajeErrorEntrante } from "./imap-robusto.js";

// Adjuntos que la IA sabe leer: PDF e imágenes.
const MIME_VALIDOS = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const PESO_MAXIMO = 10 * 1024 * 1024; // 10 MB por adjunto
const MAX_MENSAJES_POR_PASADA = 15; // no ahogar la IA ni el buzón de golpe
const MAX_PROCESADOS = 300; // lista acotada de Message-IDs tratados

const ADECUADOS = [
  "campana", "campañas", "precio", "tarifa", "oferta",
  "comercial", "energia", "energía", "luz", "gas", "pdf",
];
const INADECUADOS = ["factura", "recibo", "pago", "nomin"];

export function configuracionEntrantePublica(empresa) {
  const c = empresa?.correoEntrante ?? {};
  return {
    activo: Boolean(c.activo),
    tipo: c.tipo || "gmail",
    usuario: c.usuario || "",
    host: c.host || "",
    puerto: c.puerto || 993,
    carpeta: c.carpeta || "INBOX",
    passwordGuardada: Boolean(c.passwordCifrada),
    ultimaPasada: c.ultimaPasada || null,
    ultimoError: c.ultimoError || null,
  };
}

export function normalizarConfiguracionEntrante(body = {}, empresa) {
  const tipo = body.tipo === "imap" ? "imap" : "gmail";
  const usuario = String(body.usuario ?? "").trim().toLowerCase().slice(0, 255);
  const host = tipo === "gmail" ? "imap.gmail.com" : String(body.host ?? "").trim().slice(0, 255);
  if (tipo === "imap" && !host) throw new Error("Indica el servidor IMAP del correo");
  if (!usuario) throw new Error("Indica el usuario del correo (la dirección)");
  const puerto = Math.trunc(Number(body.puerto));
  const carpeta = String(body.carpeta ?? "").trim().slice(0, 120) || "INBOX";
  return {
    activo: Boolean(body.activo),
    tipo,
    usuario,
    host,
    puerto: Number.isFinite(puerto) && puerto > 0 && puerto <= 65535 ? puerto : 993,
    carpeta,
    passwordCifrada: empresa?.correoEntrante?.passwordCifrada,
    ultimaPasada: empresa?.correoEntrante?.ultimaPasada,
    ultimoError: empresa?.correoEntrante?.ultimoError,
    procesados: empresa?.correoEntrante?.procesados ?? [],
  };
}

// Comprueba usuario/contraseña/carpeta sin procesar nada. Devuelve el
// número de correos sin leer de la carpeta.
export async function probarCorreoEntrante() {
  const empresa = await Empresa.findOne();
  const conf = empresa?.correoEntrante;
  if (!conf?.usuario || !conf?.passwordCifrada) {
    const e = new Error("Guarda primero el usuario y la contraseña del buzón");
    e.status = 400;
    throw e;
  }
  const client = conexionImap(conf, descifrar(conf.passwordCifrada));
  try {
    await client.connect();
    const mailbox = await client.getMailboxLock(conf.carpeta || "INBOX");
    let sinLeer = 0;
    try {
      sinLeer = mailbox.exists ? await client.status(conf.carpeta || "INBOX", { unseen: true }).then((s) => s.unseen ?? 0) : 0;
    } finally {
      mailbox.release();
    }
    await client.logout();
    await Empresa.updateOne({}, { $set: { "correoEntrante.ultimoError": undefined } });
    return { ok: true, sinLeer };
  } catch (error) {
    const e = new Error(mensajeErrorEntrante(error, conf.tipo));
    e.status = 400;
    throw e;
  } finally {
    cerrarSeguro(client);
  }
}

// ¿Merece la pena intentar leer este correo? Sin remitentes configurados
// se miran asunto y adjuntos: una campaña habla de precios, tarifas u
// ofertas; lo que habla de facturas y recibos no lo es (y metería ruido a
// la cola de revisión).
function pareceCampana({ asunto, adjuntos }) {
  const texto = `${asunto ?? ""} ${adjuntos.map((a) => a.filename ?? "").join(" ")}`.toLowerCase();
  if (INADECUADOS.some((p) => texto.includes(p))) return false;
  return ADECUADOS.some((p) => texto.includes(p));
}

// Convierte el resultado del OCR en los términos del modelo (misma lógica
// que el endpoint manual /ocr de energia-campanas.js).
function terminosDeExtraccion(extraccion) {
  const tramos = [extraccion.energiaPunta, extraccion.energiaLlano, extraccion.energiaValle]
    .map((v) => Number(v) || 0)
    .filter((v) => v > 0);
  const precioEnergia = Number(extraccion.energiaUnica) > 0
    ? Number(extraccion.energiaUnica)
    : tramos.length > 0
      ? Math.round((tramos.reduce((a, b) => a + b, 0) / tramos.length) * 10000) / 10000
      : 0;
  const factor = String(extraccion.potenciaUnidad ?? "").toLowerCase() === "ano" ? 1 : 365;
  const potencia = (v) => {
    const n = Number(v) || 0;
    return n > 0 ? Math.round(n * factor * 100) / 100 : 0;
  };
  return {
    tipo: extraccion.tipo === "gas" ? "gas" : "luz",
    nombre: String(extraccion.nombreCampana ?? "").trim() || undefined,
    tarifa: String(extraccion.tarifa ?? "").trim() || undefined,
    vigenciaDesde: extraccion.vigenciaDesde ? new Date(extraccion.vigenciaDesde) : undefined,
    vigenciaHasta: extraccion.vigenciaHasta ? new Date(extraccion.vigenciaHasta) : undefined,
    precioEnergia,
    precioEnergiaPunta: Number(extraccion.energiaPunta) || 0,
    precioEnergiaLlano: Number(extraccion.energiaLlano) || 0,
    precioEnergiaValle: Number(extraccion.energiaValle) || 0,
    precioPotenciaPunta: potencia(extraccion.potenciaPunta),
    precioPotenciaValle: potencia(extraccion.potenciaValle),
    mantenimiento: Number(extraccion.mantenimientoMensual) || 0,
    descuento: String(extraccion.descuento ?? "").trim() || undefined,
  };
}

async function enlazarComercializadora(nombre) {
  const limpio = String(nombre ?? "").trim();
  if (!limpio) return { id: undefined, nombre: undefined };
  const com = await Comercializadora.findOne({
    nombre: new RegExp(`^${limpio.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  }).lean();
  return com ? { id: com._id, nombre: com.nombre } : { id: undefined, nombre: limpio };
}

// Procesa un mensaje: extrae adjuntos válidos y crea la(s) campaña(s).
// Devuelve un resumen por mensaje para la lista de procesados.
async function procesarMensaje({ uid, parsed, conf, empresa }) {
  const yaTratados = new Set((empresa.correoEntrante?.procesados ?? []).map((p) => p.messageId));
  const messageId = parsed.messageId || `<sin-id-${uid}@local>`;
  if (yaTratados.has(messageId)) return { resultado: "ignorado", detalle: "ya procesado antes" };

  const adjuntos = (parsed.attachments ?? []).filter(
    (a) => a.content && MIME_VALIDOS.has(a.contentType?.toLowerCase?.() ?? "") && a.content.length <= PESO_MAXIMO
  );
  const asunto = parsed.subject ?? "";
  if (adjuntos.length === 0 || !pareceCampana({ asunto, adjuntos: parsed.attachments ?? [] })) {
    return { resultado: "sin adjunto", detalle: adjuntos.length === 0 ? "sin adjunto legible" : "no parece una campaña" };
  }

  const remitente = parsed.from?.text ?? "";
  const fecha = parsed.date ?? new Date();
  let creadas = 0;
  const errores = [];
  for (const adj of adjuntos.slice(0, 3)) {
    try {
      const extraccion = await extraerCampanaPrecios({
        buffer: adj.content,
        mimetype: adj.contentType.toLowerCase(),
        originalname: adj.filename || "campana",
      });
      const com = await enlazarComercializadora(extraccion.comercializadora);
      if (!com.id && !com.nombre) {
        errores.push("la IA no pudo leer la comercializadora");
        continue;
      }
      await CampanaPrecios.create({
        ...terminosDeExtraccion(extraccion),
        comercializadora: com.id,
        comercializadoraNombre: com.nombre,
        estado: "pendiente",
        origen: "correo",
        correo: { messageId, asunto, remitente, fecha, fichero: adj.filename || undefined },
        notas: [
          `Recibido por correo de ${remitente} el ${new Date(fecha).toLocaleDateString("es-ES")}.`,
          "Asunto: " + (asunto || "(sin asunto)"),
          (extraccion._ocr?.avisos ?? []).length > 0 ? `Avisos IA: ${extraccion._ocr.avisos.join("; ")}` : "",
        ].filter(Boolean).join("\n"),
      });
      creadas++;
    } catch (e) {
      errores.push(e.message);
    }
  }
  if (creadas > 0) {
    return { resultado: "campana", detalle: `${creadas} campaña(s) creada(s)${errores.length ? `; errores: ${errores.join("; ")}` : ""}` };
  }
  return { resultado: "error", detalle: errores.join("; ") || "no se pudo crear ninguna campaña" };
}

// Una pasada del sondeo para la empresa ACTUAL (contexto de tenant abierto).
// Si {silencioso} es false, los errores se lanzan para quien llamó.
//
// Usa el motor robusto de imap-robusto.js (lecciones del 14-15/10/2026):
// búsqueda de no leídos primero, trozos de 8, reconexión con espera y
// "castigo" del buzón tras fallos consecutivos (no insistir a Gmail).
export async function revisarCorreoCampanas() {
  const empresa = await Empresa.findOne();
  const conf = empresa?.correoEntrante;
  if (!conf?.activo || !conf?.usuario || !conf?.passwordCifrada) {
    return { ok: false, mensaje: "El buzón de campañas no está configurado o está desactivado" };
  }
  if (buzonEnCastigo(conf)) {
    return { ok: false, mensaje: "El buzón está en pausa tras varios fallos de conexión; se reintentará más tarde" };
  }

  const password = descifrar(conf.passwordCifrada);
  const resumen = { mensajes: 0, campanas: 0, detalles: [] };

  try {
    // Conexión corta solo para la búsqueda de no leídos (operación barata).
    let uidsNoLeidos = [];
    {
      const client = conexionImap(conf, password);
      try {
        await client.connect();
        const lock = await client.getMailboxLock(conf.carpeta || "INBOX");
        try {
          const todos = await client.search({ seen: false }, { uid: true });
          // Los más recientes primero dentro del tope por pasada.
          uidsNoLeidos = todos.slice(-MAX_MENSAJES_POR_PASADA).reverse();
        } finally {
          lock.release();
        }
        await client.logout();
      } finally {
        cerrarSeguro(client);
      }
    }

    if (uidsNoLeidos.length > 0) {
      const yaEnPasada = new Set(); // evita duplicar campañas si un trozo se reintenta
      const procesadosAhora = [];

      const r = await recorrerMensajesRobusto({
        conf,
        password,
        uids: uidsNoLeidos,
        campos: { uid: true, source: true },
        porMensaje: async (msg, client) => {
          let parsed;
          try {
            parsed = await simpleParser(msg.source);
          } catch {
            procesadosAhora.push({ messageId: `<uid-${msg.uid}@local>`, fecha: new Date(), resultado: "error", detalle: "correo ilegible (mal formado)" });
            return;
          }
          const messageId = parsed.messageId || `<sin-id-${msg.uid}@local>`;
          if (yaEnPasada.has(messageId)) return;
          yaEnPasada.add(messageId);

          const resultado = await procesarMensaje({ uid: msg.uid, parsed, conf, empresa });
          if (resultado.resultado === "campana") resumen.campanas++;
          resumen.mensajes++;
          resumen.detalles.push(`${parsed.subject ?? "(sin asunto)"} → ${resultado.resultado}: ${resultado.detalle}`);
          procesadosAhora.push({
            messageId,
            fecha: new Date(),
            resultado: resultado.resultado,
            detalle: String(resultado.detalle).slice(0, 300),
          });
          // Marcar como leído: la próxima pasada no vuelve a tocarlo.
          try {
            await client.messageFlagsAdd(String(msg.uid), ["\\Seen"], { uid: true });
          } catch { /* no es fatal */ }
        },
        alReintentar: (n, total, intento, error) => {
          console.warn(`[energia-correo] Trozo ${n}/${total} falló (intento ${intento}): ${error?.message ?? error}`);
        },
      });

      if (procesadosAhora.length > 0) {
        const previos = (empresa.correoEntrante?.procesados ?? []).map((p) => (p.toObject ? p.toObject() : p));
        const combinados = [...procesadosAhora, ...previos]
          .filter((p, i, arr) => arr.findIndex((x) => x.messageId === p.messageId) === i)
          .slice(0, MAX_PROCESADOS);
        empresa.correoEntrante.procesados = combinados;
      }
      if (r.trozosFallidos > 0) {
        resumen.detalles.push(`${r.trozosFallidos} grupo(s) de correos no se pudieron leer en esta pasada`);
      }
    }

    empresa.correoEntrante.ultimaPasada = new Date();
    empresa.correoEntrante.ultimoError = undefined;
    empresa.correoEntrante.fallosConsecutivos = 0;
    empresa.correoEntrante.ultimoIntento = new Date();
    await empresa.save();
    return {
      ok: true,
      ...resumen,
      mensaje:
        resumen.campanas > 0
          ? `${resumen.campanas} campaña(s) nueva(s) pendiente(s) de revisión`
          : resumen.mensajes > 0
            ? "Correos revisados; ninguna campaña nueva"
            : "Sin correos nuevos",
    };
  } catch (error) {
    // Lección 2: registrar el fallo y NO insistir. El contador de fallos
    // consecutivos pone el buzón en pausa (buzonEnCastigo) para que el
    // sondeo deje de darle la lata a Gmail hasta que se recupere solo.
    const mensaje = mensajeErrorEntrante(error, conf.tipo);
    empresa.correoEntrante.ultimaPasada = new Date();
    empresa.correoEntrante.ultimoIntento = new Date();
    empresa.correoEntrante.ultimoError = mensaje;
    empresa.correoEntrante.fallosConsecutivos = (Number(empresa.correoEntrante?.fallosConsecutivos) || 0) + 1;
    await empresa.save();
    const e = new Error(mensaje);
    e.status = 400;
    throw e;
  }
}

// Sondeo automático: cada 15 minutos (primera pasada a los 3 minutos del
// arranque) recorre las empresas activas con el buzón configurado y crea
// las campañas que hayan llegado. Silencioso: solo deja traza si hubo
// campañas nuevas o errores.
const INTERVALO_MS = 15 * 60 * 1000;

async function pasadaTenant(tenant) {
  const store = {
    conn: conexionTenant(tenant.dbName),
    slug: tenant.slug,
    dbName: tenant.dbName,
  };
  return alsEmpresa.run(store, async () => revisarCorreoCampanas());
}

export function iniciarSondeoCorreosCampanas() {
  // Guard contra solapes: una pasada IMAP lenta no se acumula con la siguiente.
  let enCurso = false;
  const pasada = async () => {
    if (enCurso) return;
    enCurso = true;
    try {
      let tenants = [];
      try {
        tenants = await Tenant.find({ estado: { $nin: ["inactivo", "suspendido"] } }).lean();
      } catch (e) {
        console.warn("[energia-correo] No se pudieron listar las empresas:", e.message);
        return;
      }
      for (const tenant of tenants) {
        try {
          const r = await pasadaTenant(tenant);
          if (r?.ok && r.campanas > 0) {
            console.log(`[energia-correo] (${tenant.slug}): ${r.mensaje}`);
          }
        } catch (e) {
          console.warn(`[energia-correo] Pasada fallida (${tenant.slug}):`, e.message);
        }
      }
    } finally {
      enCurso = false;
    }
  };
  setTimeout(pasada, 3 * 60 * 1000);
  setInterval(pasada, INTERVALO_MS);
}
