import { Router } from "express";
import Suministro from "../models/Suministro.js";
import Comercializadora from "../models/Comercializadora.js";

// CRUD de puntos de suministro (Energía). Se monta dentro del router de
// energia, que ya aplica el guard requiereModulo("energia").
const router = Router();

const CAMPOS = [
  "cups", "tipo", "cliente", "comercializadora", "direccion",
  "tarifa", "potenciaPunta", "potenciaValle", "consumoAnual", "estado",
  "fechaAlta", "notas",
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

export default router;
