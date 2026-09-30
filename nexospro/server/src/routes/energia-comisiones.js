import { Router } from "express";
import ComisionEnergia from "../models/ComisionEnergia.js";
import Suministro from "../models/Suministro.js";
import Comercializadora from "../models/Comercializadora.js";

// Comisiones del canal de energía. Se generan por mes a partir de los
// suministros activos y las condiciones pactadas con cada comercializadora
// (alta única, €/mes por contrato activo, recurrente anual). Llevan un
// circuito sencillo: pendiente → cobrada. Se monta dentro del router de
// energia, que ya aplica el guard requiereModulo("energia").
const router = Router();

const CONCEPTOS = ["alta", "mensual", "anual"];
const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

// Devuelve [año, mes (1-12)] de un periodo "YYYY-MM".
function partesPeriodo(periodo) {
  const [a, m] = periodo.split("-").map(Number);
  return [a, m];
}

router.get("/", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.periodo) filtro.periodo = req.query.periodo;
    if (req.query.estado) filtro.estado = req.query.estado;
    if (req.query.comercializadora) filtro.comercializadora = req.query.comercializadora;
    const lista = await ComisionEnergia.find(filtro)
      .sort({ periodo: -1, createdAt: -1 })
      .populate("cliente", "nombre grupo")
      .limit(2000);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

// Resumen para el panel: lo pendiente de cobrar y lo cobrado este mes.
router.get("/resumen", async (req, res, next) => {
  try {
    const actual = periodoActual();
    const [pendiente, cobradasMes] = await Promise.all([
      ComisionEnergia.aggregate([
        { $match: { estado: "pendiente" } },
        { $group: { _id: null, total: { $sum: "$importe" }, n: { $sum: 1 } } },
      ]),
      ComisionEnergia.aggregate([
        { $match: { estado: "cobrada", periodo: actual } },
        { $group: { _id: null, total: { $sum: "$importe" }, n: { $sum: 1 } } },
      ]),
    ]);
    res.json({
      periodo: actual,
      pendiente: { total: pendiente[0]?.total ?? 0, n: pendiente[0]?.n ?? 0 },
      cobradasMes: { total: cobradasMes[0]?.total ?? 0, n: cobradasMes[0]?.n ?? 0 },
    });
  } catch (err) {
    next(err);
  }
});

// Genera las comisiones de un mes. Reglas:
// - mensual: todo suministro activo con la comercializadora (y alta no
//   posterior al mes generado) devenga su €/mes.
// - alta: el suministro cuya fechaAlta cae en ese mes devenga el pago único.
// - anual: el suministro cuyo aniversario de alta cae en ese mes (al menos un
//   año después) devenga el recurrente anual.
// Idempotente: la clave única (suministro+concepto+periodo) evita duplicados;
// las que ya existían quedan como estaban (cobradas incluidas).
router.post("/generar", async (req, res, next) => {
  try {
    const periodo = req.body.periodo || periodoActual();
    if (!PERIODO_RE.test(periodo)) {
      return res.status(400).json({ error: "Periodo no válido (formato AAAA-MM)" });
    }
    const [anio, mes] = partesPeriodo(periodo);
    const finPeriodo = new Date(anio, mes, 0, 23, 59, 59); // último día del mes

    const [suministros, comercializadoras] = await Promise.all([
      Suministro.find({ estado: "activo", comercializadora: { $ne: null } }).lean(),
      Comercializadora.find().lean(),
    ]);
    const mapa = new Map(comercializadoras.map((c) => [String(c._id), c]));

    let creadas = 0;
    let existentes = 0;
    const ops = [];
    for (const s of suministros) {
      const com = mapa.get(String(s.comercializadora));
      const cond = com?.condiciones?.[s.tipo];
      if (!cond) continue;
      const fechaAlta = s.fechaAlta ? new Date(s.fechaAlta) : null;
      const base = {
        comercializadora: s.comercializadora,
        comercializadoraNombre: com.nombre,
        suministro: s._id,
        cups: s.cups,
        tipo: s.tipo,
        cliente: s.cliente,
        clienteNombre: s.clienteNombre,
        periodo,
      };
      const candidatas = [];
      if (cond.mensual > 0 && (!fechaAlta || fechaAlta <= finPeriodo)) {
        candidatas.push({ concepto: "mensual", importe: cond.mensual });
      }
      if (cond.alta > 0 && fechaAlta && fechaAlta.getFullYear() === anio && fechaAlta.getMonth() + 1 === mes) {
        candidatas.push({ concepto: "alta", importe: cond.alta });
      }
      if (cond.anual > 0 && fechaAlta && fechaAlta.getMonth() + 1 === mes && anio - fechaAlta.getFullYear() >= 1) {
        candidatas.push({ concepto: "anual", importe: cond.anual });
      }
      for (const c of candidatas) {
        ops.push({
          updateOne: {
            filter: { suministro: s._id, concepto: c.concepto, periodo },
            update: { $setOnInsert: { ...base, ...c } },
            upsert: true,
          },
        });
      }
    }
    if (ops.length > 0) {
      const r = await ComisionEnergia.bulkWrite(ops, { ordered: false });
      creadas = r.upsertedCount ?? 0;
      existentes = ops.length - creadas;
    }
    res.json({ ok: true, periodo, creadas, existentes });
  } catch (err) {
    next(err);
  }
});

// Alta manual (bonos puntuales o condiciones pactadas fuera de la ficha).
router.post("/", async (req, res, next) => {
  try {
    const { suministro: suministroId, concepto, periodo, importe, notas } = req.body;
    if (!CONCEPTOS.includes(concepto)) {
      return res.status(400).json({ error: "El concepto debe ser alta, mensual o anual" });
    }
    if (!PERIODO_RE.test(periodo ?? "")) {
      return res.status(400).json({ error: "Periodo no válido (formato AAAA-MM)" });
    }
    const imp = Number(importe);
    if (!Number.isFinite(imp) || imp <= 0) {
      return res.status(400).json({ error: "El importe debe ser mayor que cero" });
    }
    const s = await Suministro.findById(suministroId).lean();
    if (!s) return res.status(400).json({ error: "Selecciona un suministro (CUPS)" });
    let comercializadoraNombre = s.comercializadoraNombre;
    if (s.comercializadora && !comercializadoraNombre) {
      const com = await Comercializadora.findById(s.comercializadora).lean();
      comercializadoraNombre = com?.nombre;
    }
    const comision = await ComisionEnergia.create({
      comercializadora: s.comercializadora,
      comercializadoraNombre,
      suministro: s._id,
      cups: s.cups,
      tipo: s.tipo,
      cliente: s.cliente,
      clienteNombre: s.clienteNombre,
      concepto,
      periodo,
      importe: imp,
      notas: notas || undefined,
    });
    res.status(201).json(comision);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ error: "Esa comisión ya existe para ese suministro, concepto y mes" });
    }
    next(err);
  }
});

router.post("/:id/cobrar", async (req, res, next) => {
  try {
    const comision = await ComisionEnergia.findById(req.params.id);
    if (!comision) return res.status(404).json({ error: "Comisión no encontrada" });
    if (comision.estado === "cobrada") {
      return res.status(400).json({ error: "La comisión ya está cobrada" });
    }
    comision.estado = "cobrada";
    comision.fechaCobro = req.body.fecha ? new Date(req.body.fecha) : new Date();
    await comision.save();
    res.json(comision);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/pendiente", async (req, res, next) => {
  try {
    const comision = await ComisionEnergia.findById(req.params.id);
    if (!comision) return res.status(404).json({ error: "Comisión no encontrada" });
    comision.estado = "pendiente";
    comision.fechaCobro = undefined;
    await comision.save();
    res.json(comision);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const comision = await ComisionEnergia.findById(req.params.id);
    if (!comision) return res.status(404).json({ error: "Comisión no encontrada" });
    if (comision.estado === "cobrada") {
      return res.status(400).json({ error: "Una comisión cobrada no se puede borrar (pásala a pendiente si fue un error)" });
    }
    await comision.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
