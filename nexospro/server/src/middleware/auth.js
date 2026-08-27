// Middleware de autenticación: exige un token JWT válido en la cabecera
// Authorization: Bearer <token>. Todo /api lo requiere salvo las rutas
// públicas (health, login, bootstrap del primer administrador).
import { verificarToken } from "../services/jwt.js";
import Cuenta from "../models/plataforma/Cuenta.js";

export async function requiereAuth(req, res, next) {
  const m = String(req.headers.authorization ?? "").match(/^Bearer\s+(.+)$/i);
  // EventSource (telefonía SSE) no puede enviar cabeceras: acepta ?sesion=
  const token = m?.[1]
    ?? (req.query.sesion ? String(req.query.sesion) : null)
    ?? (req.query.wa ? String(req.query.wa) : null);
  const payload = token ? verificarToken(token) : null;
  if (!payload) {
    return res.status(401).json({ error: "Sesión no válida o caducada. Inicia sesión de nuevo." });
  }
  if (payload.tipo === "whatsapp-documento") {
    const rutaPermitida = `/documentos/${payload.documentoTipo}/${payload.documentoId}/pdf`;
    if (req.path !== rutaPermitida || !payload.db) {
      return res.status(401).json({ error: "Enlace de documento no válido." });
    }
    req.usuario = payload;
    return next();
  }
  try {
    // Sesión única: si el usuario entró desde otro dispositivo después, este
    // token lleva un sid antiguo y se rechaza.
    const cuenta = await Cuenta.findById(payload.sub).select("sesion activa").lean();
    if (!cuenta || !cuenta.activa || cuenta.sesion !== payload.sid) {
      return res.status(401).json({ error: "Esta sesión se cerró: se ha iniciado sesión desde otro dispositivo." });
    }
  } catch {
    return res.status(503).json({ error: "No se pudo verificar la sesión. Inténtalo de nuevo." });
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

export function requiereSuperAdmin(req, res, next) {
  if (!req.usuario || !req.usuario.superadmin) {
    return res.status(403).json({ error: "Se requiere superadministrador de plataforma" });
  }
  next();
}
