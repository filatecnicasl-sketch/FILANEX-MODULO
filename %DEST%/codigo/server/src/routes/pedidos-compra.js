import { Router } from "express";
import PedidoCompra, { ESTADOS_PEDIDO_COMPRA } from "../models/PedidoCompra.js";
import AlbaranCompra from "../models/AlbaranCompra.js";
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
    const lista = await PedidoCompra.find(filtro)
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
    const { proveedor, fecha, notas } = req.body;
    if (!proveedor) return res.status(400).json({ error: "El proveedor es obligatorio" });
    const lineas = Array.isArray(req.body.lineas) ? req.body.lineas.filter((l) => l.descripcion) : [];
    if (lineas.length === 0) return res.status(400).json({ error: "Añade al menos una línea" });

    const numero = await siguienteNumero("pedidoCompra");
    const totales = calcularTotales(lineas);
    const pedido = await PedidoCompra.create({
      numero,
      proveedor,
      fecha: fecha ? new Date(fecha) : undefined,
      lineas,
      ...totales,
      notas: notas || undefined,
    });
    res.status(201).json(await pedido.populate("proveedor", "nombre nif"));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const pedido = await PedidoCompra.findById(req.params.id);
    if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });
    if (pedido.estado === "recibido") {
      return res.status(409).json({ error: "El pedido ya se pasó a albarán" });
    }

    const { proveedor, fecha, estado, notas } = req.body;
    if (estado !== undefined && !ESTADOS_PEDIDO_COMPRA.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_PEDIDO_COMPRA.join(", ")}` });
    }
    if (proveedor !== undefined) pedido.proveedor = proveedor;
    if (fecha !== undefined) pedido.fecha = fecha ? new Date(fecha) : pedido.fecha;
    if (estado !== undefined) pedido.estado = estado;
    if (notas !== undefined) pedido.notas = notas || undefined;
    if (Array.isArray(req.body.lineas)) {
      pedido.lineas = req.body.lineas.filter((l) => l.descripcion);
      Object.assign(pedido, calcularTotales(pedido.lineas));
    }
    await pedido.save();
    res.json(await pedido.populate("proveedor", "nombre nif"));
  } catch (err) {
    next(err);
  }
});

// Llega la mercancía: el pedido se convierte en albarán de compra.
router.post("/:id/pasar-a-albaran", async (req, res, next) => {
  try {
    const pedido = await PedidoCompra.findById(req.params.id);
    if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });
    if (pedido.estado === "recibido") {
      return res.status(409).json({ error: `Ya se convirtió en el albarán ${pedido.numeroAlbaran}` });
    }
    if (pedido.estado === "cancelado") {
      return res.status(409).json({ error: "El pedido está cancelado" });
    }

    const numero = await siguienteNumero("albaranCompra");
    const albaran = await AlbaranCompra.create({
      numero,
      proveedor: pedido.proveedor,
      fecha: new Date(),
      lineas: pedido.lineas,
      baseImponible: pedido.baseImponible,
      cuotaIva: pedido.cuotaIva,
      total: pedido.total,
      estado: "confirmado",
      pedido: pedido._id,
    });

    pedido.estado = "recibido";
    pedido.albaran = albaran._id;
    pedido.numeroAlbaran = albaran.numero;
    await pedido.save();

    res.status(201).json({
      pedido: await pedido.populate("proveedor", "nombre nif"),
      albaran: await albaran.populate("proveedor", "nombre nif"),
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const pedido = await PedidoCompra.findByIdAndDelete(req.params.id);
    if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
