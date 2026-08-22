import { Router } from "express";
import PresupuestoCompra, { ESTADOS_PRESUPUESTO_COMPRA } from "../models/PresupuestoCompra.js";
import PedidoCompra from "../models/PedidoCompra.js";
import Empresa from "../models/Empresa.js";
import { calcularTotales } from "../services/totales.js";
import { tomarNumero } from "../services/numeracion.js";

const router = Router();

// Siguiente número interno del documento de compra, según la serie por defecto.
async function siguienteNumero(tipo) {
  const empresa = await Empresa.findOne();
  if (!empresa) throw new Error("No hay empresa configurada");
  const { serieNumero } = tomarNumero(empresa, tipo);
  await empresa.save();
  return serieNumero;
}

router.get("/", async (req, res, next) => {
  try {
    const filtro = req.query.estado ? { estado: req.query.estado } : {};
    const lista = await PresupuestoCompra.find(filtro)
      .populate("proveedor", "nombre nif")
      .sort({ createdAt: -1 })
      .limit(300);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { proveedor, fecha, numeroPresupuestoProveedor, notas } = req.body;
    if (!proveedor) return res.status(400).json({ error: "El proveedor es obligatorio" });
    const lineas = Array.isArray(req.body.lineas) ? req.body.lineas.filter((l) => l.descripcion) : [];
    if (lineas.length === 0) return res.status(400).json({ error: "Añade al menos una línea" });

    const numero = await siguienteNumero("presupuestoCompra");
    const presupuesto = await PresupuestoCompra.create({
      numero,
      proveedor,
      numeroPresupuestoProveedor: numeroPresupuestoProveedor || undefined,
      fecha: fecha ? new Date(fecha) : undefined,
      lineas,
      ...calcularTotales(lineas),
      notas: notas || undefined,
    });
    res.status(201).json(await presupuesto.populate("proveedor", "nombre nif"));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const presupuesto = await PresupuestoCompra.findById(req.params.id);
    if (!presupuesto) return res.status(404).json({ error: "Presupuesto no encontrado" });
    if (presupuesto.estado === "aceptado") {
      return res.status(409).json({ error: "El presupuesto ya se pasó a pedido" });
    }

    const { proveedor, fecha, estado, numeroPresupuestoProveedor, notas } = req.body;
    if (estado !== undefined && !ESTADOS_PRESUPUESTO_COMPRA.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_PRESUPUESTO_COMPRA.join(", ")}` });
    }
    if (proveedor !== undefined) presupuesto.proveedor = proveedor;
    if (fecha !== undefined) presupuesto.fecha = fecha ? new Date(fecha) : presupuesto.fecha;
    if (estado !== undefined) presupuesto.estado = estado;
    if (numeroPresupuestoProveedor !== undefined) {
      presupuesto.numeroPresupuestoProveedor = numeroPresupuestoProveedor || undefined;
    }
    if (notas !== undefined) presupuesto.notas = notas || undefined;
    if (Array.isArray(req.body.lineas)) {
      presupuesto.lineas = req.body.lineas.filter((l) => l.descripcion);
      Object.assign(presupuesto, calcularTotales(presupuesto.lineas));
    }
    await presupuesto.save();
    res.json(await presupuesto.populate("proveedor", "nombre nif"));
  } catch (err) {
    next(err);
  }
});

// Aceptamos la oferta: el presupuesto se convierte en pedido de compra.
router.post("/:id/pasar-a-pedido", async (req, res, next) => {
  try {
    const presupuesto = await PresupuestoCompra.findById(req.params.id);
    if (!presupuesto) return res.status(404).json({ error: "Presupuesto no encontrado" });
    if (presupuesto.estado === "aceptado") {
      return res.status(409).json({ error: `Ya se convirtió en el pedido ${presupuesto.numeroPedido}` });
    }
    if (presupuesto.estado === "rechazado") {
      return res.status(409).json({ error: "El presupuesto está rechazado" });
    }

    const numero = await siguienteNumero("pedidoCompra");
    const pedido = await PedidoCompra.create({
      numero,
      proveedor: presupuesto.proveedor,
      fecha: new Date(),
      lineas: presupuesto.lineas,
      baseImponible: presupuesto.baseImponible,
      cuotaIva: presupuesto.cuotaIva,
      total: presupuesto.total,
      estado: "confirmado",
    });

    presupuesto.estado = "aceptado";
    presupuesto.pedido = pedido._id;
    presupuesto.numeroPedido = pedido.numero;
    await presupuesto.save();

    res.status(201).json({
      presupuesto: await presupuesto.populate("proveedor", "nombre nif"),
      pedido: await pedido.populate("proveedor", "nombre nif"),
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const presupuesto = await PresupuestoCompra.findByIdAndDelete(req.params.id);
    if (!presupuesto) return res.status(404).json({ error: "Presupuesto no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
