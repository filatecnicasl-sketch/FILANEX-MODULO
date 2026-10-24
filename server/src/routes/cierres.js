import { Router } from "express";
import CierreEjercicio from "../models/CierreEjercicio.js";
import FacturaVenta from "../models/FacturaVenta.js";
import FacturaCompra from "../models/FacturaCompra.js";
import Empresa from "../models/Empresa.js";

const router = Router();

const redondear = (n) => Math.round((n ?? 0) * 100) / 100;

// Comprueba si un ejercicio está cerrado. La usan las rutas de facturas
// (venta/compra) y el TPV para bloquear documentos de años cerrados.
export async function ejercicioCerrado(ano) {
  if (!ano) return false;
  const cierre = await CierreEjercicio.findOne({ ano: Number(ano), estado: "cerrado" }).lean();
  return Boolean(cierre);
}

export const errorEjercicioCerrado = (ano) =>
  `El ejercicio ${ano} está cerrado. Las correcciones se hacen con rectificativa en el ejercicio actual.`;

// Calcula el resumen fiscal de un año: bases y cuotas por trimestre,
// emitidas (facturas + tickets TPV) y recibidas.
async function calcularResumen(ano) {
  const desde = new Date(ano, 0, 1);
  const hasta = new Date(ano + 1, 0, 1);
  const filtro = { fechaExpedicion: { $gte: desde, $lt: hasta }, estado: { $ne: "borrador" } };

  const vacio = () => ({ base: 0, cuota: 0, total: 0, numero: 0 });
  const trimestres = [1, 2, 3, 4].map((t) => ({ trimestre: t, emitidas: vacio(), recibidas: vacio() }));
  const emitidas = vacio();
  const recibidas = vacio();
  let facturas = 0;
  let tickets = 0;
  let rectificativas = 0;

  const sumar = (dest, t, doc) => {
    dest.base = redondear(dest.base + (doc.baseImponible ?? 0));
    dest.cuota = redondear(dest.cuota + (doc.cuotaIva ?? 0));
    dest.total = redondear(dest.total + (doc.total ?? 0));
    dest.numero += 1;
  };

  const ventas = await FacturaVenta.find(filtro).select("fechaExpedicion baseImponible cuotaIva total tipoFactura rectifica").lean();
  for (const f of ventas) {
    const t = Math.floor(new Date(f.fechaExpedicion).getMonth() / 3);
    sumar(emitidas, t, f);
    sumar(trimestres[t].emitidas, t, f);
    if (f.rectifica) rectificativas += 1;
    else if (f.tipoFactura === "F2") tickets += 1;
    else facturas += 1;
  }

  const compras = await FacturaCompra.find(filtro).select("fechaExpedicion baseImponible cuotaIva total").lean();
  for (const f of compras) {
    const t = Math.floor(new Date(f.fechaExpedicion).getMonth() / 3);
    sumar(recibidas, t, f);
    sumar(trimestres[t].recibidas, t, f);
  }

  return { trimestres, emitidas, recibidas, facturas, tickets, rectificativas };
}

// Listado: años con documentos + estado de cada ejercicio.
router.get("/", async (req, res, next) => {
  try {
    const [primeraVenta, primeraCompra, cierres] = await Promise.all([
      FacturaVenta.findOne().sort({ fechaExpedicion: 1 }).select("fechaExpedicion").lean(),
      FacturaCompra.findOne().sort({ fechaExpedicion: 1 }).select("fechaExpedicion").lean(),
      CierreEjercicio.find().sort({ ano: -1 }).lean(),
    ]);
    const fechas = [primeraVenta?.fechaExpedicion, primeraCompra?.fechaExpedicion].filter(Boolean);
    const anoInicio = fechas.length
      ? Math.min(...fechas.map((f) => new Date(f).getFullYear()))
      : new Date().getFullYear();
    const anoActual = new Date().getFullYear();

    const porAno = new Map(cierres.map((c) => [c.ano, c]));
    const ejercicios = [];
    for (let ano = anoInicio; ano <= anoActual; ano++) {
      const cierre = porAno.get(ano);
      ejercicios.push({
        ano,
        estado: cierre?.estado ?? "abierto",
        cerradoEn: cierre?.cerradoEn ?? null,
        cerradoPor: cierre?.cerradoPor ?? null,
        reabiertoEn: cierre?.reabiertoEn ?? null,
        reabiertoPor: cierre?.reabiertoPor ?? null,
        resumen: cierre?.resumen ?? null,
      });
    }

    // Conteo de documentos por año abierto (para mostrar antes de cerrar)
    for (const e of ejercicios.filter((x) => x.estado !== "cerrado")) {
      const desde = new Date(e.ano, 0, 1);
      const hasta = new Date(e.ano + 1, 0, 1);
      const filtro = { fechaExpedicion: { $gte: desde, $lt: hasta }, estado: { $ne: "borrador" } };
      const [nv, nc] = await Promise.all([
        FacturaVenta.countDocuments(filtro),
        FacturaCompra.countDocuments(filtro),
      ]);
      e.documentos = { emitidas: nv, recibidas: nc };
    }

    const empresa = await Empresa.findOne().select("renumerarAnual").lean();
    res.json({
      ejercicios: ejercicios.sort((a, b) => b.ano - a.ano),
      renumerarAnual: empresa?.renumerarAnual ?? true,
    });
  } catch (err) {
    next(err);
  }
});

// Resumen fiscal de un año (sin cerrar): vista previa del cierre.
router.get("/:ano/resumen", async (req, res, next) => {
  try {
    const ano = Number(req.params.ano);
    const resumen = await calcularResumen(ano);
    const cierre = await CierreEjercicio.findOne({ ano }).lean();
    res.json({ ano, estado: cierre?.estado ?? "abierto", resumen });
  } catch (err) {
    next(err);
  }
});

// Cerrar ejercicio: guarda el resumen y bloquea el año.
router.post("/:ano/cerrar", async (req, res, next) => {
  try {
    const ano = Number(req.params.ano);
    if (!ano || ano < 2000 || ano > 2100) {
      return res.status(400).json({ error: "Ejercicio no válido" });
    }
    const existente = await CierreEjercicio.findOne({ ano });
    if (existente?.estado === "cerrado") {
      return res.status(409).json({ error: `El ejercicio ${ano} ya está cerrado` });
    }

    const resumen = await calcularResumen(ano);
    if (existente) {
      // Re-cierre tras reapertura: actualiza el resumen y vuelve a cerrar.
      existente.estado = "cerrado";
      existente.cerradoEn = new Date();
      existente.cerradoPor = req.usuario.email;
      existente.resumen = resumen;
      existente.notas = String(req.body?.notas ?? existente.notas ?? "");
      await existente.save();
      return res.json(existente);
    }

    const cierre = await CierreEjercicio.create({
      ano,
      estado: "cerrado",
      cerradoEn: new Date(),
      cerradoPor: req.usuario.email,
      resumen,
      notas: String(req.body?.notas ?? ""),
    });
    res.status(201).json(cierre);
  } catch (err) {
    next(err);
  }
});

// Reabrir ejercicio: queda registrado quién y cuándo (auditoría).
router.post("/:ano/reabrir", async (req, res, next) => {
  try {
    const ano = Number(req.params.ano);
    const cierre = await CierreEjercicio.findOne({ ano, estado: "cerrado" });
    if (!cierre) {
      return res.status(404).json({ error: `El ejercicio ${ano} no está cerrado` });
    }
    cierre.estado = "reabierto";
    cierre.reabiertoEn = new Date();
    cierre.reabiertoPor = req.usuario.email;
    await cierre.save();
    res.json(cierre);
  } catch (err) {
    next(err);
  }
});

// Activar/desactivar la renumeración anual de series (A-2027-1, T-2027-1…).
router.put("/renumeracion", async (req, res, next) => {
  try {
    const empresa = await Empresa.findOne();
    empresa.renumerarAnual = req.body?.activa !== false;
    await empresa.save();
    res.json({ renumerarAnual: empresa.renumerarAnual });
  } catch (err) {
    next(err);
  }
});

export default router;
