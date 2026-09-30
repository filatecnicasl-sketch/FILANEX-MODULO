import { Router } from "express";
import Comercializadora from "../models/Comercializadora.js";
import Suministro from "../models/Suministro.js";

// CRUD de comercializadoras (Energía). Se monta dentro del router de
// energia, que ya aplica el guard requiereModulo("energia").
const router = Router();

const CAMPOS = [
  "nombre", "nif", "telefono", "email", "contacto",
  "calle", "ciudad", "cp", "notas",
];

function limpiar(body) {
  const datos = {};
  for (const c of CAMPOS) {
    if (body[c] === undefined) continue;
    datos[c] = String(body[c]).trim() || undefined;
  }
  // Condiciones: importes en € separados por luz/gas.
  if (body.condiciones !== undefined) {
    const num = (v) => Math.max(0, Number(v) || 0);
    const c = body.condiciones ?? {};
    datos.condiciones = {
      luz: {
        alta: num(c.luz?.alta),
        mensual: num(c.luz?.mensual),
        anual: num(c.luz?.anual),
      },
      gas: {
        alta: num(c.gas?.alta),
        mensual: num(c.gas?.mensual),
        anual: num(c.gas?.anual),
      },
    };
  }
  return datos;
}

router.get("/", async (req, res, next) => {
  try {
    const lista = await Comercializadora.find().sort({ nombre: 1 }).limit(200);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const datos = limpiar(req.body);
    if (!datos.nombre) return res.status(400).json({ error: "El nombre es obligatorio" });
    const duplicada = await Comercializadora.findOne({ nombre: new RegExp(`^${datos.nombre}$`, "i") });
    if (duplicada) return res.status(409).json({ error: "Ya existe una comercializadora con ese nombre" });
    const comercializadora = await Comercializadora.create(datos);
    res.status(201).json(comercializadora);
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
    const comercializadora = await Comercializadora.findByIdAndUpdate(req.params.id, datos, {
      new: true,
      omitUndefined: true,
    });
    if (!comercializadora) return res.status(404).json({ error: "Comercializadora no encontrada" });
    // Si cambió el nombre, se refresca el desnormalizado de los suministros.
    if (datos.nombre) {
      await Suministro.updateMany(
        { comercializadora: comercializadora._id },
        { $set: { comercializadoraNombre: datos.nombre } }
      );
    }
    res.json(comercializadora);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const enSuministros = await Suministro.countDocuments({ comercializadora: req.params.id });
    if (enSuministros > 0) {
      return res.status(409).json({
        error: `No se puede borrar: tiene ${enSuministros} suministro(s) vinculados`,
      });
    }
    const comercializadora = await Comercializadora.findByIdAndDelete(req.params.id);
    if (!comercializadora) return res.status(404).json({ error: "Comercializadora no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
