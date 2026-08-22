import multer from "multer";
import path from "node:path";
import { guardarArchivo, urlPublica, borrarArchivo } from "../services/storage.js";

export const uploadMemoria = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB por defecto
});

/**
 * Guarda el archivo subido (req.file) para el tenant actual.
 * Devuelve la URL pública relativa (p.ej. /uploads/local/taller/foto.jpg).
 *
 * @param {import('express').Request} req
 * @param {string} subcarpeta - carpeta lógica dentro del tenant (taller, logos...)
 * @param {string} nombreBase - nombre sin extensión; si se omite usa Date.now()
 * @param {object} opts - { borrarAnteriores: glob, contentType }
 */
export async function guardarSubida(req, subcarpeta, nombreBase, opts = {}) {
  const file = req.file;
  if (!file) throw new Error("No se ha recibido ningún archivo");

  const slug = req.empresa?.slug || "local";
  const ext = path.extname(file.originalname) || ".bin";
  const base = `${nombreBase || Date.now()}${ext}`;
  const ruta = `uploads/${slug}/${subcarpeta}/${base}`;

  await guardarArchivo(ruta, file.buffer, opts.contentType || file.mimetype || "application/octet-stream");
  return urlPublica(ruta);
}

/**
 * Elimina archivos subidos por patrón. En modo S3 no soporta globs,
 * así que se usa para borrado puntual por nombre conocido.
 */
export async function borrarSubida(remotoRelativo) {
  await borrarArchivo(remotoRelativo.replace(/^\/+/, ""));
}
