import { Router } from "express";
import AutofacturaEnergia from "../models/AutofacturaEnergia.js";
import Comercializadora from "../models/Comercializadora.js";
import ComisionEnergia from "../models/ComisionEnergia.js";

// Autofacturas de las comercializadoras (Energía). Cada mes la
// comercializadora liquida las comisiones del canal con una autofactura; se
// registra aquí y se concilia contra lo que el programa calculó para ese
// periodo y esa comercializadora (diferencia = base autofactura - comisiones).
const router = Router();

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function limpiar(body) {
  const datos = {};
  if (body.numero !== undefined) datos.numero = String(body.numero).trim();
  if (body.periodo !== undefined) datos.periodo = body.periodo;
  if (body.fecha !== undefined) datos.fecha = body.fecha ? new Date(body.fecha) : undefined;
  if (body.notas !== undefined) datos.notas = body.notas;
  for (const n of ["base", "ivaPorcentaje"]) {
    if (body[n] !== undefined) datos[n] = Math.max(0, Number(body[n]) || 0);
  }
  return datos;
}

function validar(datos, parcial = false) {
  if (!parcial || datos.periodo !== undefined) {
    if (!PERIODO_RE.test(datos.periodo ?? "")) {
      return "Periodo no válido (formato AAAA-MM)";
    }
  }
  return null;
}

// Suma de comisiones de una comercializadora en un periodo.
async function comisionesDelPeriodo(comercializadoraId, periodo) {
  const r = await ComisionEnergia.aggregate([
    { $match: { comercializadora: comercializadoraId, periodo } },
    { $group: { _id: null, total: { $sum: "$importe" }, n: { $sum: 1 } } },
  ]);
  return { total: Math.round((r[0]?.total ?? 0) * 100) / 100, n: r[0]?.n ?? 0 };
}

router.get("/", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.periodo) filtro.periodo = req.query.periodo;
    if (req.query.estado) filtro.estado = req.query.estado;
    if (req.query.comercializadora) filtro.comercializadora = req.query.comercializadora;
    const lista = await AutofacturaEnergia.find(filtro).sort({ periodo: -1, createdAt: -1 }).limit(500).lean();
    // Conciliación: comisiones calculadas para esa comercializadora y mes.
    const enriquecida = await Promise.all(
      lista.map(async (a) => {
        const c = await comisionesDelPeriodo(a.comercializadora, a.periodo);
        return {
          ...a,
          comisionesPeriodo: c.total,
          comisionesN: c.n,
          diferencia: Math.round((a.base - c.total) * 100) / 100,
        };
      })
    );
    res.json(enriquecida);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const datos = limpiar(req.body);
    const errorValidacion = validar(datos);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });
    const com = await Comercializadora.findById(req.body.comercializadora).lean();
    if (!com) return res.status(400).json({ error: "Elige la comercializadora" });
    if (!(datos.base > 0)) return res.status(400).json({ error: "La base imponible debe ser mayor que cero" });
    datos.comercializadora = com._id;
    datos.comercializadoraNombre = com.nombre;
    datos.iva = Math.round(datos.base * (datos.ivaPorcentaje ?? 21) / 100 * 100) / 100;
    datos.total = Math.round((datos.base + datos.iva) * 100) / 100;
    const autofactura = await AutofacturaEnergia.create(datos);
    res.status(201).json(autofactura);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const autofactura = await AutofacturaEnergia.findById(req.params.id);
    if (!autofactura) return res.status(404).json({ error: "Autofactura no encontrada" });
    if (autofactura.estado === "cobrada") {
      return res.status(400).json({ error: "Una autofactura cobrada no se puede editar" });
    }
    const datos = limpiar(req.body);
    const errorValidacion = validar(datos, true);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });
    Object.assign(autofactura, datos);
    autofactura.iva = Math.round(autofactura.base * autofactura.ivaPorcentaje / 100 * 100) / 100;
    autofactura.total = Math.round((autofactura.base + autofactura.iva) * 100) / 100;
    await autofactura.save();
    res.json(autofactura);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/cobrar", async (req, res, next) => {
  try {
    const autofactura = await AutofacturaEnergia.findById(req.params.id);
    if (!autofactura) return res.status(404).json({ error: "Autofactura no encontrada" });
    if (autofactura.estado === "cobrada") {
      return res.status(400).json({ error: "La autofactura ya está cobrada" });
    }
    autofactura.estado = "cobrada";
    autofactura.fechaCobro = req.body.fecha ? new Date(req.body.fecha) : new Date();
    await autofactura.save();
    res.json(autofactura);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const autofactura = await AutofacturaEnergia.findById(req.params.id);
    if (!autofactura) return res.status(404).json({ error: "Autofactura no encontrada" });
    if (autofactura.estado === "cobrada") {
      return res.status(400).json({ error: "Una autofactura cobrada no se puede borrar" });
    }
    await autofactura.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
