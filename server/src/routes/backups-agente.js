// Ruta PÚBLICA del agente de copia local: el PC del cliente descarga su
// última copia de seguridad autenticándose con el token de copia (cabecera
// X-Backup-Token), sin sesión interactiva. Solo permite LEER la última copia
// de la empresa dueña del token: no lista otras empresas ni borra nada.
import { Router } from "express";
import crypto from "node:crypto";
import Tenant from "../models/plataforma/Tenant.js";
import { listarCopias, descargarCopia } from "../services/backup.js";

const router = Router();

async function tenantPorToken(req) {
  const token = req.get("X-Backup-Token") ?? "";
  if (!token.startsWith("fbk_") || token.length < 20) return null;
  const tenant = await Tenant.findOne({ copiaToken: token }).lean();
  if (!tenant || ["inactivo", "suspendido"].includes(tenant.estado)) return null;
  // Comparación en tiempo constante para no filtrar información del token.
  const a = Buffer.from(token);
  const b = Buffer.from(tenant.copiaToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return tenant;
}

// GET /api/backups-agente/ultima — metadatos de la copia más reciente.
router.get("/ultima", async (req, res, next) => {
  try {
    const tenant = await tenantPorToken(req);
    if (!tenant) return res.status(401).json({ error: "Token de copia no válido" });
    const copias = await listarCopias(tenant.slug);
    if (!copias.length) return res.status(404).json({ error: "Todavía no hay copias" });
    const { archivo, tamano, fecha, origen } = copias[0];
    res.json({ empresa: tenant.slug, archivo, tamano, fecha, origen });
  } catch (err) {
    next(err);
  }
});

// GET /api/backups-agente/ultima/descargar — descarga el ZIP más reciente.
router.get("/ultima/descargar", async (req, res, next) => {
  try {
    const tenant = await tenantPorToken(req);
    if (!tenant) return res.status(401).json({ error: "Token de copia no válido" });
    const copias = await listarCopias(tenant.slug);
    if (!copias.length) return res.status(404).json({ error: "Todavía no hay copias" });
    const datos = await descargarCopia(tenant.slug, copias[0].archivo);
    if (!datos) return res.status(404).json({ error: "Copia no encontrada" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${copias[0].archivo}"`);
    res.send(datos);
  } catch (err) {
    next(err);
  }
});

export default router;
