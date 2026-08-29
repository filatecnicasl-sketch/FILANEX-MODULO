// Copias de seguridad de la empresa (Ajustes → Copias): generar, listar,
// descargar y borrar. Solo administradores: la copia contiene todos los
// datos de la empresa y su descarga queda registrada en la auditoría.
import { Router } from "express";
import { requiereRol } from "../middleware/auth.js";
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
// junto con la ubicación donde se están guardando.
router.get("/", async (req, res, next) => {
  try {
    res.json({
      almacen: almacenCopias(),
      copias: await listarCopias(req.contextoEmpresa.slug),
    });
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
