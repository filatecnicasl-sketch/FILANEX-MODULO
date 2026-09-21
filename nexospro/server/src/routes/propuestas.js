// Propuestas de mejora del programa escritas por los usuarios (Ayuda →
// Novedades → Propuestas). Cada empresa ve las suyas.
import { Router } from "express";
import multer from "multer";
import Propuesta from "../models/Propuesta.js";
import { contextoTrasSubida } from "../middleware/empresa.js";
import { guardarArchivo, urlPublica } from "../services/storage.js";
import { slugActual } from "../models/tenant.js";

const router = Router();

// Capturas de pantalla adjuntas a la propuesta (máx. 4 imágenes de 10 MB).
const subidaCapturas = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
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
