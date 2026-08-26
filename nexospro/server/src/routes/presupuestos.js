import { Router } from "express";
import Presupuesto from "../models/Presupuesto.js";
import FacturaVenta from "../models/FacturaVenta.js";
import AlbaranVenta from "../models/AlbaranVenta.js";
import Empresa from "../models/Empresa.js";
import { calcularTotales, limpiarLineas } from "../services/totales.js";
import { metodoPagoDefecto } from "../services/metodos-pago.js";
import { tomarNumero } from "../services/numeracion.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const lista = await Presupuesto.find()
      .populate("cliente", "nombre nif")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { cliente } = req.body;
    const lineas = limpiarLineas(req.body.lineas);
    if (!cliente || !lineas) {
      return res.status(400).json({ error: "cliente y al menos una línea con descripción son obligatorios" });
    }
    const empresa = await Empresa.findOne();
    if (!empresa) return res.status(503).json({ error: "No hay empresa configurada" });

    const { numero, serieNumero } = tomarNumero(empresa, "presupuestoVenta");
    await empresa.save();

    const presupuesto = await Presupuesto.create({
      ...req.body,
      lineas,
      ...calcularTotales(lineas),
      empresa: empresa._id,
      numero,
      serieNumero,
    });
    res.status(201).json(presupuesto);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/estado", async (req, res, next) => {
  try {
    const { estado } = req.body;
    if (!["enviado", "aceptado", "rechazado"].includes(estado)) {
      return res.status(400).json({ error: "estado debe ser enviado, aceptado o rechazado" });
    }
    const p = await Presupuesto.findByIdAndUpdate(req.params.id, { estado }, { new: true });
    if (!p) return res.status(404).json({ error: "Presupuesto no encontrado" });
    res.json(p);
  } catch (err) {
    next(err);
  }
});

// Convierte el presupuesto en factura (borrador lista para emitir).
router.post("/:id/facturar", async (req, res, next) => {
  try {
    const p = await Presupuesto.findById(req.params.id);
    if (!p) return res.status(404).json({ error: "Presupuesto no encontrado" });
    if (p.estado === "facturado") {
      return res.status(409).json({ error: "El presupuesto ya está facturado" });
    }
    const empresa = await Empresa.findById(p.empresa) ?? (await Empresa.findOne());
    const factura = await FacturaVenta.create({
      empresa: p.empresa,
      cliente: p.cliente,
      direccionEntrega: p.direccionEntrega,
      lineas: p.lineas,
      baseImponible: p.baseImponible,
      cuotaIva: p.cuotaIva,
      total: p.total,
      metodoPago: metodoPagoDefecto(empresa),
      vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      origen: { presupuesto: p._id, presupuestos: [p._id] },
    });
    p.estado = "facturado";
    p.facturaVenta = factura._id;
    await p.save();
    res.status(201).json(factura);
  } catch (err) {
    next(err);
  }
});

// Convierte el presupuesto en albarán de venta (pendiente de facturar).
router.post("/:id/albaran", async (req, res, next) => {
  try {
    const p = await Presupuesto.findById(req.params.id);
    if (!p) return res.status(404).json({ error: "Presupuesto no encontrado" });
    if (p.facturaVenta) return res.status(409).json({ error: "El presupuesto ya está facturado" });
    if (p.albaranVenta) return res.status(409).json({ error: "El presupuesto ya tiene albarán" });
    const empresa = await Empresa.findById(p.empresa) ?? (await Empresa.findOne());
    if (!empresa) return res.status(503).json({ error: "No hay empresa configurada" });
    const { serie, numero, serieNumero } = tomarNumero(empresa, "albaranVenta");
    await empresa.save();
    const albaran = await AlbaranVenta.create({
      empresa: p.empresa,
      cliente: p.cliente,
      direccionEntrega: p.direccionEntrega,
      lineas: p.lineas,
      notas: p.notas,
      serie,
      numero,
      serieNumero,
      origen: { presupuesto: p._id, presupuestos: [p._id] },
    });
    p.albaranVenta = albaran._id;
    await p.save();
    res.status(201).json(albaran);
  } catch (err) {
    next(err);
  }
});

export default router;
