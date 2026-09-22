// Propuestas de mejora del programa escritas por los usuarios (Ayuda →
// Novedades → Propuestas). Cada empresa ve las suyas; el superadministrador
// de la plataforma las ve TODAS juntas con /todas.
import { Router } from "express";
import multer from "multer";
import Propuesta from "../models/Propuesta.js";
import Tenant from "../models/plataforma/Tenant.js";
import { contextoTrasSubida } from "../middleware/empresa.js";
import { requiereSuperAdmin } from "../middleware/auth.js";
import { guardarArchivo, urlPublica } from "../services/storage.js";
import { slugActual, conexionTenant } from "../models/tenant.js";

const router = Router();

// Capturas de pantalla adjuntas a la propuesta (máx. 4 imágenes de 10 MB).
const subidaCapturas = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
});

// Buzón global del superadministrador: propuestas de TODAS las empresas,
// etiquetadas con la empresa de la que viene cada una.
router.get("/todas", requiereSuperAdmin, async (req, res, next) => {
  try {
    const tenants = await Tenant.find({ activo: { $ne: false } }).select("slug nombre dbName").lean();
    const todas = [];
    for (const t of tenants) {
      try {
        const conn = conexionTenant(t.dbName);
        const lista = await conn
          .model("Propuesta")
          .find()
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();
        for (const p of lista) {
          todas.push({ ...p, empresaSlug: t.slug, empresaNombre: t.nombre });
        }
      } catch (err) {
        console.warn(`Propuestas de ${t.slug}: ${err?.message}`);
      }
    }
    todas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(todas.slice(0, 300));
  } catch (err) {
    next(err);
  }
});

const ESTADOS = ["pendiente", "realizada", "descartada"];

// El superadministrador archiva una propuesta (realizada / descartada) o la
// reabre (pendiente). La propuesta vive en la base de datos de SU empresa,
// así que se actualiza por slug.
router.patch("/todas/:slug/:id/estado", requiereSuperAdmin, async (req, res, next) => {
  try {
    const estado = String(req.body?.estado ?? "");
    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({ error: "Estado no válido" });
    }
    const tenant = await Tenant.findOne({ slug: req.params.slug }).select("dbName").lean();
    if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });
    const doc = await conexionTenant(tenant.dbName)
      .model("Propuesta")
      .findByIdAndUpdate(req.params.id, { estado }, { new: true })
      .lean();
    if (!doc) return res.status(404).json({ error: "Propuesta no encontrada" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const propuestas = await Propuesta.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(propuestas);
  } catch (err) {
    next(err);
  }
});

router.post("/", [subidaCapturas.array("capturas", 4), contextoTrasSubida], async (req, res, next) => {
  try {
    const texto = String(req.body?.texto ?? "").trim();
    if (!texto) return res.status(400).json({ error: "Escribe la propuesta antes de enviarla" });

    const adjuntos = [];
    for (const f of req.files ?? []) {
      if (!f.mimetype.startsWith("image/")) continue;
      const ext = f.mimetype === "image/png" ? ".png" : f.mimetype === "image/webp" ? ".webp" : ".jpg";
      const archivo = `propuesta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const remoto = `uploads/${slugActual()}/propuestas/${archivo}`;
      await guardarArchivo(remoto, f.buffer, f.mimetype);
      adjuntos.push({ url: urlPublica(remoto), nombre: f.originalname || archivo });
    }

    const creada = await Propuesta.create({
      texto: texto.slice(0, 1000),
      usuarioNombre: req.usuario?.nombre ?? "",
      usuarioEmail: req.usuario?.email ?? "",
      adjuntos,
    });
    res.status(201).json(creada);
  } catch (err) {
    next(err);
  }
});

export default router;
