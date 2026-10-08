import { Router } from "express";
import CanalDistribucion from "../models/CanalDistribucion.js";
import Suministro from "../models/Suministro.js";
import Comercializadora from "../models/Comercializadora.js";

// CRUD de canales de distribución (distribuidores) de comercializadoras.
// Se monta dentro del router de energía.
const router = Router();

const CAMPOS = ["nombre", "nif", "telefono", "email", "contacto", "notas"];

function limpiar(body) {
  const datos = {};
  for (const c of CAMPOS) {
    if (body[c] === undefined) continue;
    datos[c] = String(body[c]).trim() || undefined;
  }
  if (body.comercializadora !== undefined) {
    datos.comercializadora = body.comercializadora || undefined;
  }
  return datos;
}

async function denormalizar(datos) {
  if (datos.comercializadora) {
    const c = await Comercializadora.findById(datos.comercializadora).lean();
    datos.comercializadoraNombre = c?.nombre ?? undefined;
  }
  return datos;
}

router.get("/", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.comercializadora) filtro.comercializadora = req.query.comercializadora;
    const lista = await CanalDistribucion.find(filtro)
      .populate("comercializadora", "nombre")
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
    if (!datos.comercializadora) return res.status(400).json({ error: "La comercializadora es obligatoria" });
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
    // Refrescar nombre desnormalizado en suministros.
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
