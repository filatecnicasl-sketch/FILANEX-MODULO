// Consulta del registro de auditoría (solo administradores de la empresa).
import { Router } from "express";
import { Auditoria } from "../models/Auditoria.js";
import { requiereRol } from "../middleware/auth.js";

const router = Router();

// GET /api/auditoria?q=texto&usuario=<id>&pagina=1
router.get("/", requiereRol("admin"), async (req, res, next) => {
  try {
    const { q = "", usuario, pagina = 1 } = req.query;
    const filtro = {};
    if (usuario) filtro.usuario = usuario;
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filtro.$or = [{ ruta: rx }, { nombre: rx }, { email: rx }];
    }
    const porPagina = 50;
    const saltar = (Math.max(1, Number(pagina)) - 1) * porPagina;
    const [items, total] = await Promise.all([
      Auditoria.find(filtro).sort({ createdAt: -1 }).skip(saltar).limit(porPagina).lean(),
      Auditoria.countDocuments(filtro),
    ]);
    res.json({ items, total, pagina: Number(pagina), porPagina });
  } catch (err) {
    next(err);
  }
});

export default router;
