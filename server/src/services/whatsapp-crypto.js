import crypto from "node:crypto";

function clave() {
  const secreto = process.env.CLAVE_WHATSAPP;
  if (!secreto || secreto.length < 24) {
    throw new Error("CLAVE_WHATSAPP no está configurada o es demasiado corta");
  }
  return crypto.createHash("sha256").update(secreto).digest();
}

export function cifrarTokenWhatsApp(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", clave(), iv);
  const cifrado = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), cifrado].map((parte) => parte.toString("base64url")).join(".");
}

export function descifrarTokenWhatsApp(valor) {
  const [iv, tag, cifrado] = String(valor).split(".").map((parte) => Buffer.from(parte, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", clave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString("utf8");
}