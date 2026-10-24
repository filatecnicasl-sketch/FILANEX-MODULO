// Auditoría de mutaciones: registra cada POST/PUT/PATCH/DELETE autenticado
// con el usuario que lo hizo, la ruta y el resultado. Nunca bloquea la
// petición: si falla el guardado, se ignora en silencio.
import { Auditoria } from "../models/Auditoria.js";

const PREFIJOS_IGNORADOS = ["/api/notificaciones"];

export function auditoria(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const ruta = req.baseUrl + req.path;
  if (PREFIJOS_IGNORADOS.some((p) => ruta.startsWith(p))) return next();

  res.on("finish", () => {
    try {
      const u = req.usuario ?? {};
      Auditoria.create({
        usuario: u.sub,
        nombre: u.nombre ?? "",
        email: u.email ?? "",
        metodo: req.method,
        ruta,
        resultado: res.statusCode,
        detalle: res.statusCode >= 400 ? String(res.locals?.mensajeError ?? "") : "",
      }).catch(() => {});
    } catch {
      /* nunca interrumpir la petición por la auditoría */
    }
  });
  next();
}
