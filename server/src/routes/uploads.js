import { Router } from "express";
import path from "node:path";
import { leerArchivo, existeArchivo } from "../services/storage.js";
import { requiereAuth } from "../middleware/auth.js";

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
    const ext = path.extname(ruta).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    // private: son archivos de la empresa (extractos, firmas, fotos);
    // ningún proxy o caché compartida debe guardarlos.
    res.setHeader("Cache-Control", "private, max-age=3600");
    // Un SVG subido puede llevar <script>: se sirve sin permitir scripts
    // para que no ejecute JS en el origen de la aplicación.
    if (ext === ".svg") {
      res.setHeader("Content-Security-Policy", "script-src 'none'");
    }
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// Sirve archivos desde S3/R2 o disco local. Requiere sesión válida
// (cabecera Authorization o ?sesion= para <img>/window.open): sin ella,
// nadie puede leer extractos bancarios, firmas o fotos por URL.
// Además la ruta solo puede apuntar a la carpeta del propio tenant
// (uploads/<slug>/...): con sesión de la empresa A no se leen archivos
// de la empresa B aunque se adivine su slug.
// Los certificados PFX nunca se sirven por aquí.
router.get("/uploads/*", requiereAuth, async (req, res, next) => {
  const ruta = req.params[0] || "";
  const slug = req.usuario?.t;
  if (!slug || !ruta.startsWith(`${slug}/`)) {
    return res.status(403).json({ error: "No tienes acceso a este archivo" });
  }
  await servirArchivo(res, next, "uploads", ruta);
});

export default router;
