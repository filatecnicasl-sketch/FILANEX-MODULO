// JWT HS256 implementado con node:crypto (sin dependencias externas): el
// instalador debe funcionar incluso sin internet, así que no se añaden
// paquetes para esto. Formato estándar: header.payload.firma en base64url.
import crypto from "node:crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");

function secreto() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET no configurado en server/.env");
  return s;
}

// Firma un token con los datos del usuario y caducidad en segundos.
export function firmarToken(payload, segundosExp = 12 * 60 * 60) {
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = b64u(JSON.stringify({ ...payload, iat: ahora, exp: ahora + segundosExp }));
  const firma = crypto.createHmac("sha256", secreto()).update(`${header}.${cuerpo}`).digest("base64url");
  return `${header}.${cuerpo}.${firma}`;
}

// Verifica firma y caducidad. Devuelve el payload o null si no es válido.
export function verificarToken(token) {
  try {
    const [header, cuerpo, firma] = String(token ?? "").split(".");
    if (!header || !cuerpo || !firma) return null;
    const esperada = crypto.createHmac("sha256", secreto()).update(`${header}.${cuerpo}`).digest();
    const recibida = Buffer.from(firma, "base64url");
    if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null;
    const payload = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
