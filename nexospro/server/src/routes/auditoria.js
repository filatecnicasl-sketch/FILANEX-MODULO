// Consulta del registro de auditoría (solo administradores de la empresa).
import { Router } from "express";
import { Auditoria } from "../models/Auditoria.js";
import { requiereRol } from "../middleware/auth.js";

const router = Router();

const rxSegura = (texto) =>
  new RegExp(String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

// GET /api/auditoria/resumen — KPIs, actividad por día y ranking de usuarios.
router.get("/resumen", requiereRol("admin"), async (req, res, next) => {
  try {
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const hace7 = new Date(inicioHoy.getTime() - 6 * 86400000);
    const hace14 = new Date(inicioHoy.getTime() - 13 * 86400000);

    const [hoy, ultimos7, porMetodo, porDia, porUsuario, errores] = await Promise.all([
      Auditoria.countDocuments({ createdAt: { $gte: inicioHoy } }),
      Auditoria.countDocuments({ createdAt: { $gte: hace7 } }),
      Auditoria.aggregate([
        { $group: { _id: "$metodo", total: { $sum: 1 } } },
      ]),
      Auditoria.aggregate([
        { $match: { createdAt: { $gte: hace14 } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Auditoria.aggregate([
        { $match: { createdAt: { $gte: hace7 } } },
        {
          $group: {
            _id: { usuario: "$usuario", nombre: "$nombre", email: "$email" },
            total: { $sum: 1 },
            errores: { $sum: { $cond: [{ $gte: ["$resultado", 400] }, 1, 0] } },
            ultima: { $max: "$createdAt" },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]),
      Auditoria.countDocuments({ resultado: { $gte: 400 }, createdAt: { $gte: hace7 } }),
    ]);

    // Rellenar los días sin actividad para que el gráfico no tenga huecos.
    const dias = [];
    const mapa = new Map(porDia.map((d) => [d._id, d.total]));
    for (let i = 13; i >= 0; i--) {
      const f = new Date(inicioHoy.getTime() - i * 86400000);
      const clave = f.toISOString().slice(0, 10);
      dias.push({ fecha: clave, total: mapa.get(clave) ?? 0 });
    }

    res.json({
      hoy,
      ultimos7,
      errores7: errores,
      porMetodo: Object.fromEntries(porMetodo.map((m) => [m._id, m.total])),
      dias,
      usuarios: porUsuario.map((u) => ({
        usuario: u._id.usuario,
        nombre: u._id.nombre,
        email: u._id.email,
        total: u.total,
        errores: u.errores,
        ultima: u.ultima,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auditoria?q=texto&usuario=<id>&metodo=POST&pagina=1
router.get("/", requiereRol("admin"), async (req, res, next) => {
  try {
    const { q = "", usuario, metodo, pagina = 1 } = req.query;
    const filtro = {};
    if (usuario) filtro.usuario = usuario;
    if (metodo) filtro.metodo = metodo;
    if (q) {
      const rx = rxSegura(q);
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
