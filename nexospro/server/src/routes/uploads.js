import { Router } from "express";
import path from "node:path";
import { leerArchivo, existeArchivo } from "../services/storage.js";

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
};

const router = Router();

async function servirArchivo(res, next, prefijo, ruta) {
  try {
    if (!ruta || ruta.includes("..") || ruta.includes("~")) {
      return res.status(400).json({ error: "Ruta no válida" });
    }
    const remoto = `${prefijo}/${ruta}`;
    if (!(await existeArchivo(remoto))) {
      return res.status(404).json({ error: "Archivo no encontrado" });
    }
    const buffer = await leerArchivo(remoto);
    const contentType = MIME[path.extname(ruta).toLowerCase()] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// Sirve archivos desde S3/R2 o disco local manteniendo las URLs públicas
// /uploads/<ruta> y /cert/<ruta>. Esto permite que las URLs guardadas en
// base de datos no cambien entre modo nube y modo local.
router.get("/uploads/*", async (req, res, next) => {
  await servirArchivo(res, next, "uploads", req.params[0]);
});

// Certificados digitales se guardan bajo /cert/<slug>-aeat.pfx.
router.get("/cert/*", async (req, res, next) => {
  await servirArchivo(res, next, "certificados", req.params[0]);
});

export default router;
