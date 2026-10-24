import multer from "multer";
import path from "node:path";
import { guardarArchivo, urlPublica, borrarArchivo } from "../services/storage.js";
import { slugActual } from "../models/tenant.js";

export const uploadMemoria = multer({
  storage: multer.memoryStorage(),
  // 20 MB: las fotos de los móviles actuales pasan a menudo de 10 MB.
  // Las imágenes se comprimen después en prepararParaOcr antes de enviarlas a la IA.
  limits: { fileSize: 20 * 1024 * 1024 },
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

  // El slug sale del contexto de empresa (AsyncLocalStorage), no de la
  // petición: así los archivos de cada cliente quedan en su propia carpeta y
  // un logo no puede sobrescribir el de otra empresa.
  const slug = slugActual();
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
