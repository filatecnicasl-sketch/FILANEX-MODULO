import { Router } from "express";
import CanalDistribucion from "../models/CanalDistribucion.js";
import Suministro from "../models/Suministro.js";
import Comercializadora from "../models/Comercializadora.js";

// CRUD de canales de distribución (distribuidores). Un canal puede trabajar con
// varias comercializadoras. Se monta dentro del router de energía.
const router = Router();

const CAMPOS = ["nombre", "nif", "telefono", "email", "contacto", "notas"];

function normalizarIds(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(Boolean).map((id) => String(id));
}

function limpiar(body) {
  const datos = {};
  for (const c of CAMPOS) {
    if (body[c] === undefined) continue;
    datos[c] = String(body[c]).trim() || undefined;
  }
  if (body.comercializadoras !== undefined) {
    datos.comercializadoras = normalizarIds(body.comercializadoras);
  }
  return datos;
}

async function denormalizar(datos) {
  if (datos.comercializadoras?.length) {
    const coms = await Comercializadora.find({ _id: { $in: datos.comercializadoras } })
      .select("nombre")
      .lean();
    datos.comercializadoraNombres = coms.map((c) => c.nombre);
  } else if (Array.isArray(datos.comercializadoras)) {
    datos.comercializadoraNombres = [];
  }
  return datos;
}

router.get("/", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.comercializadora) {
      filtro.comercializadoras = req.query.comercializadora;
    }
    const lista = await CanalDistribucion.find(filtro)
      .populate("comercializadoras", "nombre")
      .sort({ nombre: 1 })
      .limit(500);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const datos = limpiar(req.body);
    if (!datos.nombre) return res.status(400).json({ error: "El nombre es obligatorio" });
    if (!datos.comercializadoras?.length) return res.status(400).json({ error: "Selecciona al menos una comercializadora" });
    await denormalizar(datos);
    const canal = await CanalDistribucion.create(datos);
    res.status(201).json(canal);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const datos = limpiar(req.body);
    if (!datos.nombre && req.body.nombre !== undefined) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }
    await denormalizar(datos);
    const canal = await CanalDistribucion.findByIdAndUpdate(req.params.id, datos, {
      new: true,
      omitUndefined: true,
    });
    if (!canal) return res.status(404).json({ error: "Canal no encontrado" });
    if (datos.nombre) {
      await Suministro.updateMany(
        { canalDistribucion: canal._id },
        { $set: { canalDistribucionNombre: datos.nombre } }
      );
    }
    res.json(canal);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const enSuministros = await Suministro.countDocuments({ canalDistribucion: req.params.id });
    if (enSuministros > 0) {
      return res.status(409).json({
        error: `No se puede borrar: tiene ${enSuministros} suministro(s) vinculados`,
      });
    }
    const canal = await CanalDistribucion.findByIdAndDelete(req.params.id);
    if (!canal) return res.status(404).json({ error: "Canal no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
