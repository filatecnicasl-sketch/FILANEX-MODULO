import { Router } from "express";
import EstudioEnergia, { calcularCosteAnual } from "../models/EstudioEnergia.js";
import Suministro from "../models/Suministro.js";
import Comercializadora from "../models/Comercializadora.js";
import Tramite from "../models/Tramite.js";

// Estudios de ahorro (Energía). Se monta dentro del router de energia, que
// ya aplica el guard requiereModulo("energia"). Al aceptar un estudio se
// abre solo el trámite de alta/cambio sobre el CUPS.
const router = Router();

const NUMERICOS = [
  "consumoAnual", "potenciaPunta", "potenciaValle",
  "precioEnergiaActual", "precioPotenciaPuntaActual", "precioPotenciaValleActual",
  "precioEnergiaPropuesta", "precioPotenciaPuntaPropuesta", "precioPotenciaVallePropuesta",
  "costeAnualActual", "costeAnualPropuesta",
];

function limpiar(body) {
  const datos = {};
  const texto = ["tipo", "comercializadoraActual", "tarifaActual", "tarifaPropuesta", "notas"];
  for (const c of texto) if (body[c] !== undefined) datos[c] = body[c];
  for (const n of NUMERICOS) {
    if (body[n] !== undefined) datos[n] = Math.max(0, Number(body[n]) || 0);
  }
  return datos;
}

// Recalcula costes y ahorro. Si hay componentes, el coste sale de ellos;
// si no, se respeta el coste anual tecleado a mano (factura real).
function recalcular(datos, previo = {}) {
  const m = { ...previo, ...datos };
  const hayComponentesActual = (m.consumoAnual > 0 && m.precioEnergiaActual > 0);
  const hayComponentesPropuesta = (m.consumoAnual > 0 && m.precioEnergiaPropuesta > 0);
  if (hayComponentesActual && datos.costeAnualActual === undefined) {
    m.costeAnualActual = calcularCosteAnual(
      m.consumoAnual, m.precioEnergiaActual,
      m.potenciaPunta, m.precioPotenciaPuntaActual,
      m.potenciaValle, m.precioPotenciaValleActual
    );
  }
  if (hayComponentesPropuesta && datos.costeAnualPropuesta === undefined) {
    m.costeAnualPropuesta = calcularCosteAnual(
      m.consumoAnual, m.precioEnergiaPropuesta,
      m.potenciaPunta, m.precioPotenciaPuntaPropuesta,
      m.potenciaValle, m.precioPotenciaVallePropuesta
    );
  }
  m.ahorroAnual = Math.round(((m.costeAnualActual || 0) - (m.costeAnualPropuesta || 0)) * 100) / 100;
  m.ahorroPorcentaje = m.costeAnualActual > 0
    ? Math.round((m.ahorroAnual / m.costeAnualActual) * 1000) / 10
    : 0;
  return m;
}

async function denormalizar(datos) {
  if (datos.suministro) {
    const s = await Suministro.findById(datos.suministro).lean();
    if (!s) throw Object.assign(new Error("El suministro indicado no existe"), { status: 400 });
    datos.cups = s.cups;
    datos.tipo = datos.tipo ?? s.tipo;
    if (s.cliente && !datos.cliente) {
      datos.cliente = s.cliente;
      datos.clienteNombre = s.clienteNombre;
    }
  }
  if (datos.cliente) {
    const { default: Cliente } = await import("../models/Cliente.js");
    const c = await Cliente.findById(datos.cliente).lean();
    if (!c) throw Object.assign(new Error("El cliente indicado no existe"), { status: 400 });
    datos.clienteNombre = c.nombre;
  }
  if (datos.comercializadora) {
    const com = await Comercializadora.findById(datos.comercializadora).lean();
    if (!com) throw Object.assign(new Error("La comercializadora de la propuesta no existe"), { status: 400 });
    datos.comercializadoraNombre = com.nombre;
  }
  return datos;
}

router.get("/", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.estado) filtro.estado = req.query.estado;
    const lista = await EstudioEnergia.find(filtro)
      .sort({ createdAt: -1 })
      .populate("cliente", "nombre grupo")
      .limit(500);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

// Prefill desde un suministro: para abrir el estudio con los datos del CUPS.
router.get("/desde-suministro/:id", async (req, res, next) => {
  try {
    const s = await Suministro.findById(req.params.id).lean();
    if (!s) return res.status(404).json({ error: "Suministro no encontrado" });
    res.json({
      suministro: s._id,
      cups: s.cups,
      tipo: s.tipo,
      cliente: s.cliente,
      clienteNombre: s.clienteNombre,
      comercializadoraActual: s.comercializadoraNombre,
      tarifaActual: s.tarifa,
      consumoAnual: s.consumoAnual,
      potenciaPunta: s.potenciaPunta,
      potenciaValle: s.potenciaValle,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const datos = limpiar(req.body);
    if (req.body.suministro) datos.suministro = req.body.suministro;
    if (req.body.cliente) datos.cliente = req.body.cliente;
    if (req.body.comercializadora) datos.comercializadora = req.body.comercializadora;
    if (!datos.comercializadora) {
      return res.status(400).json({ error: "Elige la comercializadora de la propuesta" });
    }
    await denormalizar(datos);
    const m = recalcular(datos);
    const estudio = await EstudioEnergia.create(m);
    res.status(201).json(estudio);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const estudio = await EstudioEnergia.findById(req.params.id);
    if (!estudio) return res.status(404).json({ error: "Estudio no encontrado" });
    if (estudio.estado === "aceptado") {
      return res.status(400).json({ error: "Un estudio aceptado no se puede editar" });
    }
    const datos = limpiar(req.body);
    if (req.body.suministro !== undefined) datos.suministro = req.body.suministro || undefined;
    if (req.body.cliente !== undefined) datos.cliente = req.body.cliente || undefined;
    if (req.body.comercializadora !== undefined) datos.comercializadora = req.body.comercializadora || undefined;
    await denormalizar(datos);
    const m = recalcular(datos, estudio.toObject());
    Object.assign(estudio, m);
    await estudio.save();
    res.json(estudio);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// Cambiar de estado. Enviado/rechazado solo apuntan fechas; aceptado abre el
// trámite de cambio de comercializadora (o alta si el CUPS no tiene).
router.post("/:id/estado", async (req, res, next) => {
  try {
    const { estado } = req.body;
    if (!["borrador", "enviado", "aceptado", "rechazado"].includes(estado)) {
      return res.status(400).json({ error: "Estado no válido" });
    }
    const estudio = await EstudioEnergia.findById(req.params.id);
    if (!estudio) return res.status(404).json({ error: "Estudio no encontrado" });
    if (estudio.estado === "aceptado") {
      return res.status(400).json({ error: "Un estudio aceptado no puede cambiar de estado" });
    }
    estudio.estado = estado;
    if (estado === "enviado") estudio.fechaEnvio = new Date();
    if (estado === "aceptado" || estado === "rechazado") estudio.fechaRespuesta = new Date();

    if (estado === "aceptado") {
      if (!estudio.suministro) {
        return res.status(400).json({
          error: "Para aceptarlo el estudio tiene que estar ligado a un suministro (edítalo y elige el CUPS)",
        });
      }
      const s = await Suministro.findById(estudio.suministro).lean();
      if (!s) return res.status(400).json({ error: "El suministro del estudio ya no existe" });
      const tramite = await Tramite.create({
        tipo: s.comercializadora ? "cambio" : "alta",
        suministro: s._id,
        cups: s.cups,
        cliente: s.cliente,
        clienteNombre: s.clienteNombre,
        comercializadoraOrigen: s.comercializadoraNombre,
        comercializadoraDestino: estudio.comercializadora,
        comercializadoraDestinoNombre: estudio.comercializadoraNombre,
        estado: "documentacion",
        notas: `Estudio de ahorro aceptado (ahorro ${estudio.ahorroAnual} €/año, ${estudio.ahorroPorcentaje}%)`,
        historia: [{ estado: "documentacion", nota: "Abierto automáticamente al aceptar el estudio de ahorro" }],
      });
      estudio.tramite = tramite._id;
    }

    await estudio.save();
    res.json(estudio);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const estudio = await EstudioEnergia.findById(req.params.id);
    if (!estudio) return res.status(404).json({ error: "Estudio no encontrado" });
    if (estudio.estado === "aceptado") {
      return res.status(400).json({ error: "Un estudio aceptado no se puede borrar (tiene un trámite abierto)" });
    }
    await estudio.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
