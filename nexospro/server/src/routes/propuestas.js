// Propuestas de mejora del programa escritas por los usuarios (Ayuda →
// Novedades → Propuestas). Cada empresa ve las suyas.
import { Router } from "express";
import Propuesta from "../models/Propuesta.js";

const router = Router();

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

router.post("/", async (req, res, next) => {
  try {
    const texto = String(req.body?.texto ?? "").trim();
    if (!texto) return res.status(400).json({ error: "Escribe la propuesta antes de enviarla" });
    const creada = await Propuesta.create({
      texto: texto.slice(0, 1000),
      usuarioNombre: req.usuario?.nombre ?? "",
      usuarioEmail: req.usuario?.email ?? "",
    });
    res.status(201).json(creada);
  } catch (err) {
    next(err);
  }
});

export default router;
