// Copias de seguridad de la empresa (Ajustes → Copias): generar, listar,
// descargar y borrar. Solo administradores: la copia contiene todos los
// datos de la empresa y su descarga queda registrada en la auditoría.
import { Router } from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";
import { requiereRol } from "../middleware/auth.js";
import Tenant from "../models/plataforma/Tenant.js";
import {
  crearCopiaTenant,
  listarCopias,
  borrarCopia,
  descargarCopia,
  almacenCopias,
  PATRON_NOMBRE,
} from "../services/backup.js";

const router = Router();
router.use(requiereRol("admin"));

// GET /api/backups — copias disponibles de la empresa de la sesión,
// junto con la ubicación donde se están guardando y el estado del agente.
router.get("/", async (req, res, next) => {
  try {
    const tenant = await Tenant.findOne({ slug: req.contextoEmpresa.slug }).lean();
    res.json({
      almacen: almacenCopias(),
      copias: await listarCopias(req.contextoEmpresa.slug),
      agente: {
        token: tenant?.copiaToken ?? null,
        fecha: tenant?.copiaTokenFecha ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/backups/token — genera (o regenera) el token del agente de copia
// local. Regenerarlo invalida el anterior en todos los equipos.
router.post("/token", async (req, res, next) => {
  try {
    const token = `fbk_${crypto.randomBytes(24).toString("base64url")}`;
    await Tenant.updateOne(
      { slug: req.contextoEmpresa.slug },
      { $set: { copiaToken: token, copiaTokenFecha: new Date() } }
    );
    res.status(201).json({ token });
  } catch (err) {
    next(err);
  }
});

// GET /api/backups/agente-instalador — descarga un ZIP con el agente de copia
// local ya configurado (URL de esta instalación + token de la empresa). El
// cliente solo tiene que descomprimirlo y ejecutar el instalador.
router.get("/agente-instalador", async (req, res, next) => {
  try {
    const tenant = await Tenant.findOne({ slug: req.contextoEmpresa.slug }).lean();
    if (!tenant?.copiaToken) {
      return res.status(400).json({ error: "Primero genera el token de copia local" });
    }
    const dirAgente = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "agente");
    const urlApi = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const config = `URL=${urlApi}\r\nTOKEN=${tenant.copiaToken}\r\nCARPETA=C:\\backup\\filanex\r\nCONSERVAR=14\r\n`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="filanex-agente-copia.zip"');
    const zip = archiver("zip", { zlib: { level: 9 } });
    zip.on("error", next);
    zip.pipe(res);
    zip.file(path.join(dirAgente, "agente-copia.ps1"), { name: "agente-copia.ps1" });
    zip.file(path.join(dirAgente, "instalar-agente-copia.cmd"), { name: "instalar-agente-copia.cmd" });
    zip.append(config, { name: "agente-copia.config" });
    zip.finalize();
  } catch (err) {
    next(err);
  }
});

// POST /api/backups — genera una copia manual ahora mismo.
router.post("/", async (req, res, next) => {
  try {
    const { slug, dbName } = req.contextoEmpresa;
    const info = await crearCopiaTenant({ slug, dbName, origen: "manual" });
    res.status(201).json(info);
  } catch (err) {
    next(err);
  }
});

// GET /api/backups/:archivo/descargar — descarga el ZIP.
router.get("/:archivo/descargar", async (req, res, next) => {
  try {
    const { archivo } = req.params;
    if (!PATRON_NOMBRE.test(archivo)) {
      return res.status(400).json({ error: "Nombre de copia no válido" });
    }
    const datos = await descargarCopia(req.contextoEmpresa.slug, archivo);
    if (!datos) return res.status(404).json({ error: "Copia no encontrada" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${archivo}"`);
    res.send(datos);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/backups/:archivo
router.delete("/:archivo", async (req, res, next) => {
  try {
    await borrarCopia(req.contextoEmpresa.slug, req.params.archivo);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
