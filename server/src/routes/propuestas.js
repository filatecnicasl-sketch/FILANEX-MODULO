// Propuestas de mejora del programa escritas por los usuarios (Ayuda →
// Novedades → Propuestas). Cada empresa ve las suyas; el superadministrador
// de la plataforma las ve TODAS juntas con /todas.
import { Router } from "express";
import multer from "multer";
import Propuesta from "../models/Propuesta.js";
import Tenant from "../models/plataforma/Tenant.js";
import { contextoTrasSubida } from "../middleware/empresa.js";
import { requiereSuperAdmin } from "../middleware/auth.js";
import { guardarArchivo, borrarArchivo, urlPublica } from "../services/storage.js";
import { randomUUID } from "node:crypto";
import { slugActual, conexionTenant } from "../models/tenant.js";

const router = Router();

const subidaCapturas = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
}).array("capturas", 4);

function recibirAdjuntos(req, res, next) {
  subidaCapturas(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Cada adjunto puede ocupar como máximo 10 MB." });
      }
      if (["LIMIT_FILE_COUNT", "LIMIT_UNEXPECTED_FILE"].includes(error.code)) {
        return res.status(400).json({ error: "Puedes adjuntar hasta 4 archivos en el campo de adjuntos." });
      }
      return res.status(400).json({ error: "No se pudieron recibir los adjuntos. Revisa los archivos e inténtalo de nuevo." });
    }
    contextoTrasSubida(req, res, next);
  });
}

function tipoAdjunto(buffer) {
  if (buffer.subarray(0, 5).toString() === "%PDF-") return { ext: ".pdf", mime: "application/pdf" };
  if (buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return { ext: ".png", mime: "image/png" };
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: ".jpg", mime: "image/jpeg" };
  if (["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString())) return { ext: ".gif", mime: "image/gif" };
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return { ext: ".webp", mime: "image/webp" };
  return null;
}

// Buzón global del superadministrador: propuestas de TODAS las empresas,
// etiquetadas con la empresa de la que viene cada una.
router.get("/todas", requiereSuperAdmin, async (req, res, next) => {
  try {
    const tenants = await Tenant.find({ activo: { $ne: false } }).select("slug nombre dbName").lean();
    const todas = [];
    for (const t of tenants) {
      try {
        const conn = conexionTenant(t.dbName);
        const lista = await conn
          .model("Propuesta")
          .find()
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();
        for (const p of lista) {
          todas.push({ ...p, empresaSlug: t.slug, empresaNombre: t.nombre });
        }
      } catch (err) {
        console.warn(`Propuestas de ${t.slug}: ${err?.message}`);
      }
    }
    todas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(todas.slice(0, 300));
  } catch (err) {
    next(err);
  }
});

const ESTADOS = ["pendiente", "realizada", "descartada"];

// El superadministrador archiva una propuesta (realizada / descartada) o la
// reabre (pendiente). La propuesta vive en la base de datos de SU empresa,
// así que se actualiza por slug. Al archivar puede incluir una "respuesta"
// para el autor: se guarda en su buzón y se le intenta enviar por correo
// con el SMTP de su propia empresa (si está configurado); si el correo
// falla, la respuesta queda igualmente en el programa.
router.patch("/todas/:slug/:id/estado", requiereSuperAdmin, async (req, res, next) => {
  try {
    const estado = String(req.body?.estado ?? "");
    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({ error: "Estado no válido" });
    }
    const tenant = await Tenant.findOne({ slug: req.params.slug }).select("slug nombre dbName").lean();
    if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });

    const respuesta = String(req.body?.respuesta ?? "").trim().slice(0, 1500);
    const cambio = { estado };
    if (estado !== "pendiente" && respuesta) {
      cambio.respuesta = respuesta;
      cambio.respuestaFecha = new Date();
      // El remitente visible siempre es el soporte, sea quien sea quien
      // conteste por dentro (regla acordada con Francis).
      cambio.respondidaPor = "Soporte FILANEX";
    }
    const doc = await conexionTenant(tenant.dbName)
      .model("Propuesta")
      .findByIdAndUpdate(req.params.id, cambio, { new: true })
      .lean();
    if (!doc) return res.status(404).json({ error: "Propuesta no encontrada" });

    // Aviso por correo al autor (mejor esfuerzo): usa el correo configurado
    // por la propia empresa, dentro de su contexto de base de datos.
    let correoEnviado = false;
    if (estado !== "pendiente" && respuesta && doc.usuarioEmail) {
      try {
        const { enviarCorreoEmpresa } = await import("../services/correo.js");
        const { conContexto } = await import("../models/tenant.js");
        const contexto = {
          conn: conexionTenant(tenant.dbName),
          slug: tenant.slug,
          dbName: tenant.dbName,
        };
        await conContexto(contexto, () =>
          enviarCorreoEmpresa({
            para: doc.usuarioEmail,
            asunto:
              estado === "realizada"
                ? `Tu propuesta está resuelta — ${tenant.nombre}`
                : `Hemos revisado tu propuesta — ${tenant.nombre}`,
            mensaje:
              `Hola${doc.usuarioNombre ? " " + doc.usuarioNombre : ""}:\n\n` +
              (estado === "realizada"
                ? "Tu propuesta ya está resuelta y disponible en el programa:"
                : "Hemos revisado tu propuesta y esta es nuestra respuesta:") +
              `\n\n"${respuesta}"\n\n` +
              "Puedes verla también en Ayuda → Novedades → Propuestas.\n\n" +
              "Gracias por ayudarnos a mejorar.\nEquipo FILANEX",
          })
        );
        correoEnviado = true;
      } catch (err) {
        console.warn(`Propuesta ${req.params.id}: correo no enviado (${err?.message})`);
      }
    }

    res.json({ ...doc, correoEnviado });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const propuestas = await Propuesta.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(propuestas);
  } catch (err) {
    next(err);
  }
});

router.post("/", recibirAdjuntos, async (req, res, next) => {
  const guardados = [];
  try {
    if (!req.contextoEmpresa?.slug || !req.contextoEmpresa?.dbName || slugActual() !== req.contextoEmpresa.slug) {
      return res.status(401).json({ error: "No se pudo comprobar la empresa de la propuesta. Inicia sesión de nuevo." });
    }
    const texto = String(req.body?.texto ?? "").trim();
    if (!texto) return res.status(400).json({ error: "Escribe la propuesta antes de enviarla" });
    const archivos = (req.files ?? []).map((archivo) => ({ archivo, tipo: tipoAdjunto(archivo.buffer) }));
    if (archivos.some(({ tipo }) => !tipo)) {
      return res.status(400).json({ error: "Adjunta imágenes PNG, JPG, WEBP o GIF, o documentos PDF. Hay un archivo vacío, no válido o de un formato no admitido. No se ha enviado la propuesta." });
    }

    const adjuntos = [];
    for (const { archivo: fichero, tipo } of archivos) {
      const archivo = `propuesta-${randomUUID()}${tipo.ext}`;
      const remoto = `uploads/${slugActual()}/propuestas/${archivo}`;
      guardados.push(remoto);
      await guardarArchivo(remoto, fichero.buffer, tipo.mime);
      adjuntos.push({ url: urlPublica(remoto), nombre: fichero.originalname || archivo });
    }

    const creada = await Propuesta.create({
      texto: texto.slice(0, 1000),
      usuarioNombre: req.usuario?.nombre ?? "",
      usuarioEmail: req.usuario?.email ?? "",
      adjuntos,
    });
    res.status(201).json(creada);
  } catch (err) {
    await Promise.allSettled(guardados.map(borrarArchivo));
    next(err);
  }
});

// El usuario marca como leída la respuesta a su propuesta: se llama al
// cerrar el aviso que salta en su pantalla principal, para que no vuelva
// a aparecer.
router.post("/:id/leida", async (req, res, next) => {
  try {
    const doc = await Propuesta.findByIdAndUpdate(
      req.params.id,
      { respuestaLeida: true, respuestaLeidaAt: new Date() },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ error: "Propuesta no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
