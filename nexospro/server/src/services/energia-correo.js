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
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import Empresa from "../models/Empresa.js";
import CampanaPrecios from "../models/CampanaPrecios.js";
import Comercializadora from "../models/Comercializadora.js";
import Tenant from "../models/plataforma/Tenant.js";
import { alsEmpresa, conexionTenant } from "../models/tenant.js";
import { extraerCampanaPrecios } from "./ocr-gemini.js";
import { descifrar } from "./cifrado.js";

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

function conexionImap(conf, password) {
  return new ImapFlow({
    host: conf.host,
    port: Number(conf.puerto) || 993,
    secure: true, // IMAP moderno es siempre TLS (993)
    auth: { user: conf.usuario, pass: password },
    logger: false,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 120000,
  });
}

function mensajeErrorEntrante(error, tipo) {
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

// Cerrar la conexión sin estallar: si connect() falló a medias, el cliente
// puede no tener close() disponible (o no devolver una promesa).
function cerrarSeguro(client) {
  try {
    Promise.resolve(client?.close?.()).catch(() => {});
  } catch { /* ya estaba cerrado */ }
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
export async function revisarCorreoCampanas() {
  const empresa = await Empresa.findOne();
  const conf = empresa?.correoEntrante;
  if (!conf?.activo || !conf?.usuario || !conf?.passwordCifrada) {
    return { ok: false, mensaje: "El buzón de campañas no está configurado o está desactivado" };
  }

  const client = conexionImap(conf, descifrar(conf.passwordCifrada));
  const resumen = { mensajes: 0, campanas: 0, detalles: [] };
  try {
    await client.connect();
    const lock = await client.getMailboxLock(conf.carpeta || "INBOX");
    try {
      const procesadosAhora = [];
      for await (const msg of client.fetch(
        { seen: false },
        { uid: true, source: true },
        { uid: true }
      )) {
        if (resumen.mensajes >= MAX_MENSAJES_POR_PASADA) break;
        resumen.mensajes++;
        let parsed;
        try {
          parsed = await simpleParser(msg.source);
        } catch {
          procesadosAhora.push({
            messageId: `<uid-${msg.uid}@local>`,
            fecha: new Date(),
            resultado: "error",
            detalle: "correo ilegible (mal formado)",
          });
          continue;
        }
        const r = await procesarMensaje({ uid: msg.uid, parsed, conf, empresa });
        if (r.resultado === "campana") resumen.campanas++;
        resumen.detalles.push(`${parsed.subject ?? "(sin asunto)"} → ${r.resultado}: ${r.detalle}`);
        procesadosAhora.push({
          messageId: parsed.messageId || `<uid-${msg.uid}@local>`,
          fecha: new Date(),
          resultado: r.resultado,
          detalle: String(r.detalle).slice(0, 300),
        });
        // Marcar como leído: la próxima pasada no vuelve a tocarlo.
        try {
          await client.messageFlagsAdd(String(msg.uid), ["\\Seen"], { uid: true });
        } catch { /* no es fatal */ }
      }

      if (procesadosAhora.length > 0) {
        const previos = (empresa.correoEntrante?.procesados ?? []).map((p) => p.toObject ? p.toObject() : p);
        const combinados = [...procesadosAhora, ...previos]
          .filter((p, i, arr) => arr.findIndex((x) => x.messageId === p.messageId) === i)
          .slice(0, MAX_PROCESADOS);
        empresa.correoEntrante.procesados = combinados;
      }
    } finally {
      lock.release();
    }
    await client.logout();

    empresa.correoEntrante.ultimaPasada = new Date();
    empresa.correoEntrante.ultimoError = undefined;
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
    const mensaje = mensajeErrorEntrante(error, conf.tipo);
    empresa.correoEntrante.ultimaPasada = new Date();
    empresa.correoEntrante.ultimoError = mensaje;
    await empresa.save();
    const e = new Error(mensaje);
    e.status = 400;
    throw e;
  } finally {
    cerrarSeguro(client);
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
  const pasada = async () => {
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
  };
  setTimeout(pasada, 3 * 60 * 1000);
  setInterval(pasada, INTERVALO_MS);
}
