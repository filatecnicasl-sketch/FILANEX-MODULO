import { Router } from "express";
import Aseguradora from "../models/Aseguradora.js";
import Valoracion from "../models/Valoracion.js";
import OrdenTrabajo from "../models/OrdenTrabajo.js";

// CRUD de compañías aseguradoras (Taller). Se monta dentro del router de
// taller, que ya aplica el guard requiereModulo("taller").
const router = Router();

const CAMPOS = [
  "nombre", "nif", "telefono", "email", "contacto",
  "calle", "ciudad", "cp",
  "precioHoraMO", "dtoManoObra", "dtoMateriales", "dtoTotal",
  "notas",
];

function limpiar(body) {
  const datos = {};
  for (const c of CAMPOS) {
    if (body[c] === undefined) continue;
    if (["precioHoraMO", "dtoManoObra", "dtoMateriales", "dtoTotal"].includes(c)) {
      datos[c] = Math.max(0, Number(body[c]) || 0);
    } else {
      datos[c] = String(body[c]).trim() || undefined;
    }
  }
  return datos;
}

router.get("/", async (req, res, next) => {
  try {
    const lista = await Aseguradora.find().sort({ nombre: 1 }).limit(200);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const datos = limpiar(req.body);
    if (!datos.nombre) return res.status(400).json({ error: "El nombre es obligatorio" });
    const duplicada = await Aseguradora.findOne({ nombre: new RegExp(`^${datos.nombre}$`, "i") });
    if (duplicada) return res.status(409).json({ error: "Ya existe una aseguradora con ese nombre" });
    const aseguradora = await Aseguradora.create(datos);
    res.status(201).json(aseguradora);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const datos = limpiar(req.body);
    if (datos.nombre === undefined && req.body.nombre !== undefined) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }
    const aseguradora = await Aseguradora.findByIdAndUpdate(req.params.id, datos, {
      new: true,
      omitUndefined: true,
    });
    if (!aseguradora) return res.status(404).json({ error: "Aseguradora no encontrada" });
    res.json(aseguradora);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const [enValoraciones, enOrdenes] = await Promise.all([
      Valoracion.countDocuments({ aseguradora: req.params.id }),
      OrdenTrabajo.countDocuments({ aseguradora: req.params.id }),
    ]);
    if (enValoraciones + enOrdenes > 0) {
      return res.status(409).json({
        error: `No se puede borrar: tiene ${enValoraciones} valoración(es) y ${enOrdenes} orden(es) vinculadas`,
      });
    }
    const aseguradora = await Aseguradora.findByIdAndDelete(req.params.id);
    if (!aseguradora) return res.status(404).json({ error: "Aseguradora no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
