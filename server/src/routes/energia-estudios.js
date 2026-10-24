import { Router } from "express";
import EstudioEnergia, { calcularCosteAnual } from "../models/EstudioEnergia.js";
import Suministro from "../models/Suministro.js";
import Comercializadora from "../models/Comercializadora.js";
import CampanaPrecios from "../models/CampanaPrecios.js";
import Tramite from "../models/Tramite.js";
import { extraerFacturaEnergia } from "../services/ocr-gemini.js";
import { uploadMemoria } from "../middleware/upload.js";
import { contextoTrasSubida } from "../middleware/empresa.js";

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

// OCR: lee la factura del cliente (PDF o foto) con IA y devuelve el estudio
// precargado con su situación actual (comercializadora, tarifa, consumo,
// potencias y coste anual anualizado). Nada se guarda: el usuario revisa el
// formulario y confirma.
const subida = uploadMemoria;

router.post("/ocr", subida.single("documento"), contextoTrasSubida, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Falta el fichero (campo 'documento') o el tipo no es PDF/PNG/JPG/WEBP" });
    }
    const extraccion = await extraerFacturaEnergia(req.file);

    // Avisos para el modal (lo que conviene revisar antes de guardar).
    const avisos = [...(extraccion._ocr?.avisos ?? [])];
    const confianza = extraccion.confianza ?? 0;
    if (confianza < 0.75) avisos.push(`Confianza OCR baja (${Math.round(confianza * 100)}%)`);

    const cups = String(extraccion.cups ?? "").replace(/[\s-]/g, "").toUpperCase();
    const existente = cups ? await Suministro.findOne({ cups }).lean() : null;
    if (cups && !existente) {
      avisos.push("El CUPS de la factura no está en la cartera: el estudio quedará sin vincular hasta que des de alta el suministro");
    }

    // Cliente: el del suministro; si no está, el titular de la factura si ya
    // existe como cliente (por NIF exacto).
    let clienteSugerido = null;
    const nifTitular = String(extraccion.titular?.nif ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (nifTitular && !existente?.cliente) {
      const { default: Cliente } = await import("../models/Cliente.js");
      const cli = await Cliente.findOne({ nif: nifTitular }).lean();
      if (cli) clienteSugerido = { _id: cli._id, nombre: cli.nombre };
    }

    // Coste anual actual: se anualiza el importe de la factura con los días
    // que cubre. Es el número clave del estudio: el ahorro se calcula sobre él.
    let dias = Number(extraccion.diasPeriodo) || 0;
    if (!dias && extraccion.periodoDesde && extraccion.periodoHasta) {
      dias = Math.round((new Date(extraccion.periodoHasta) - new Date(extraccion.periodoDesde)) / 86400000);
    }
    const importe = Number(extraccion.importeTotal) || 0;
    const costeAnualActual =
      importe > 0 && dias >= 20 && dias <= 400
        ? Math.round((importe * 365) / dias * 100) / 100
        : null;
    if (importe > 0 && !costeAnualActual) {
      avisos.push("No he podido anualizar el importe de la factura: apunta el coste anual a mano");
    }

    res.json({
      prefill: {
        suministro: existente?._id ?? null,
        cups,
        tipo: extraccion.tipo ?? existente?.tipo ?? "luz",
        cliente: existente?.cliente ?? clienteSugerido?._id ?? null,
        comercializadoraActual:
          existente?.comercializadoraNombre ??
          (String(extraccion.comercializadora?.nombre ?? "").trim() || null),
        tarifaActual: extraccion.tarifa ?? existente?.tarifa ?? null,
        consumoAnual: extraccion.consumoAnual ?? existente?.consumoAnual ?? null,
        potenciaPunta: extraccion.potenciaPunta ?? existente?.potenciaPunta ?? null,
        potenciaValle: extraccion.potenciaValle ?? existente?.potenciaValle ?? null,
        costeAnualActual,
      },
      factura: {
        importeTotal: importe,
        diasPeriodo: dias,
        titular: extraccion.titular ?? {},
        comercializadora: extraccion.comercializadora ?? {},
      },
      confianza,
      avisos,
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

// Comparador automático de campañas publicadas para un estudio. Devuelve tres
// opciones recomendadas: mejor precio para el cliente, mayor comisión para el
// canal (primer año estimado) y opción intermedia (equilibrio matemático entre
// ahorro y comisión).
router.post("/comparar", async (req, res, next) => {
  try {
    const tipo = req.body.tipo || "luz";
    const consumo = Number(req.body.consumoAnual) || 0;
    const pPunta = Number(req.body.potenciaPunta) || 0;
    const pValle = Number(req.body.potenciaValle) || 0;
    const costeActual = Number(req.body.costeAnualActual) || 0;

    const campanas = await CampanaPrecios.find({ estado: "publicada", tipo })
      .populate("comercializadora")
      .lean();

    const opciones = [];
    for (const c of campanas) {
      const com = c.comercializadora;
      if (!com) continue;
      const costePropuesta = calcularCosteAnual(
        consumo, c.precioEnergia || 0,
        pPunta, c.precioPotenciaPunta || 0,
        pValle, c.precioPotenciaValle || 0
      );
      const ahorro = costeActual > 0 ? Math.round((costeActual - costePropuesta) * 100) / 100 : 0;
      const cond = com.condiciones?.[tipo] || { alta: 0, mensual: 0, anual: 0 };
      const comision = Math.round(((cond.alta || 0) + (cond.mensual || 0) * 12 + (cond.anual || 0)) * 100) / 100;

      opciones.push({
        campana: c._id,
        campanaNombre: c.nombre || c.tarifa || "Propuesta",
        comercializadora: com._id,
        comercializadoraNombre: com.nombre,
        tarifa: c.tarifa || "",
        precioEnergia: c.precioEnergia || 0,
        precioEnergiaPunta: c.precioEnergiaPunta || 0,
        precioEnergiaLlano: c.precioEnergiaLlano || 0,
        precioEnergiaValle: c.precioEnergiaValle || 0,
        precioPotenciaPunta: c.precioPotenciaPunta || 0,
        precioPotenciaValle: c.precioPotenciaValle || 0,
        costeAnualPropuesta: costePropuesta,
        ahorroAnual: ahorro,
        comisionPrimerAno: comision,
      });
    }

    if (opciones.length === 0) {
      return res.json({ opciones: [], mejores: null, mensaje: "No hay campañas publicadas para este tipo de suministro." });
    }

    const positivas = opciones.filter((o) => o.ahorroAnual > 0);
    const candidatas = positivas.length > 0 ? positivas : opciones;

    const mejorPrecio = candidatas.reduce((a, b) => (a.ahorroAnual > b.ahorroAnual ? a : b));
    const mayorComision = candidatas.reduce((a, b) => (a.comisionPrimerAno > b.comisionPrimerAno ? a : b));

    let intermedia = null;
    if (positivas.length > 0) {
      const maxAhorro = Math.max(...positivas.map((o) => o.ahorroAnual), 0.01);
      const maxComision = Math.max(...positivas.map((o) => o.comisionPrimerAno), 0.01);
      intermedia = positivas.reduce((a, b) => {
        const scoreA = (a.ahorroAnual / maxAhorro) * (a.comisionPrimerAno / maxComision);
        const scoreB = (b.ahorroAnual / maxAhorro) * (b.comisionPrimerAno / maxComision);
        return scoreA > scoreB ? a : b;
      });
    }

    res.json({
      opciones,
      mejores: {
        mejorPrecio,
        mayorComision,
        intermedia,
      },
    });
  } catch (err) {
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
