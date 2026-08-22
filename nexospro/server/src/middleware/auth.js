// Middleware de autenticación: exige un token JWT válido en la cabecera
// Authorization: Bearer <token>. Todo /api lo requiere salvo las rutas
// públicas (health, login, bootstrap del primer administrador).
import { verificarToken } from "../services/jwt.js";

export function requiereAuth(req, res, next) {
  const m = String(req.headers.authorization ?? "").match(/^Bearer\s+(.+)$/i);
  // EventSource (telefonía SSE) no puede enviar cabeceras: acepta ?sesion=
  const token = m?.[1] ?? (req.query.sesion ? String(req.query.sesion) : null);
  const payload = token ? verificarToken(token) : null;
  if (!payload) {
    return res.status(401).json({ error: "Sesión no válida o caducada. Inicia sesión de nuevo." });
  }
  req.usuario = payload;
  next();
}

export function requiereRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tienes permiso para esta acción" });
    }
    next();
  };
}
