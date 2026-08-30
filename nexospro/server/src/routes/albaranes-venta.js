import { Router } from "express";
import AlbaranVenta from "../models/AlbaranVenta.js";
import FacturaVenta from "../models/FacturaVenta.js";
import Empresa from "../models/Empresa.js";
import Presupuesto from "../models/Presupuesto.js";
import { calcularTotales, limpiarLineas } from "../services/totales.js";
import { metodoPagoDefecto } from "../services/metodos-pago.js";
import { tomarNumero } from "../services/numeracion.js";
import { validarNIF, normalizarNIF } from "../services/validacion.js";
import { guardarArchivo, urlPublica } from "../services/storage.js";
import { slugActual } from "../models/tenant.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const filtro = req.query.estado ? { estado: req.query.estado } : {};
    const lista = await AlbaranVenta.find(filtro)
      .populate("cliente", "nombre nif telefono comunicaciones")
      .sort({ numero: 1 })
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

    const { numero, serieNumero } = tomarNumero(empresa, "albaranVenta");
    await empresa.save();

    const albaran = await AlbaranVenta.create({
      ...req.body,
      lineas,
      empresa: empresa._id,
      numero,
      serieNumero,
    });
    res.status(201).json(albaran);
  } catch (err) {
    next(err);
  }
});

// Edita un albarán pendiente (cliente, líneas, notas).
router.put("/:id", async (req, res, next) => {
  try {
    const albaran = await AlbaranVenta.findById(req.params.id);
    if (!albaran) return res.status(404).json({ error: "Albarán no encontrado" });
    if (albaran.estado !== "pendiente") {
      return res.status(409).json({ error: "Un albarán ya facturado no se puede modificar" });
    }
    const { cliente } = req.body;
    const lineas = limpiarLineas(req.body.lineas);
    if (!cliente || !lineas) {
      return res.status(400).json({ error: "cliente y al menos una línea con descripción son obligatorios" });
    }
    albaran.cliente = cliente;
    albaran.lineas = lineas;
    if (req.body.fecha) albaran.fecha = new Date(req.body.fecha);
    if (req.body.direccionEntrega !== undefined) albaran.direccionEntrega = req.body.direccionEntrega;
    if (req.body.notas !== undefined) albaran.notas = req.body.notas;
    await albaran.save();
    res.json(albaran);
  } catch (err) {
    next(err);
  }
});

// Borra un albarán pendiente. Uno facturado no se borra: cuelga de una factura.
router.delete("/:id", async (req, res, next) => {
  try {
    const albaran = await AlbaranVenta.findById(req.params.id);
    if (!albaran) return res.status(404).json({ error: "Albarán no encontrado" });
    if (albaran.estado !== "pendiente") {
      return res.status(409).json({ error: "Un albarán ya facturado no se puede borrar" });
    }
    await albaran.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Factura uno o varios albaranes pendientes del MISMO cliente en una sola factura.
router.post("/facturar", async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids de albaranes obligatorios" });
    }
    const albaranes = await AlbaranVenta.find({ _id: { $in: ids }, estado: "pendiente" });
    if (albaranes.length !== ids.length) {
      return res.status(409).json({ error: "Algún albarán no existe o ya está facturado" });
    }
    const clientes = new Set(albaranes.map((a) => String(a.cliente)));
    if (clientes.size > 1) {
      return res.status(400).json({ error: "Todos los albaranes deben ser del mismo cliente" });
    }

    const lineas = albaranes.flatMap((a) =>
      a.lineas.map((l) => ({ ...l.toObject(), descripcion: `[${a.serieNumero}] ${l.descripcion}` }))
    );
    const empresa = await Empresa.findOne();
    // Dirección de entrega: la del primer albarán que la tenga.
    const conEntrega = albaranes.find((a) => a.direccionEntrega?.calle);
    const idsPresupuestos = [...new Set(albaranes.flatMap((a) => [
      a.origen?.presupuesto ? String(a.origen.presupuesto) : null,
      ...(a.origen?.presupuestos ?? []).map(String),
    ]).filter(Boolean))];
    const ordenes = [...new Set(albaranes
      .map((a) => a.origen?.ordenTrabajo)
      .filter(Boolean)
      .map(String))];
    const factura = await FacturaVenta.create({
      empresa: albaranes[0].empresa,
      cliente: albaranes[0].cliente,
      direccionEntrega: conEntrega?.direccionEntrega,
      lineas,
      ...calcularTotales(lineas),
      metodoPago: metodoPagoDefecto(empresa),
      // Vencimiento por defecto: 30 días desde la creación de la factura.
      vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      origen: {
        albaranes: albaranes.map((a) => a._id),
        presupuesto: idsPresupuestos[0],
        presupuestos: idsPresupuestos,
        ordenTrabajo: ordenes.length === 1 ? ordenes[0] : undefined,
      },
    });
    await AlbaranVenta.updateMany(
      { _id: { $in: ids } },
      { estado: "facturado", facturaVenta: factura._id }
    );
    if (idsPresupuestos.length > 0) {
      await Presupuesto.updateMany(
        { _id: { $in: idsPresupuestos } },
        { estado: "facturado", facturaVenta: factura._id }
      );
    }
    res.status(201).json(factura);
  } catch (err) {
    next(err);
  }
});

// Firma de entrega del material (móvil/tableta): nombre + DNI de quien recoge
// y la imagen de la firma dibujada en pantalla. Sustituye al albarán impreso.
router.post("/:id/firma", async (req, res, next) => {
  try {
    const { nombre, dni, imagen } = req.body;
    if (!String(nombre ?? "").trim()) {
      return res.status(400).json({ error: "El nombre de quien recoge es obligatorio" });
    }
    if (!validarNIF(dni)) {
      return res.status(400).json({ error: "El DNI/NIE de quien recoge no es válido" });
    }
    const m = String(imagen ?? "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return res.status(400).json({ error: "La firma es obligatoria" });
    const buffer = Buffer.from(m[1], "base64");
    if (buffer.length > 300 * 1024) {
      return res.status(400).json({ error: "Imagen de firma demasiado grande" });
    }
    const albaran = await AlbaranVenta.findById(req.params.id);
    if (!albaran) return res.status(404).json({ error: "Albarán no encontrado" });
    if (albaran.firmaEntrega?.fecha) {
      return res.status(409).json({ error: "Este albarán ya está firmado" });
    }
    const archivo = `albaran-${albaran._id}.png`;
    const remoto = `uploads/${slugActual()}/firmas/${archivo}`;
    await guardarArchivo(remoto, buffer, "image/png");
    albaran.firmaEntrega = {
      nombre: String(nombre).trim(),
      dni: normalizarNIF(dni),
      imagen: urlPublica(remoto),
      fecha: new Date(),
    };
    await albaran.save();
    res.json(albaran.firmaEntrega);
  } catch (err) {
    next(err);
  }
});

export default router;
