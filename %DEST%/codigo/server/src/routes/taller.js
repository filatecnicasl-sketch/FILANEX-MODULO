import { Router } from "express";
import Vehiculo from "../models/Vehiculo.js";
import OrdenTrabajo, { ESTADOS_OT } from "../models/OrdenTrabajo.js";
import Cita, { ESTADOS_CITA } from "../models/Cita.js";
import PrestamoCortesia from "../models/PrestamoCortesia.js";
import Valoracion, { ESTADOS_VALORACION } from "../models/Valoracion.js";
import Cliente from "../models/Cliente.js";
import Empresa from "../models/Empresa.js";
import FacturaVenta from "../models/FacturaVenta.js";
import { calcularTotales } from "../services/totales.js";
import { requiereModulo } from "../config/modulos.js";

const router = Router();

router.use(requiereModulo("taller"));

// ---------- Vehículos ----------
router.get("/vehiculos", async (req, res, next) => {
  try {
    const lista = await Vehiculo.find().sort({ matricula: 1 }).limit(500);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/vehiculos", async (req, res, next) => {
  try {
    const { matricula } = req.body;
    if (!matricula) return res.status(400).json({ error: "La matrícula es obligatoria" });
    const existente = await Vehiculo.findOne({ matricula: matricula.toUpperCase().trim() });
    if (existente) return res.status(409).json({ error: "Ya existe un vehículo con esa matrícula" });
    const vehiculo = await Vehiculo.create(req.body);
    res.status(201).json(vehiculo);
  } catch (err) {
    next(err);
  }
});

router.put("/vehiculos/:id", async (req, res, next) => {
  try {
    const { matricula, marca, modelo, bastidor, color, combustible, anio, km, tipo, clienteNombre, notas } = req.body;
    const vehiculo = await Vehiculo.findByIdAndUpdate(
      req.params.id,
      { matricula: matricula?.toUpperCase().trim(), marca, modelo, bastidor, color, combustible, anio, km, tipo, clienteNombre, notas },
      { new: true, omitUndefined: true }
    );
    if (!vehiculo) return res.status(404).json({ error: "Vehículo no encontrado" });
    res.json(vehiculo);
  } catch (err) {
    next(err);
  }
});

router.delete("/vehiculos/:id", async (req, res, next) => {
  try {
    const enUso = await OrdenTrabajo.countDocuments({ vehiculo: req.params.id });
    if (enUso > 0) {
      return res.status(409).json({ error: `No se puede borrar: tiene ${enUso} orden(es) de trabajo` });
    }
    const vehiculo = await Vehiculo.findByIdAndDelete(req.params.id);
    if (!vehiculo) return res.status(404).json({ error: "Vehículo no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- Órdenes de trabajo ----------
router.get("/ordenes", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.abiertas === "1") filtro.estado = { $in: ["recepcion", "en_curso"] };
    const lista = await OrdenTrabajo.find(filtro).sort({ createdAt: -1 }).limit(300);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/ordenes", async (req, res, next) => {
  try {
    const { matricula } = req.body;
    if (!matricula) return res.status(400).json({ error: "La matrícula es obligatoria" });
    const orden = await crearOrden(req.body);
    res.status(201).json(orden);
  } catch (err) {
    next(err);
  }
});

router.put("/ordenes/:id", async (req, res, next) => {
  try {
    const { estado, trabajos, motivo, km, clienteNombre, telefono, fechaEntregaPrevista, lineas } = req.body;
    if (estado !== undefined && !ESTADOS_OT.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_OT.join(", ")}` });
    }
    const cambios = { estado, trabajos, motivo, km, clienteNombre, telefono, fechaEntregaPrevista };
    if (Array.isArray(lineas)) {
      cambios.lineas = lineas.filter((l) => l.descripcion);
      cambios.total = calcularTotales(cambios.lineas).total;
    }
    const orden = await OrdenTrabajo.findByIdAndUpdate(req.params.id, cambios, { new: true, omitUndefined: true });
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    res.json(orden);
  } catch (err) {
    next(err);
  }
});

// Genera la factura (borrador) de la OT: el cobro y la emisión VeriFactu
// se hacen desde Ventas, como cualquier otra factura.
router.post("/ordenes/:id/facturar", async (req, res, next) => {
  try {
    const orden = await OrdenTrabajo.findById(req.params.id);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    if (orden.factura) return res.status(409).json({ error: "Esta orden ya tiene factura" });
    if (!["finalizado", "entregado"].includes(orden.estado)) {
      return res.status(409).json({ error: "La orden debe estar finalizada para facturarla" });
    }
    const lineas = (orden.lineas ?? []).filter((l) => l.descripcion);
    if (lineas.length === 0) {
      return res.status(400).json({ error: "La orden no tiene líneas de facturación" });
    }

    // Cliente: el vinculado o alta mínima por nombre (misma filosofía que el OCR).
    let clienteId = orden.cliente;
    if (!clienteId) {
      const nombre = orden.clienteNombre?.trim();
      if (!nombre) {
        return res.status(400).json({ error: "La orden no tiene cliente: asígnale uno antes de facturar" });
      }
      const cliente = await Cliente.findOneAndUpdate(
        { nombre },
        { nombre },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      clienteId = cliente._id;
      orden.cliente = clienteId;
    }

    const empresa = await Empresa.findOne();
    const totales = calcularTotales(lineas);
    const factura = await FacturaVenta.create({
      empresa: empresa?._id,
      cliente: clienteId,
      lineas,
      ...totales,
      descripcion: `Orden de trabajo ${orden.numero} · ${orden.matricula}`,
      vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      origen: { ordenTrabajo: orden._id },
    });

    orden.factura = factura._id;
    orden.total = totales.total;
    await orden.save();

    res.status(201).json({ orden, factura });
  } catch (err) {
    next(err);
  }
});

router.delete("/ordenes/:id", async (req, res, next) => {
  try {
    const orden = await OrdenTrabajo.findByIdAndDelete(req.params.id);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Recepción exprés: alta del vehículo (si no existe) + apertura de la OT
 * en un solo paso, con cliente existente o datos sueltos del cliente.
 */
router.post("/recepcion", async (req, res, next) => {
  try {
    const { matricula, marca, modelo, km, clienteId, nombreCliente, telefono, trabajos, motivo } = req.body;
    if (!matricula) return res.status(400).json({ error: "La matrícula es obligatoria" });

    let nombreFinal = nombreCliente || undefined;
    if (clienteId) {
      const cliente = await Cliente.findById(clienteId).lean();
      if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
      nombreFinal = cliente.nombre;
    }

    const mat = matricula.toUpperCase().trim();
    const vehiculo = await Vehiculo.findOneAndUpdate(
      { matricula: mat },
      { marca, modelo, km, cliente: clienteId || undefined, clienteNombre: nombreFinal },
      { new: true, upsert: true, omitUndefined: true, setDefaultsOnInsert: true }
    );

    const orden = await crearOrden({
      matricula: mat,
      vehiculo: vehiculo._id,
      cliente: clienteId || undefined,
      clienteNombre: nombreFinal,
      telefono,
      trabajos,
      motivo,
      km,
    });

    res.status(201).json({ vehiculo, orden });
  } catch (err) {
    next(err);
  }
});

// ---------- Citas (agenda) ----------
router.get("/citas", async (req, res, next) => {
  try {
    const filtro = {};
    const desde = req.query.desde ? diaLocal(req.query.desde) : null;
    const hasta = req.query.hasta ? diaLocal(req.query.hasta) : null;
    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = desde;
      if (hasta) filtro.fecha.$lte = finDia(hasta);
    }
    const lista = await Cita.find(filtro).sort({ fecha: 1, hora: 1 }).limit(500);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/citas", async (req, res, next) => {
  try {
    const { fecha, hora } = req.body;
    if (!fecha || !hora) return res.status(400).json({ error: "Fecha y hora son obligatorias" });
    const dia = diaLocal(fecha);
    if (!dia) return res.status(400).json({ error: "Fecha no válida" });

    let vehiculoId;
    if (req.body.matricula) {
      const v = await Vehiculo.findOne({ matricula: req.body.matricula.toUpperCase().trim() }).lean();
      if (v) vehiculoId = v._id;
    }

    const cita = await Cita.create({
      fecha: dia,
      hora,
      duracion: req.body.duracion || 60,
      clienteNombre: req.body.clienteNombre || undefined,
      telefono: req.body.telefono || undefined,
      vehiculo: vehiculoId,
      matricula: req.body.matricula?.toUpperCase().trim() || undefined,
      motivo: req.body.motivo || undefined,
      notas: req.body.notas || undefined,
    });
    res.status(201).json(cita);
  } catch (err) {
    next(err);
  }
});

router.put("/citas/:id", async (req, res, next) => {
  try {
    const { fecha, hora, duracion, clienteNombre, telefono, matricula, motivo, estado, notas } = req.body;
    if (estado !== undefined && !ESTADOS_CITA.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_CITA.join(", ")}` });
    }
    const cambios = { hora, duracion, clienteNombre, telefono, motivo, estado, notas };
    if (fecha) {
      const dia = diaLocal(fecha);
      if (!dia) return res.status(400).json({ error: "Fecha no válida" });
      cambios.fecha = dia;
    }
    if (matricula !== undefined) {
      cambios.matricula = matricula?.toUpperCase().trim() || undefined;
      if (cambios.matricula) {
        const v = await Vehiculo.findOne({ matricula: cambios.matricula }).lean();
        cambios.vehiculo = v?._id;
      } else {
        cambios.vehiculo = undefined;
      }
    }
    const cita = await Cita.findByIdAndUpdate(req.params.id, cambios, { new: true, omitUndefined: true });
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
    res.json(cita);
  } catch (err) {
    next(err);
  }
});

router.delete("/citas/:id", async (req, res, next) => {
  try {
    const cita = await Cita.findByIdAndDelete(req.params.id);
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- Vehículos de cortesía (préstamos) ----------
router.get("/cortesia", async (req, res, next) => {
  try {
    const lista = await PrestamoCortesia.find().sort({ estado: 1, fechaPrevista: 1 }).limit(300).lean();
    const hoy = diaLocal();
    res.json(lista.map((p) => ({
      ...p,
      vencido: p.estado === "activo" && new Date(p.fechaPrevista) < hoy,
    })));
  } catch (err) {
    next(err);
  }
});

router.post("/cortesia", async (req, res, next) => {
  try {
    const { vehiculoId, clienteNombre, fechaPrevista } = req.body;
    if (!vehiculoId) return res.status(400).json({ error: "Elige el vehículo de cortesía" });
    if (!clienteNombre) return res.status(400).json({ error: "El nombre del cliente es obligatorio" });
    const prevista = diaLocal(fechaPrevista);
    if (!prevista) return res.status(400).json({ error: "La fecha prevista de devolución es obligatoria" });

    const vehiculo = await Vehiculo.findById(vehiculoId).lean();
    if (!vehiculo) return res.status(404).json({ error: "Vehículo no encontrado" });
    if (vehiculo.tipo !== "cortesia") {
      return res.status(400).json({ error: `${vehiculo.matricula} no es un vehículo de cortesía` });
    }
    const enUso = await PrestamoCortesia.countDocuments({ vehiculo: vehiculoId, estado: "activo" });
    if (enUso > 0) {
      return res.status(409).json({ error: `${vehiculo.matricula} ya está prestado` });
    }

    const prestamo = await PrestamoCortesia.create({
      vehiculo: vehiculoId,
      matricula: vehiculo.matricula,
      clienteNombre,
      telefono: req.body.telefono || undefined,
      orden: req.body.ordenId || undefined,
      numeroOrden: req.body.numeroOrden || undefined,
      fechaPrevista: prevista,
      kmSalida: req.body.kmSalida ? Number(req.body.kmSalida) : undefined,
      notas: req.body.notas || undefined,
    });
    res.status(201).json(prestamo);
  } catch (err) {
    next(err);
  }
});

router.put("/cortesia/:id", async (req, res, next) => {
  try {
    const { clienteNombre, telefono, fechaPrevista, notas } = req.body;
    const cambios = { clienteNombre, telefono, notas };
    if (fechaPrevista) {
      const prevista = diaLocal(fechaPrevista);
      if (!prevista) return res.status(400).json({ error: "Fecha prevista no válida" });
      cambios.fechaPrevista = prevista;
    }
    const prestamo = await PrestamoCortesia.findByIdAndUpdate(req.params.id, cambios, { new: true, omitUndefined: true });
    if (!prestamo) return res.status(404).json({ error: "Préstamo no encontrado" });
    res.json(prestamo);
  } catch (err) {
    next(err);
  }
});

// Registrar la devolución del vehículo de cortesía.
router.post("/cortesia/:id/devolver", async (req, res, next) => {
  try {
    const prestamo = await PrestamoCortesia.findById(req.params.id);
    if (!prestamo) return res.status(404).json({ error: "Préstamo no encontrado" });
    if (prestamo.estado !== "activo") return res.status(400).json({ error: "Este préstamo ya está devuelto" });

    prestamo.estado = "devuelto";
    prestamo.fechaDevolucion = new Date();
    if (req.body.kmEntrada != null && req.body.kmEntrada !== "") {
      prestamo.kmEntrada = Number(req.body.kmEntrada);
      // Actualiza también los km del vehículo de cortesía.
      await Vehiculo.findByIdAndUpdate(prestamo.vehiculo, { km: prestamo.kmEntrada });
    }
    if (req.body.notas) prestamo.notas = req.body.notas;
    await prestamo.save();
    res.json(prestamo);
  } catch (err) {
    next(err);
  }
});

router.delete("/cortesia/:id", async (req, res, next) => {
  try {
    const prestamo = await PrestamoCortesia.findByIdAndDelete(req.params.id);
    if (!prestamo) return res.status(404).json({ error: "Préstamo no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Resumen para el panel del taller.
router.get("/panel", async (req, res, next) => {
  try {
    const hoy = diaLocal();
    const [vehiculos, abiertas, porEstado, ultimas, citasHoy, cortesiaActivos, cortesiaVencidos] = await Promise.all([
      Vehiculo.countDocuments(),
      OrdenTrabajo.countDocuments({ estado: { $in: ["recepcion", "en_curso"] } }),
      OrdenTrabajo.aggregate([{ $group: { _id: "$estado", n: { $sum: 1 } } }]),
      OrdenTrabajo.find().sort({ createdAt: -1 }).limit(6).lean(),
      Cita.find({ fecha: { $gte: hoy, $lte: finDia(hoy) }, estado: { $ne: "cancelada" } }).sort({ hora: 1 }).lean(),
      PrestamoCortesia.countDocuments({ estado: "activo" }),
      PrestamoCortesia.countDocuments({ estado: "activo", fechaPrevista: { $lt: hoy } }),
    ]);
    const estados = Object.fromEntries(porEstado.map((e) => [e._id, e.n]));
    res.json({
      vehiculos,
      ordenesAbiertas: abiertas,
      estados: {
        recepcion: estados.recepcion ?? 0,
        en_curso: estados.en_curso ?? 0,
        finalizado: estados.finalizado ?? 0,
        entregado: estados.entregado ?? 0,
      },
      ultimas,
      citasHoy,
      cortesia: { activos: cortesiaActivos, vencidos: cortesiaVencidos },
    });
  } catch (err) {
    next(err);
  }
});

// ---------- Valoraciones / peritajes ----------
router.get("/valoraciones", async (req, res, next) => {
  try {
    const lista = await Valoracion.find().sort({ createdAt: -1 }).limit(300);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/valoraciones", async (req, res, next) => {
  try {
    const { matricula } = req.body;
    if (!matricula) return res.status(400).json({ error: "La matrícula es obligatoria" });

    // Contador PER-000001 (pipeline: funciona aunque el campo no exista aún).
    const empresa = await Empresa.findOneAndUpdate(
      {},
      [{ $set: { "contadores.valoracion": { $add: [{ $ifNull: ["$contadores.valoracion", 0] }, 1] } } }],
      { new: true }
    );
    if (!empresa) return res.status(503).json({ error: "No hay empresa configurada" });
    const numero = `PER-${String(empresa.contadores.valoracion).padStart(6, "0")}`;

    const mat = matricula.toUpperCase().trim();
    const vehiculo = await Vehiculo.findOne({ matricula: mat }).lean();
    const lineas = Array.isArray(req.body.lineas) ? req.body.lineas.filter((l) => l.descripcion) : [];

    const valoracion = await Valoracion.create({
      numero,
      vehiculo: vehiculo?._id,
      matricula: mat,
      clienteNombre: req.body.clienteNombre || undefined,
      telefono: req.body.telefono || undefined,
      compania: req.body.compania || undefined,
      numeroSiniestro: req.body.numeroSiniestro || undefined,
      fechaSiniestro: req.body.fechaSiniestro ? new Date(req.body.fechaSiniestro) : undefined,
      lineas,
      total: sumarLineasValoracion(lineas),
      observaciones: req.body.observaciones || undefined,
    });
    res.status(201).json(valoracion);
  } catch (err) {
    next(err);
  }
});

router.put("/valoraciones/:id", async (req, res, next) => {
  try {
    const { matricula, clienteNombre, telefono, compania, numeroSiniestro, fechaSiniestro, estado, observaciones } = req.body;
    if (estado !== undefined && !ESTADOS_VALORACION.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_VALORACION.join(", ")}` });
    }
    const cambios = { clienteNombre, telefono, compania, numeroSiniestro, estado, observaciones };
    if (matricula !== undefined) {
      cambios.matricula = matricula?.toUpperCase().trim() || undefined;
      const v = cambios.matricula ? await Vehiculo.findOne({ matricula: cambios.matricula }).lean() : null;
      cambios.vehiculo = v?._id;
    }
    if (fechaSiniestro !== undefined) {
      cambios.fechaSiniestro = fechaSiniestro ? new Date(fechaSiniestro) : null;
    }
    if (Array.isArray(req.body.lineas)) {
      cambios.lineas = req.body.lineas.filter((l) => l.descripcion);
      cambios.total = sumarLineasValoracion(cambios.lineas);
    }
    const valoracion = await Valoracion.findByIdAndUpdate(req.params.id, cambios, { new: true, omitUndefined: true });
    if (!valoracion) return res.status(404).json({ error: "Valoración no encontrada" });
    res.json(valoracion);
  } catch (err) {
    next(err);
  }
});

// Convierte la valoración en orden de trabajo (una sola vez).
router.post("/valoraciones/:id/crear-orden", async (req, res, next) => {
  try {
    const valoracion = await Valoracion.findById(req.params.id);
    if (!valoracion) return res.status(404).json({ error: "Valoración no encontrada" });
    if (valoracion.orden) {
      return res.status(409).json({ error: `Ya tiene la orden ${valoracion.numeroOrden}` });
    }
    const orden = await crearOrden({
      matricula: valoracion.matricula,
      vehiculo: valoracion.vehiculo,
      clienteNombre: valoracion.clienteNombre,
      telefono: valoracion.telefono,
      trabajos: ["Chapa", "Pintura"],
      motivo: `Siniestro ${valoracion.numeroSiniestro ?? valoracion.numero}` +
        (valoracion.compania ? ` · ${valoracion.compania}` : ""),
    });
    valoracion.orden = orden._id;
    valoracion.numeroOrden = orden.numero;
    if (valoracion.estado === "pendiente") valoracion.estado = "valorado";
    await valoracion.save();
    res.status(201).json({ valoracion, orden });
  } catch (err) {
    next(err);
  }
});

router.delete("/valoraciones/:id", async (req, res, next) => {
  try {
    const valoracion = await Valoracion.findByIdAndDelete(req.params.id);
    if (!valoracion) return res.status(404).json({ error: "Valoración no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- helpers ----------
function diaLocal(texto) {
  const d = texto ? new Date(`${texto}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function finDia(dia) {
  const fin = new Date(dia);
  fin.setHours(23, 59, 59, 999);
  return fin;
}
function sumarLineasValoracion(lineas) {
  return Math.round(lineas.reduce((s, l) => s + (Number(l.importe) || 0), 0) * 100) / 100;
}
async function crearOrden(datos) {
  const empresa = await Empresa.findOneAndUpdate(
    {},
    { $inc: { "contadores.ordenTrabajo": 1 } },
    { new: true }
  );
  if (!empresa) throw new Error("No hay empresa configurada");
  const n = empresa.contadores.ordenTrabajo - 1;
  const numero = `OT-${String(n).padStart(6, "0")}`;

  let vehiculoId = datos.vehiculo;
  if (!vehiculoId && datos.matricula) {
    const v = await Vehiculo.findOne({ matricula: datos.matricula.toUpperCase().trim() }).lean();
    if (v) vehiculoId = v._id;
  }

  return OrdenTrabajo.create({
    numero,
    vehiculo: vehiculoId,
    matricula: datos.matricula.toUpperCase().trim(),
    cliente: datos.cliente,
    clienteNombre: datos.clienteNombre,
    telefono: datos.telefono,
    trabajos: Array.isArray(datos.trabajos) ? datos.trabajos : [],
    motivo: datos.motivo,
    km: datos.km,
  });
}

export default router;
