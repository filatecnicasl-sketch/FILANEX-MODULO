// Informes de ventas y compras (menú Informes): totales por cliente,
// proveedor, artículo y periodo, con desglose de IVA por tipos, listados de
// documentos entre fechas y el resumen de IVA repercutido/soportado para el
// modelo 303. Todo se filtra por fecha de expedición (desde/hasta).
//
// Qué documentos cuentan:
//  - Ventas: facturas "emitida" (las rectificativas llevan importes en
//    negativo, así que netean solas). Las originales "rectificada" quedan
//    FUERA para no contarlas dos veces; borradores y anuladas también fuera.
//  - Compras: facturas "validada". Los tickets de gasto "validado" solo
//    entran en el informe de IVA (con su porcentaje deducible aplicado).
import { Router } from "express";
import FacturaVenta from "../models/FacturaVenta.js";
import FacturaCompra from "../models/FacturaCompra.js";
import Gasto from "../models/Gasto.js";

const router = Router();

const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Filtro por fecha de expedición: ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD.
// En compras puede faltar fechaExpedicion en datos antiguos: se usa entonces
// la fecha de recepción y, en último término, la de creación del registro.
function rangoFechas(query, campo = "fechaExpedicion") {
  const filtro = {};
  if (query.desde) {
    const d = new Date(`${query.desde}T00:00:00`);
    if (!Number.isNaN(d.getTime())) filtro.$gte = d;
  }
  if (query.hasta) {
    const h = new Date(`${query.hasta}T23:59:59.999`);
    if (!Number.isNaN(h.getTime())) filtro.$lte = h;
  }
  if (!Object.keys(filtro).length) return {};
  if (campo === "fechaExpedicion") return { fechaExpedicion: filtro };
  const fecha = { $ifNull: ["$fechaExpedicion", { $ifNull: [`$${campo}`, "$createdAt"] }] };
  const condiciones = [];
  if (filtro.$gte) condiciones.push({ $gte: [fecha, filtro.$gte] });
  if (filtro.$lte) condiciones.push({ $lte: [fecha, filtro.$lte] });
  return { $expr: { $and: condiciones } };
}

const baseLinea = (l) =>
  (l.cantidad ?? 0) * (l.precioUnitario ?? 0) * (1 - (l.descuento ?? 0) / 100);
const cuotaLinea = (l) => (baseLinea(l) * (l.iva ?? 0)) / 100;

// Acumula el desglose por tipo de IVA de unas líneas en un Map.
function acumularIva(mapa, lineas) {
  for (const l of lineas ?? []) {
    const tipo = l.iva ?? 0;
    const e = mapa.get(tipo) ?? { tipo, base: 0, cuota: 0 };
    e.base += baseLinea(l);
    e.cuota += cuotaLinea(l);
    mapa.set(tipo, e);
  }
}

const desgloseOrdenado = (mapa) =>
  [...mapa.values()]
    .sort((a, b) => b.tipo - a.tipo)
    .map((e) => ({ tipo: e.tipo, base: redondear(e.base), cuota: redondear(e.cuota) }));

const sumarDesgloses = (filas) => {
  const mapa = new Map();
  for (const f of filas)
    for (const d of f.iva ?? []) {
      const e = mapa.get(d.tipo) ?? { tipo: d.tipo, base: 0, cuota: 0 };
      e.base += d.base;
      e.cuota += d.cuota;
      mapa.set(d.tipo, e);
    }
  return desgloseOrdenado(mapa);
};

const totalesDe = (filas) => ({
  documentos: filas.reduce((s, f) => s + f.documentos, 0),
  base: redondear(filas.reduce((s, f) => s + f.base, 0)),
  cuotaIva: redondear(filas.reduce((s, f) => s + f.cuotaIva, 0)),
  total: redondear(filas.reduce((s, f) => s + f.total, 0)),
  pendiente: redondear(filas.reduce((s, f) => s + (f.pendiente ?? 0), 0)),
  iva: sumarDesgloses(filas),
});

// Agrupa facturas por su contacto (cliente o proveedor) con desglose de IVA.
function agruparPorContacto(facturas, campo, campoPendiente) {
  const grupos = new Map();
  for (const f of facturas) {
    const contacto = f[campo];
    const id = String(contacto?._id ?? contacto ?? "sin-contacto");
    if (!grupos.has(id)) {
      grupos.set(id, {
        id,
        nombre: contacto?.nombre ?? "Sin asignar",
        nif: contacto?.nif ?? "",
        documentos: 0,
        base: 0,
        cuotaIva: 0,
        total: 0,
        pendiente: 0,
        _iva: new Map(),
      });
    }
    const g = grupos.get(id);
    g.documentos += 1;
    g.base += f.baseImponible ?? 0;
    g.cuotaIva += f.cuotaIva ?? 0;
    g.total += f.total ?? 0;
    g.pendiente += Math.max(0, (f.total ?? 0) - (campoPendiente === "cobrado" ? f.cobrado() : f.pagado()));
    acumularIva(g._iva, f.lineas);
  }
  return [...grupos.values()].map((g) => ({
    id: g.id,
    nombre: g.nombre,
    nif: g.nif,
    documentos: g.documentos,
    base: redondear(g.base),
    cuotaIva: redondear(g.cuotaIva),
    total: redondear(g.total),
    pendiente: redondear(g.pendiente),
    iva: desgloseOrdenado(g._iva),
  }));
}

// Agrupa las líneas de todas las facturas por descripción de artículo.
function agruparPorArticulo(facturas) {
  const grupos = new Map();
  for (const f of facturas) {
    for (const l of f.lineas ?? []) {
      const clave = (l.descripcion ?? "").trim() || "Sin descripción";
      const g = grupos.get(clave) ?? { descripcion: clave, cantidad: 0, base: 0, cuotaIva: 0 };
      g.cantidad += l.cantidad ?? 0;
      g.base += baseLinea(l);
      g.cuotaIva += cuotaLinea(l);
      grupos.set(clave, g);
    }
  }
  return [...grupos.values()]
    .map((g) => ({
      descripcion: g.descripcion,
      cantidad: redondear(g.cantidad),
      base: redondear(g.base),
      cuotaIva: redondear(g.cuotaIva),
      total: redondear(g.base + g.cuotaIva),
    }))
    .sort((a, b) => b.base - a.base);
}

// Resumen por periodo: dia, mes o trimestre.
function agruparPorPeriodo(facturas, agrupar) {
  const clavePeriodo = (fecha) => {
    const d = new Date(fecha);
    const a = d.getFullYear();
    const m = d.getMonth();
    if (agrupar === "dia") return `${a}-${String(m + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (agrupar === "trimestre") return `${a} T${Math.floor(m / 3) + 1}`;
    return `${a}-${String(m + 1).padStart(2, "0")}`;
  };
  const grupos = new Map();
  for (const f of facturas) {
    const clave = clavePeriodo(f.fechaExpedicion ?? f.fechaRecepcion ?? f.createdAt);
    const g = grupos.get(clave) ?? { periodo: clave, documentos: 0, base: 0, cuotaIva: 0, total: 0 };
    g.documentos += 1;
    g.base += f.baseImponible ?? 0;
    g.cuotaIva += f.cuotaIva ?? 0;
    g.total += f.total ?? 0;
    grupos.set(clave, g);
  }
  return [...grupos.values()]
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .map((g) => ({ ...g, base: redondear(g.base), cuotaIva: redondear(g.cuotaIva), total: redondear(g.total) }));
}

const docVenta = (f) => ({
  id: f._id,
  numero: f.serieNumero ?? `${f.serie ?? "A"}-${f.numero ?? "?"}`,
  fecha: f.fechaExpedicion,
  contacto: f.cliente?.nombre ?? "—",
  base: redondear(f.baseImponible ?? 0),
  cuotaIva: redondear(f.cuotaIva ?? 0),
  total: redondear(f.total ?? 0),
  estadoPago: f.estadoCobro(),
});

const docCompra = (f) => ({
  id: f._id,
  numero: f.numeroFacturaProveedor ?? "—",
  fecha: f.fechaExpedicion ?? f.fechaRecepcion ?? f.createdAt,
  contacto: f.proveedor?.nombre ?? "—",
  base: redondear(f.baseImponible ?? 0),
  cuotaIva: redondear(f.cuotaIva ?? 0),
  total: redondear(f.total ?? 0),
  estadoPago: f.estadoPago(),
});

const buscarVentas = (query) =>
  FacturaVenta.find({ estado: "emitida", ...rangoFechas(query) }).populate("cliente", "nombre nif");

const buscarCompras = (query) =>
  FacturaCompra.find({ estado: "validada", ...rangoFechas(query, "fechaRecepcion") }).populate("proveedor", "nombre nif");

// ---------- VENTAS ----------

router.get("/ventas/por-cliente", async (req, res, next) => {
  try {
    const filas = agruparPorContacto(await buscarVentas(req.query), "cliente", "cobrado")
      .sort((a, b) => b.base - a.base);
    res.json({ filas, totales: totalesDe(filas) });
  } catch (err) { next(err); }
});

router.get("/ventas/por-articulo", async (req, res, next) => {
  try {
    const filas = agruparPorArticulo(await buscarVentas(req.query));
    const totales = {
      cantidad: redondear(filas.reduce((s, f) => s + f.cantidad, 0)),
      base: redondear(filas.reduce((s, f) => s + f.base, 0)),
      cuotaIva: redondear(filas.reduce((s, f) => s + f.cuotaIva, 0)),
      total: redondear(filas.reduce((s, f) => s + f.total, 0)),
    };
    res.json({ filas, totales });
  } catch (err) { next(err); }
});

router.get("/ventas/resumen", async (req, res, next) => {
  try {
    const agrupar = ["dia", "mes", "trimestre"].includes(req.query.agrupar) ? req.query.agrupar : "mes";
    const filas = agruparPorPeriodo(await buscarVentas(req.query), agrupar);
    const totales = {
      documentos: filas.reduce((s, f) => s + f.documentos, 0),
      base: redondear(filas.reduce((s, f) => s + f.base, 0)),
      cuotaIva: redondear(filas.reduce((s, f) => s + f.cuotaIva, 0)),
      total: redondear(filas.reduce((s, f) => s + f.total, 0)),
    };
    res.json({ filas, totales });
  } catch (err) { next(err); }
});

router.get("/ventas/documentos", async (req, res, next) => {
  try {
    const docs = (await buscarVentas(req.query))
      .sort((a, b) => new Date(a.fechaExpedicion) - new Date(b.fechaExpedicion))
      .map(docVenta);
    res.json({ filas: docs, totales: totalesDocs(docs) });
  } catch (err) { next(err); }
});

// ---------- COMPRAS ----------

router.get("/compras/por-proveedor", async (req, res, next) => {
  try {
    const filas = agruparPorContacto(await buscarCompras(req.query), "proveedor", "pagado")
      .sort((a, b) => b.base - a.base);
    res.json({ filas, totales: totalesDe(filas) });
  } catch (err) { next(err); }
});

router.get("/compras/por-articulo", async (req, res, next) => {
  try {
    const filas = agruparPorArticulo(await buscarCompras(req.query));
    const totales = {
      cantidad: redondear(filas.reduce((s, f) => s + f.cantidad, 0)),
      base: redondear(filas.reduce((s, f) => s + f.base, 0)),
      cuotaIva: redondear(filas.reduce((s, f) => s + f.cuotaIva, 0)),
      total: redondear(filas.reduce((s, f) => s + f.total, 0)),
    };
    res.json({ filas, totales });
  } catch (err) { next(err); }
});

router.get("/compras/resumen", async (req, res, next) => {
  try {
    const agrupar = ["dia", "mes", "trimestre"].includes(req.query.agrupar) ? req.query.agrupar : "mes";
    const filas = agruparPorPeriodo(await buscarCompras(req.query), agrupar);
    const totales = {
      documentos: filas.reduce((s, f) => s + f.documentos, 0),
      base: redondear(filas.reduce((s, f) => s + f.base, 0)),
      cuotaIva: redondear(filas.reduce((s, f) => s + f.cuotaIva, 0)),
      total: redondear(filas.reduce((s, f) => s + f.total, 0)),
    };
    res.json({ filas, totales });
  } catch (err) { next(err); }
});

router.get("/compras/documentos", async (req, res, next) => {
  try {
    const docs = (await buscarCompras(req.query))
      .map(docCompra)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    res.json({ filas: docs, totales: totalesDocs(docs) });
  } catch (err) { next(err); }
});

function totalesDocs(docs) {
  return {
    documentos: docs.length,
    base: redondear(docs.reduce((s, d) => s + d.base, 0)),
    cuotaIva: redondear(docs.reduce((s, d) => s + d.cuotaIva, 0)),
    total: redondear(docs.reduce((s, d) => s + d.total, 0)),
  };
}

// ---------- IVA (resumen para el modelo 303) ----------

router.get("/iva", async (req, res, next) => {
  try {
    const [ventas, compras, gastos] = await Promise.all([
      buscarVentas(req.query),
      buscarCompras(req.query),
      // Los gastos llevan la fecha en `fecha`, no en `fechaExpedicion`.
      Gasto.find({ estado: "validado", ...rangoFechas(req.query, "fecha") }),
    ]);

    const repercutido = new Map();
    for (const f of ventas) acumularIva(repercutido, f.lineas);
    const soportado = new Map();
    for (const f of compras) acumularIva(soportado, f.lineas);

    // Tickets: el IVA solo cuenta por la parte deducible (categoría y datos
    // fiscales del comprador), que es lo que realmente va al 303.
    let cuotaGastos = 0;
    let cuotaGastosDeducible = 0;
    for (const g of gastos) {
      cuotaGastos += g.cuotaIva ?? 0;
      cuotaGastosDeducible += g.ivaDeducible();
    }

    const rep = desgloseOrdenado(repercutido);
    const sop = desgloseOrdenado(soportado);
    const cuotaRep = redondear(rep.reduce((s, e) => s + e.cuota, 0));
    const cuotaSop = redondear(sop.reduce((s, e) => s + e.cuota, 0) + cuotaGastosDeducible);

    res.json({
      repercutido: rep,
      soportado: sop,
      gastos: {
        cuota: redondear(cuotaGastos),
        deducible: redondear(cuotaGastosDeducible),
      },
      totalRepercutido: cuotaRep,
      totalSoportado: cuotaSop,
      resultado: redondear(cuotaRep - cuotaSop),
    });
  } catch (err) { next(err); }
});

export default router;
