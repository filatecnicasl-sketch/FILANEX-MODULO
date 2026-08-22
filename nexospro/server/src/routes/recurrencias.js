import { Router } from "express";
import Recurrencia from "../models/Recurrencia.js";
import FacturaVenta from "../models/FacturaVenta.js";
import Empresa from "../models/Empresa.js";
import { calcularTotales, limpiarLineas } from "../services/totales.js";

const router = Router();

function siguienteEmision(rec, desde = new Date()) {
  const meses = { mensual: 1, trimestral: 3, anual: 12 }[rec.periodicidad] ?? 1;
  const d = new Date(desde);
  d.setMonth(d.getMonth() + meses);
  d.setDate(Math.min(rec.diaEmision ?? 1, 28));
  return d;
}

router.get("/", async (req, res, next) => {
  try {
    const lista = await Recurrencia.find()
      .populate("cliente", "nombre nif")
      .sort({ proximaEmision: 1 })
      .limit(200);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { cliente, concepto, proximaEmision } = req.body;
    const lineas = limpiarLineas(req.body.lineas);
    if (!cliente || !concepto || !lineas || !proximaEmision) {
      return res.status(400).json({ error: "cliente, concepto, líneas con descripción y proximaEmision son obligatorios" });
    }
    const empresa = await Empresa.findOne();
    const rec = await Recurrencia.create({ ...req.body, lineas, empresa: empresa?._id });
    res.status(201).json(rec);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/activar", async (req, res, next) => {
  try {
    const rec = await Recurrencia.findById(req.params.id);
    if (!rec) return res.status(404).json({ error: "Recurrencia no encontrada" });
    rec.activa = !rec.activa;
    await rec.save();
    res.json(rec);
  } catch (err) {
    next(err);
  }
});

// Genera facturas borrador para todas las recurrencias activas vencidas.
router.post("/generar", async (req, res, next) => {
  try {
    const ahora = new Date();
    const pendientes = await Recurrencia.find({ activa: true, proximaEmision: { $lte: ahora } });
    const generadas = [];
    for (const rec of pendientes) {
      const factura = await FacturaVenta.create({
        empresa: rec.empresa,
        cliente: rec.cliente,
        lineas: rec.lineas,
        ...calcularTotales(rec.lineas),
        vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        origen: { recurrencia: rec._id },
      });
      generadas.push(factura);
      rec.proximaEmision = siguienteEmision(rec, rec.proximaEmision);
      // Si quedó muy atrasada, avanza hasta futuro (una factura por periodo ya generada).
      while (rec.proximaEmision <= ahora) {
        rec.proximaEmision = siguienteEmision(rec, rec.proximaEmision);
      }
      await rec.save();
    }
    res.json({ generadas: generadas.length, facturas: generadas });
  } catch (err) {
    next(err);
  }
});

export default router;
