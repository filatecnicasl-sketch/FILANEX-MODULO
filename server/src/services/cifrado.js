// Cifrado simétrico (AES-256-GCM) para secretos guardados en base de datos:
// la contraseña del certificado VeriFactu de cada empresa. La clave maestra
// vive solo en el servidor (CLAVE_CERTS en .env); sin ella los secretos
// cifrados son irrecuperables.
import crypto from "node:crypto";

function clave() {
  const c = process.env.CLAVE_CERTS;
  if (!c) throw new Error("CLAVE_CERTS no configurada en server/.env");
  return crypto.createHash("sha256").update(c).digest();
}

// Devuelve "iv:tag:datos" en base64.
export function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([c.update(String(texto), "utf8"), c.final()]);
  return `${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${datos.toString("base64")}`;
}

export function descifrar(dato) {
  const [iv, tag, datos] = String(dato ?? "")
    .split(":")
    .map((parte) => Buffer.from(parte, "base64"));
  if (!iv?.length || !tag?.length || !datos?.length) throw new Error("Dato cifrado inválido");
  const d = crypto.createDecipheriv("aes-256-gcm", clave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(datos), d.final()]).toString("utf8");
}
