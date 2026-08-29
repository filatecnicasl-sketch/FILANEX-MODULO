/**
 * Adaptador de almacenamiento de archivos.
 *
 * En modo nube (cuando estan configuradas las variables R2_* o S3_*), los
 * archivos se guardan en un bucket S3-compatible (Cloudflare R2, AWS S3,
 * DigitalOcean Spaces, etc.). En modo local, se mantienen en disco bajo la
 * carpeta uploads/ y certificados/.
 *
 * El backend sigue sirviendo todo desde /uploads/... y /cert/..., asi que las
 * URLs guardadas en base de datos no cambian y el service worker puede cachear
 * sin problemas.
 */
import fs from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

function s3Activo() {
  return Boolean(
    process.env.R2_ENDPOINT || process.env.S3_ENDPOINT,
  );
}

function crearClienteS3() {
  const endpoint = process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
  const region = process.env.R2_REGION || process.env.S3_REGION || "auto";
  const accessKeyId = process.env.R2_ACCESS_KEY || process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.R2_SECRET_KEY || process.env.S3_SECRET_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Faltan variables de entorno para el almacenamiento S3/R2");
  }
  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

function bucket() {
  return process.env.R2_BUCKET || process.env.S3_BUCKET || "filanex";
}

function clave(remoto) {
  // Normaliza la ruta para S3: sin barra inicial.
  return remoto.replace(/^\/+/g, "").replace(/\\/g, "/");
}

function rutaLocal(remoto) {
  return path.join(process.cwd(), remoto);
}

/**
 * Guarda un buffer en la ruta remota indicada.
 * La ruta suele ser "uploads/<slug>/..." o "certificados/<slug>-aeat.pfx".
 */
export async function guardarArchivo(remoto, buffer, contentType = "application/octet-stream") {
  if (s3Activo()) {
    const client = crearClienteS3();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: clave(remoto),
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return;
  }
  const destino = rutaLocal(remoto);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, buffer);
}

/**
 * Lee un archivo y devuelve un Buffer.
 */
export async function leerArchivo(remoto) {
  if (s3Activo()) {
    const client = crearClienteS3();
    const respuesta = await client.send(
      new GetObjectCommand({ Bucket: bucket(), Key: clave(remoto) }),
    );
    const chunks = [];
    for await (const chunk of respuesta.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  return fs.readFileSync(rutaLocal(remoto));
}

/**
 * Comprueba si un archivo existe.
 */
export async function existeArchivo(remoto) {
  if (s3Activo()) {
    const client = crearClienteS3();
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket(), Key: clave(remoto) }));
      return true;
    } catch {
      return false;
    }
  }
  return fs.existsSync(rutaLocal(remoto));
}

/**
 * Borra un archivo.
 */
export async function borrarArchivo(remoto) {
  if (s3Activo()) {
    const client = crearClienteS3();
    await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: clave(remoto) }));
    return;
  }
  const destino = rutaLocal(remoto);
  if (fs.existsSync(destino)) fs.unlinkSync(destino);
}

/**
 * Lista los archivos directamente bajo un prefijo/carpeta.
 * Devuelve [{ ruta, tamano, fecha }] con la ruta relativa completa.
 */
export async function listarArchivos(prefijo) {
  const p = clave(prefijo);
  if (s3Activo()) {
    const client = crearClienteS3();
    const respuesta = await client.send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: `${p}/` }),
    );
    return (respuesta.Contents ?? [])
      .filter((o) => o.Key.slice(p.length + 1).indexOf("/") === -1)
      .map((o) => ({ ruta: o.Key, tamano: o.Size ?? 0, fecha: o.LastModified ?? null }));
  }
  const dir = rutaLocal(prefijo);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => fs.statSync(path.join(dir, f)).isFile())
    .map((f) => {
      const st = fs.statSync(path.join(dir, f));
      return { ruta: `${p}/${f}`, tamano: st.size, fecha: st.mtime };
    });
}

/**
 * Devuelve la URL publica relativa del archivo (la que se guarda en BD).
 * Siempre empieza por /uploads/ o /cert/ para mantener compatibilidad.
 */
export function urlPublica(remoto) {
  // Normaliza a barra inicial.
  return `/${remoto.replace(/^\/+/g, "").replace(/\\/g, "/")}`;
}

/**
 * URL absoluta incluyendo el origen de la peticion.
 */
export function urlAbsoluta(req, remoto) {
  const host = req.headers.host || process.env.FRONTEND_URL || "localhost";
  const protocol = req.headers["x-forwarded-proto"] || "http";
  return `${protocol}://${host}${urlPublica(remoto)}`;
}
