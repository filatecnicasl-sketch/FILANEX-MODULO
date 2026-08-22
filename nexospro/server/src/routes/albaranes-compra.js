import { Router } from "express";
import AlbaranCompra, { ESTADOS_ALBARAN_COMPRA } from "../models/AlbaranCompra.js";
import FacturaCompra from "../models/FacturaCompra.js";
import OrdenTrabajo from "../models/OrdenTrabajo.js";
import Empresa from "../models/Empresa.js";
import { calcularTotales } from "../services/totales.js";
import { tomarNumero } from "../services/numeracion.js";
import { requiereModulo } from "../config/modulos.js";

const router = Router();

// Siguiente número interno de albarán de compra, según la serie por defecto.
async function siguienteNumero() {
  const empresa = await Empresa.findOne();
  if (!empresa) throw new Error("No hay empresa configurada");
  const { serieNumero } = tomarNumero(empresa, "albaranCompra");
  await empresa.save();
  return serieNumero;
}

router.get("/", async (req, res, next) => {
  try {
    const filtro = req.query.estado ? { estado: req.query.estado } : {};
    const lista = await AlbaranCompra.find(filtro)
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
    const { proveedor, numeroAlbaran, fecha, estado } = req.body;
    if (!proveedor) return res.status(400).json({ error: "El proveedor es obligatorio" });
    const lineas = Array.isArray(req.body.lineas) ? req.body.lineas.filter((l) => l.descripcion) : [];
    if (lineas.length === 0) return res.status(400).json({ error: "Añade al menos una línea" });
    if (estado !== undefined && !ESTADOS_ALBARAN_COMPRA.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_ALBARAN_COMPRA.join(", ")}` });
    }

    const numero = await siguienteNumero();
    const totales = calcularTotales(lineas);
    const albaran = await AlbaranCompra.create({
      numero,
      proveedor,
      numeroAlbaran: numeroAlbaran || undefined,
      fecha: fecha ? new Date(fecha) : undefined,
      lineas,
      ...totales,
      estado: estado ?? "confirmado",
    });
    res.status(201).json(await albaran.populate("proveedor", "nombre nif"));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const albaran = await AlbaranCompra.findById(req.params.id);
    if (!albaran) return res.status(404).json({ error: "Albarán no encontrado" });
    if (albaran.estado === "facturado") {
      return res.status(409).json({ error: "El albarán ya está facturado" });
    }

    const { proveedor, numeroAlbaran, fecha, estado } = req.body;
    if (estado !== undefined && !ESTADOS_ALBARAN_COMPRA.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_ALBARAN_COMPRA.join(", ")}` });
    }
    if (proveedor !== undefined) albaran.proveedor = proveedor;
    if (numeroAlbaran !== undefined) albaran.numeroAlbaran = numeroAlbaran || undefined;
    if (fecha !== undefined) albaran.fecha = fecha ? new Date(fecha) : albaran.fecha;
    if (estado !== undefined) albaran.estado = estado;
    if (Array.isArray(req.body.lineas)) {
      albaran.lineas = req.body.lineas.filter((l) => l.descripcion);
      Object.assign(albaran, calcularTotales(albaran.lineas));
    }
    await albaran.save();
    res.json(await albaran.populate("proveedor", "nombre nif"));
  } catch (err) {
    next(err);
  }
});

// Llega la factura del proveedor: el albarán se convierte en factura de
// compra pendiente de revisión (mismo flujo de validación que el OCR).
router.post("/:id/pasar-a-factura", async (req, res, next) => {
  try {
    const albaran = await AlbaranCompra.findById(req.params.id);
    if (!albaran) return res.status(404).json({ error: "Albarán no encontrado" });
    if (albaran.estado === "facturado" || albaran.facturaCompra) {
      return res.status(409).json({ error: "Este albarán ya tiene factura" });
    }

    const factura = await FacturaCompra.create({
      proveedor: albaran.proveedor,
      fechaExpedicion: req.body.fecha ? new Date(req.body.fecha) : new Date(),
      numeroFacturaProveedor: req.body.numeroFacturaProveedor || undefined,
      lineas: albaran.lineas,
      baseImponible: albaran.baseImponible,
      cuotaIva: albaran.cuotaIva,
      total: albaran.total,
      estado: "pendiente_revision",
      origen: "manual",
      albaranes: [albaran._id],
    });

    albaran.estado = "facturado";
    albaran.facturaCompra = factura._id;
    await albaran.save();

    res.status(201).json({
      albaran: await albaran.populate("proveedor", "nombre nif"),
      factura: await factura.populate("proveedor", "nombre nif"),
    });
  } catch (err) {
    next(err);
  }
});

// Manda las líneas marcadas del albarán a una orden de reparación como
// material. La trazabilidad queda en ambos lados (albarán ↔ orden).
// El precio copiado es el de compra: el de venta se ajusta en la orden.
router.post("/:id/enviar-a-orden", requiereModulo("taller"), async (req, res, next) => {
  try {
    const albaran = await AlbaranCompra.findById(req.params.id);
    if (!albaran) return res.status(404).json({ error: "Albarán no encontrado" });
    const { ordenId, indices } = req.body;
    if (!ordenId) return res.status(400).json({ error: "Elige la orden de reparación" });
    if (!Array.isArray(indices) || indices.length === 0) {
      return res.status(400).json({ error: "Marca al menos una línea" });
    }
    const orden = await OrdenTrabajo.findById(ordenId);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    if (orden.factura) {
      return res.status(409).json({ error: "La orden ya está facturada: no admite más líneas" });
    }

    const seleccionadas = [...new Set(indices.map(Number))]
      .map((i) => albaran.lineas[i])
      .filter(Boolean);
    if (seleccionadas.length === 0) {
      return res.status(400).json({ error: "Las líneas marcadas no existen en el albarán" });
    }

    orden.lineas.push(
      ...seleccionadas.map((l) => ({
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        iva: l.iva,
        tipo: "material",
      }))
    );
    orden.total = calcularTotales(orden.lineas).total;
    orden.albaranesCompra.push({ albaran: albaran._id, numero: albaran.numero });
    await orden.save();

    albaran.ordenesTaller.push({
      orden: orden._id,
      numeroOrden: orden.numero,
      lineas: seleccionadas.length,
    });
    await albaran.save();

    res.json({ orden, enviadas: seleccionadas.length });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const albaran = await AlbaranCompra.findByIdAndDelete(req.params.id);
    if (!albaran) return res.status(404).json({ error: "Albarán no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
