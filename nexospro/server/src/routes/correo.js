import { Router } from "express";
import Empresa from "../models/Empresa.js";
import { requiereRol } from "../middleware/auth.js";
import { cifrar, descifrar } from "../services/cifrado.js";
import {
  configuracionPublica,
  enviarDocumentoCorreo,
  enviarPruebaCorreo,
  normalizarConfiguracionCorreo,
  verificarCorreoEmpresa,
} from "../services/correo.js";
import {
  configuracionEntrantePublica,
  normalizarConfiguracionEntrante,
  probarCorreoEntrante,
  conexionImap,
  mensajeErrorEntrante,
} from "../services/energia-correo.js";

const router = Router();
const soloAdmin = requiereRol("admin");

router.get("/configuracion", async (req, res, next) => {
  try {
    const empresa = await Empresa.findOne().lean();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });
    res.json(configuracionPublica(empresa));
  } catch (error) {
    next(error);
  }
});

router.put("/configuracion", soloAdmin, async (req, res, next) => {
  try {
    let empresa = await Empresa.findOne();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });
    try {
      empresa.correo = normalizarConfiguracionCorreo(req.body, empresa);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const password = String(req.body.password ?? "");
    if (password) empresa.correo.passwordCifrada = cifrar(password);
    if (!empresa.correo.passwordCifrada) {
      empresa.correo.activo = false;
      empresa.correo.ultimoError = "Falta la contraseña del correo";
    }
    await empresa.save();
    res.json(configuracionPublica(empresa.toObject()));
  } catch (error) {
    next(error);
  }
});

router.post("/verificar", soloAdmin, async (req, res, next) => {
  try {
    res.json(await verificarCorreoEmpresa());
  } catch (error) {
    next(error);
  }
});

router.post("/prueba", soloAdmin, async (req, res, next) => {
  try {
    const resultado = await enviarPruebaCorreo(req.body);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

router.post("/enviar-documento", soloAdmin, async (req, res, next) => {
  try {
    const resultado = await enviarDocumentoCorreo(req.body);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Buzón ENTRANTE (IMAP/Gmail). Cuenta de la empresa para consultar correos
// y bajar adjuntos desde el programa (p. ej. importar facturas de proveedor
// que llegan al correo). La config se guarda en empresa.correoEntrante, la
// misma que usa la recogida de campañas de precios si el tenant tiene el
// módulo de energía: una sola cuenta por empresa.
// ---------------------------------------------------------------------------

// Adjuntos válidos para facturas: PDF e imágenes (lo que lee el OCR).
const MIME_ADJUNTOS = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const PESO_MAXIMO_ADJUNTO = 15 * 1024 * 1024; // 15 MB

async function conectarBuzonEntrante() {
  const empresa = await Empresa.findOne();
  const conf = empresa?.correoEntrante;
  if (!conf?.usuario || !conf?.passwordCifrada) {
    const e = new Error("Aún no hay buzón entrante configurado (Ajustes → Correo)");
    e.status = 400;
    throw e;
  }
  const client = conexionImap(conf, descifrar(conf.passwordCifrada));
  try {
    await client.connect();
  } catch (error) {
    const e = new Error(mensajeErrorEntrante(error, conf.tipo));
    e.status = 400;
    throw e;
  }
  return { client, carpetaPorDefecto: conf.carpeta || "INBOX" };
}

router.get("/entrante/config", async (req, res, next) => {
  try {
    const empresa = await Empresa.findOne().lean();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });
    res.json(configuracionEntrantePublica(empresa));
  } catch (error) {
    next(error);
  }
});

router.put("/entrante/config", soloAdmin, async (req, res, next) => {
  try {
    const empresa = await Empresa.findOne();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });
    let config;
    try {
      config = normalizarConfiguracionEntrante(req.body, empresa);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const password = String(req.body.password ?? "");
    if (password) config.passwordCifrada = cifrar(password);
    if (!config.passwordCifrada) {
      config.activo = false;
      config.ultimoError = "Falta la contraseña del buzón";
    }
    empresa.correoEntrante = config;
    await empresa.save();
    res.json(configuracionEntrantePublica(empresa.toObject()));
  } catch (error) {
    next(error);
  }
});

router.post("/entrante/probar", soloAdmin, async (req, res, next) => {
  try {
    res.json(await probarCorreoEntrante());
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// Carpetas/etiquetas del buzón, para el desplegable del buzón.
router.get("/entrante/carpetas", async (req, res, next) => {
  let client;
  try {
    ({ client } = await conectarBuzonEntrante());
    const carpetas = [];
    for await (const c of client.list()) {
      carpetas.push({ nombre: c.path, especial: Boolean(c.specialUse) });
    }
    await client.logout();
    res.json(carpetas);
  } catch (err) {
    try { await client?.logout(); } catch { /* nada */ }
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// Mensajes de una carpeta (los más recientes primero). Por defecto solo los
// que traen adjuntos válidos (PDF o imagen); cada adjunto lleva su índice
// para poder bajarlo con /entrante/mensajes/:uid/adjunto.
router.get("/entrante/mensajes", async (req, res, next) => {
  let client;
  try {
    const { client: c, carpetaPorDefecto } = await conectarBuzonEntrante();
    client = c;
    const carpeta = String(req.query.carpeta ?? carpetaPorDefecto).slice(0, 120) || "INBOX";
    const limite = Math.min(Math.max(Math.trunc(Number(req.query.limite)) || 50, 1), 100);
    const soloAdjuntos = req.query.soloAdjuntos !== "0";
    const busqueda = String(req.query.busqueda ?? "").trim().slice(0, 120);

    client = await conectarBuzonEntrante();
    const lock = await client.getMailboxLock(carpeta);
    const mensajes = [];
    try {
      let uids;
      if (busqueda) {
        // OR sobre remitente y asunto; si el servidor no lo admite, se
        // lista todo y se filtra aquí mismo.
        try {
          uids = await client.search({ or: [{ from: busqueda }, { subject: busqueda }] }, { uid: true });
        } catch {
          uids = null;
        }
      }
      if (!uids) uids = await client.search({ all: true }, { uid: true });

      const ultimos = (uids ?? []).slice(-limite * (soloAdjuntos ? 3 : 1)).reverse();
      const patron = busqueda ? new RegExp(busqueda.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;

      for await (const msg of client.fetch(ultimos, { envelope: true, bodyStructure: true }, { uid: true })) {
        const adjuntos = [];
        const recorrer = (nodo) => {
          if (nodo.disposition === "attachment" || nodo.dispositionParameters?.filename || nodo.parameters?.name) {
            adjuntos.push({
              nombre: nodo.dispositionParameters?.filename ?? nodo.parameters?.name ?? "adjunto",
              tipo: nodo.type ? `${nodo.type}/${nodo.subtype}` : "",
              tamano: nodo.size ?? 0,
            });
          }
          (nodo.childNodes ?? []).forEach(recorrer);
        };
        recorrer(msg.bodyStructure ?? {});
        const validos = adjuntos.filter(
          (a) => MIME_ADJUNTOS.has(a.tipo) || /\.(pdf|png|jpe?g|webp)$/i.test(a.nombre)
        );
        if (soloAdjuntos && !validos.length) continue;
        const env = msg.envelope;
        const de = env.from?.map((f) => f.address).filter(Boolean).join(", ") ?? "";
        const asunto = env.subject ?? "(sin asunto)";
        // Buscar también en nombres de adjunto (útil para encontrar "Invoice-").
        const textoAdjuntos = validos.map((a) => a.nombre).join(" ");
        if (patron && !patron.test(de) && !patron.test(asunto) && !patron.test(env.from?.[0]?.name ?? "") && !patron.test(textoAdjuntos)) {
          continue;
        }
        mensajes.push({
          uid: msg.uid,
          carpeta,
          fecha: env.date ?? null,
          de,
          deNombre: env.from?.[0]?.name ?? "",
          asunto,
          adjuntos: validos,
        });
        if (mensajes.length >= limite) break;
      }
    } finally {
      lock.release();
    }
    await client.logout();
    res.json(mensajes);
  } catch (err) {
    try { await client?.logout(); } catch { /* nada */ }
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (/nonexistent|UNKNOWN\]|Mailbox/i.test(err?.message ?? "")) {
      return res.status(400).json({ error: "Esa carpeta no existe en el buzón." });
    }
    next(err);
  }
});

// Baja un adjunto concreto (por índice dentro del mensaje). El frontend lo
// recoge como blob y lo manda al OCR como si lo subiera a mano.
router.get("/entrante/mensajes/:uid/adjunto", async (req, res, next) => {
  let client;
  try {
    const { client: c, carpetaPorDefecto } = await conectarBuzonEntrante();
    client = c;
    const carpeta = String(req.query.carpeta ?? carpetaPorDefecto).slice(0, 120) || "INBOX";
    const indice = Math.max(Math.trunc(Number(req.query.indice)) || 0, 0);
    const lock = await client.getMailboxLock(carpeta);
    let buffer = null;
    let nombre = `adjunto-${indice}`;
    let tipo = "application/octet-stream";
    try {
      // imapflow numera las partes desde 1; el índice público es 0-based
      // sobre la lista de adjuntos válidos.
      const estructura = await client.fetchOne(req.params.uid, { bodyStructure: true }, { uid: true });
      const nodos = [];
      const recorrer = (nodo) => {
        if (nodo.disposition === "attachment" || nodo.dispositionParameters?.filename || nodo.parameters?.name) {
          nodos.push(nodo);
        }
        (nodo.childNodes ?? []).forEach(recorrer);
      };
      recorrer(estructura?.bodyStructure ?? {});
      // Mismo criterio de validez que el listado de mensajes, para que el
      // índice del adjunto coincida con el que vio el frontend.
      const validos = nodos.filter(
        (n) =>
          MIME_ADJUNTOS.has(n.type ? `${n.type}/${n.subtype}` : "") ||
          /\.(pdf|png|jpe?g|webp)$/i.test(
            n.dispositionParameters?.filename ?? n.parameters?.name ?? ""
          )
      );
      const nodo = validos[indice];
      if (!nodo) {
        const e = new Error("Ese adjunto ya no está en el correo");
        e.status = 404;
        throw e;
      }
      nombre = nodo.dispositionParameters?.filename ?? nodo.parameters?.name ?? nombre;
      tipo = nodo.type ? `${nodo.type}/${nodo.subtype}` : tipo;
      // La parte a bajar: el part id del nodo (p. ej. "2") o su posición.
      const parte = nodo.part || String(nodos.indexOf(nodo) + 1);
      const descarga = await client.download(req.params.uid, parte, { uid: true });
      const trozos = [];
      for await (const trozo of descarga.content) trozos.push(trozo);
      const total = trozos.reduce((s, t) => s + t.length, 0);
      if (total > PESO_MAXIMO_ADJUNTO) {
        const e = new Error("El adjunto es demasiado grande (máximo 15 MB)");
        e.status = 400;
        throw e;
      }
      buffer = Buffer.concat(trozos);
    } finally {
      lock.release();
    }
    await client.logout();
    res.setHeader("Content-Type", tipo);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(nombre)}"`);
    res.send(buffer);
  } catch (err) {
    try { await client?.logout(); } catch { /* nada */ }
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

export default router;
