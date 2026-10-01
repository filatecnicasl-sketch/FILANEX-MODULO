import { Router } from "express";
import Suministro from "../models/Suministro.js";
import Comercializadora from "../models/Comercializadora.js";
import { extraerFacturaEnergia } from "../services/ocr-gemini.js";
import { uploadMemoria } from "../middleware/upload.js";
import { contextoTrasSubida } from "../middleware/empresa.js";

// CRUD de puntos de suministro (Energía). Se monta dentro del router de
// energia, que ya aplica el guard requiereModulo("energia").
const router = Router();

const CAMPOS = [
  "cups", "tipo", "cliente", "comercializadora", "direccion",
  "tarifa", "potenciaPunta", "potenciaValle", "consumoAnual", "estado",
  "fechaAlta", "fechaFin", "notas",
];

const RE_CUPS = /^ES[0-9A-Z]{20}$/; // 22 caracteres: ES + 20

function limpiar(body) {
  const datos = {};
  for (const c of CAMPOS) {
    if (body[c] === undefined) continue;
    datos[c] = body[c];
  }
  for (const n of ["potenciaPunta", "potenciaValle", "consumoAnual"]) {
    if (datos[n] !== undefined) datos[n] = Math.max(0, Number(datos[n]) || 0);
  }
  if (datos.fechaAlta === "") datos.fechaAlta = undefined;
  if (datos.fechaAlta) datos.fechaAlta = new Date(datos.fechaAlta);
  return datos;
}

// Guarda los nombres desnormalizados a partir de las referencias.
async function denormalizar(datos) {
  if (datos.cliente === null || datos.cliente === "") {
    datos.cliente = undefined;
    datos.clienteNombre = undefined;
  } else if (datos.cliente) {
    const { default: Cliente } = await import("../models/Cliente.js");
    const c = await Cliente.findById(datos.cliente).lean();
    datos.clienteNombre = c?.nombre ?? undefined;
  }
  if (datos.comercializadora === null || datos.comercializadora === "") {
    datos.comercializadora = undefined;
    datos.comercializadoraNombre = undefined;
  } else if (datos.comercializadora) {
    const c = await Comercializadora.findById(datos.comercializadora).lean();
    datos.comercializadoraNombre = c?.nombre ?? undefined;
  }
  return datos;
}

router.get("/", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.tipo) filtro.tipo = req.query.tipo;
    if (req.query.estado) filtro.estado = req.query.estado;
    if (req.query.cliente) filtro.cliente = req.query.cliente;
    const lista = await Suministro.find(filtro)
      .sort({ cups: 1 })
      .populate("cliente", "nombre nif grupo")
      .populate("comercializadora", "nombre")
      .limit(500);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const datos = limpiar(req.body);
    if (!datos.cups) return res.status(400).json({ error: "El CUPS es obligatorio" });
    if (!RE_CUPS.test(datos.cups)) {
      return res.status(400).json({ error: "El CUPS debe tener 22 caracteres (ES + 20)" });
    }
    if (!["luz", "gas"].includes(datos.tipo)) {
      return res.status(400).json({ error: "El tipo debe ser luz o gas" });
    }
    const duplicado = await Suministro.findOne({ cups: datos.cups });
    if (duplicado) return res.status(409).json({ error: `Ya existe un suministro con el CUPS ${datos.cups}` });
    await denormalizar(datos);
    const suministro = await Suministro.create(datos);
    res.status(201).json(suministro);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const datos = limpiar(req.body);
    if (datos.cups !== undefined) {
      if (!RE_CUPS.test(datos.cups)) {
        return res.status(400).json({ error: "El CUPS debe tener 22 caracteres (ES + 20)" });
      }
      const duplicado = await Suministro.findOne({ cups: datos.cups, _id: { $ne: req.params.id } });
      if (duplicado) return res.status(409).json({ error: `Ya existe un suministro con el CUPS ${datos.cups}` });
    }
    if (datos.tipo !== undefined && !["luz", "gas"].includes(datos.tipo)) {
      return res.status(400).json({ error: "El tipo debe ser luz o gas" });
    }
    await denormalizar(datos);
    const suministro = await Suministro.findByIdAndUpdate(req.params.id, datos, {
      new: true,
      omitUndefined: true,
    });
    if (!suministro) return res.status(404).json({ error: "Suministro no encontrado" });
    res.json(suministro);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const suministro = await Suministro.findByIdAndDelete(req.params.id);
    if (!suministro) return res.status(404).json({ error: "Suministro no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Importar factura de luz/gas con IA ---
//
// El gancho del módulo: el cliente manda una foto o PDF de su factura y la
// IA extrae el suministro completo (CUPS, titular, comercializadora, tarifa,
// potencia, consumo). AQUÍ NO SE CREA NADA: se devuelve lo leído junto con
// las sugerencias (comercializadora y cliente ya existentes) para que el
// usuario lo verifique en el modal y confirme. Es el mismo criterio que el
// OCR de compras: nada se da de alta sin revisión.
const subida = uploadMemoria;

router.post("/ocr", subida.single("documento"), contextoTrasSubida, async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Falta el fichero (campo 'documento') o el tipo no es PDF/PNG/JPG/WEBP" });
    }
    const tiposValidos = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!tiposValidos.includes(req.file.mimetype)) {
      return res
        .status(400)
        .json({ error: "Falta el fichero (campo 'documento') o el tipo no es PDF/PNG/JPG/WEBP" });
    }

    const extraccion = await extraerFacturaEnergia(req.file);

    // Avisos para el modal (lo que conviene revisar antes de confirmar).
    const avisos = [...(extraccion._ocr?.avisos ?? [])];
    const confianza = extraccion.confianza ?? 0;
    if (confianza < 0.75) avisos.push(`Confianza OCR baja (${Math.round(confianza * 100)}%)`);

    // CUPS normalizado + aviso si ya existe (se ofrecerá editar el suyo).
    const cups = String(extraccion.cups ?? "").replace(/[\s-]/g, "").toUpperCase();
    const existente = cups ? await Suministro.findOne({ cups }).populate("cliente", "nombre") : null;
    if (existente) avisos.push(`El CUPS ya está dado de alta (${existente.cliente?.nombre ?? "sin cliente"})`);

    // ¿La comercializadora de la factura ya existe en la cartera?
    const nombreCom = String(extraccion.comercializadora?.nombre ?? "").trim();
    let comercializadoraSugerida = null;
    if (nombreCom) {
      const sinEspacios = nombreCom.replace(/[^0-9A-Z]/gi, "").toUpperCase();
      comercializadoraSugerida = await Comercializadora.findOne({
        nombre: { $regex: sinEspacios.split("").join("[^a-z0-9]*"), $options: "i" },
      });
    }

    // ¿El titular ya es cliente? (por NIF exacto; el modal permite buscar más)
    let clienteSugerido = null;
    const nifTitular = String(extraccion.titular?.nif ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (nifTitular) {
      const { default: Cliente } = await import("../models/Cliente.js");
      const cli = await Cliente.findOne({ nif: nifTitular });
      if (cli) clienteSugerido = { _id: cli._id, nombre: cli.nombre, grupo: cli.grupo ?? null };
    }

    res.json({
      extraccion: {
        cups,
        tipo: extraccion.tipo,
        titular: extraccion.titular ?? {},
        comercializadora: extraccion.comercializadora ?? {},
        direccionSuministro: extraccion.direccionSuministro ?? {},
        tarifa: extraccion.tarifa,
        potenciaPunta: extraccion.potenciaPunta,
        potenciaValle: extraccion.potenciaValle,
        consumoAnual: extraccion.consumoAnual,
        consumoPeriodo: extraccion.consumoPeriodo,
        diasPeriodo: extraccion.diasPeriodo,
        periodoDesde: extraccion.periodoDesde,
        periodoHasta: extraccion.periodoHasta,
        importeTotal: extraccion.importeTotal,
      },
      confianza,
      avisos,
      comercializadoraSugerida: comercializadoraSugerida
        ? { _id: comercializadoraSugerida._id, nombre: comercializadoraSugerida.nombre }
        : null,
      clienteSugerido,
      suministroExistente: existente
        ? { _id: existente._id, cups: existente.cups, cliente: existente.cliente?.nombre ?? null }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
