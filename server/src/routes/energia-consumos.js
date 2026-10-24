import { Router } from "express";
import ConsumoEnergia from "../models/ConsumoEnergia.js";
import Suministro from "../models/Suministro.js";
import { FACTOR_CO2 } from "../services/energia-stats.js";

// Consumos mensuales por punto de suministro (Energía). Un registro por mes
// y CUPS (clave única); reenviar el mismo mes lo actualiza. El listado por
// suministro devuelve además la media, el total del último año, el coste
// medio €/kWh, la desviación respecto al presupuesto anual y el CO2 estimado.
const router = Router();

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Todos los consumos de un suministro + estadísticas.
router.get("/suministro/:id", async (req, res, next) => {
  try {
    const s = await Suministro.findById(req.params.id).lean();
    if (!s) return res.status(404).json({ error: "Suministro no encontrado" });
    const lista = await ConsumoEnergia.find({ suministro: s._id }).sort({ periodo: -1 }).limit(36).lean();
    const n = lista.length;
    const mediaKwh = n > 0 ? Math.round((lista.reduce((a, c) => a + c.kwh, 0) / n) * 100) / 100 : 0;
    const ultimos12 = lista.slice(0, 12);
    const totalAnualKwh = Math.round(ultimos12.reduce((a, c) => a + c.kwh, 0) * 100) / 100;
    const totalAnualImporte = Math.round(ultimos12.reduce((a, c) => a + (c.importe || 0), 0) * 100) / 100;
    const costeMedioKwh =
      totalAnualKwh > 0 && totalAnualImporte > 0
        ? Math.round((totalAnualImporte / totalAnualKwh) * 10000) / 10000
        : null;
    const presupuestoAnual = Number(s.presupuestoAnual) || 0;
    const desviacionPresupuesto =
      presupuestoAnual > 0 ? Math.round((totalAnualImporte - presupuestoAnual) * 100) / 100 : null;
    // CO2 estimado de los últimos 12 meses según el tipo de suministro.
    const factor = FACTOR_CO2[s.tipo] ?? FACTOR_CO2.luz;
    const co2Kg = Math.round(totalAnualKwh * factor);
    res.json({
      suministro: { _id: s._id, cups: s.cups, tipo: s.tipo, clienteNombre: s.clienteNombre },
      lista,
      estadisticas: {
        n, mediaKwh, totalAnualKwh, totalAnualImporte,
        costeMedioKwh, presupuestoAnual, desviacionPresupuesto, co2Kg,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Apuntar el consumo de un mes (upsert por suministro+periodo).
router.post("/", async (req, res, next) => {
  try {
    const { suministro: suministroId, periodo, kwh, importe, origen } = req.body;
    if (!PERIODO_RE.test(periodo ?? "")) {
      return res.status(400).json({ error: "Periodo no válido (formato AAAA-MM)" });
    }
    const k = Number(kwh);
    if (!Number.isFinite(k) || k < 0) {
      return res.status(400).json({ error: "El consumo (kWh) debe ser un número igual o mayor que cero" });
    }
    const s = await Suministro.findById(suministroId).lean();
    if (!s) return res.status(400).json({ error: "El suministro indicado no existe" });
    const consumo = await ConsumoEnergia.findOneAndUpdate(
      { suministro: s._id, periodo },
      {
        $set: {
          cups: s.cups,
          kwh: k,
          importe: Math.max(0, Number(importe) || 0),
          origen: origen === "ocr" ? "ocr" : "manual",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(consumo);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const consumo = await ConsumoEnergia.findByIdAndDelete(req.params.id);
    if (!consumo) return res.status(404).json({ error: "Consumo no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
