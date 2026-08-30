// Módulo TPV: ventas de mostrador con factura simplificada (F2) en
// VeriFactu, caja con apertura/arqueo y devoluciones (R5).
//
// REGLAS:
// - Cobrar exige caja abierta; el registro se crea dentro de la cola
//   serializada compartida para mantener íntegra la cadena de huellas.
// - La numeración usa la serie "T" (factura simplificada) vía contador
//   atómico; el envío a la AEAT es asíncrono como en las facturas normales.
import { Router } from "express";
import Articulo from "../models/Articulo.js";
import Cliente from "../models/Cliente.js";
import CajaSesion from "../models/CajaSesion.js";
import CajaMovimiento from "../models/CajaMovimiento.js";
import TpvTicketEspera from "../models/TpvTicketEspera.js";
import Empresa from "../models/Empresa.js";
import FacturaVenta from "../models/FacturaVenta.js";
import RegistroFacturacion from "../models/RegistroFacturacion.js";
import { calcularTotales } from "../services/totales.js";
import { tomarNumeroFacturaVentaAtomico } from "../services/numeracion.js";
import {
  huellaAlta,
  contenidoQr,
  xmlRegistroAlta,
  sobreSoap,
  remitirAeat,
  fechaDDMMYYYY,
  timestampRegistro,
} from "../services/verifactu.js";
import { certificadoActual } from "../services/certificadoEmpresa.js";
import { requiereModulo } from "../config/modulos.js";
import { serializarRegistro } from "../services/registro-cola.js";

const router = Router();
router.use(requiereModulo("tpv"));

const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;
const METODOS = ["efectivo", "tarjeta", "otro"];

// Cliente genérico de mostrador ("Consumidor final"): se crea una vez.
async function clienteMostrador() {
  let mostrador = await Cliente.findOne({ mostrador: true });
  if (!mostrador) {
    mostrador = await Cliente.create({
      nombre: "Consumidor final",
      nif: "MOSTRADOR",
      mostrador: true,
    });
  }
  return mostrador;
}

function vistaTicket(f) {
  const obj = f.toObject ? f.toObject() : f;
  return {
    _id: obj._id,
    id: obj._id,
    tipoFactura: obj.tipoFactura,
    numero: obj.serieNumero,
    serieNumero: obj.serieNumero,
    fecha: obj.fechaExpedicion,
    fechaExpedicion: obj.fechaExpedicion,
    lineas: (obj.lineas ?? []).map((l) => ({
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      devuelto: l.devuelto ?? 0,
      pendiente: Math.max(0, (l.cantidad ?? 0) - (l.devuelto ?? 0)),
      precio: l.precioUnitario,
      iva: l.iva,
      descuento: l.descuento ?? 0,
      total: redondear(l.cantidad * l.precioUnitario * (1 - (l.descuento ?? 0) / 100) * (1 + l.iva / 100)),
    })),
    base: obj.baseImponible,
    cuotaIva: obj.cuotaIva,
    total: obj.total,
    metodoCobro: obj.cobros?.[0]?.metodo ?? "efectivo",
    estado: obj.estado,
    qrContenido: obj.verifactu?.qrContenido ?? "",
  };
}

// Crea el registro VeriFactu (huella encadenada + XML) y remite a la AEAT
// en segundo plano si hay certificado. Devuelve datos para la factura.
async function registrarVerifactu({ empresa, facturaDoc, facturaDatos, tipoFactura, facturaRectificada }) {
  const fechaExpedicion = fechaDDMMYYYY(facturaDatos.fechaExpedicion);
  const fechaHoraGen = timestampRegistro();

  const ultimo = await RegistroFacturacion.findOne({ empresa: empresa._id }).sort({ _id: -1 });
  const huellaAnterior = ultimo?.huella ?? "";

  const huella = huellaAlta({
    nifEmisor: empresa.nif,
    numSerie: facturaDatos.serieNumero,
    fechaExpedicion,
    tipoFactura,
    cuotaTotal: facturaDatos.cuotaIva,
    importeTotal: facturaDatos.total,
    huellaAnterior,
    fechaHoraGen,
  });

  const registroAnterior = ultimo
    ? { emisor: empresa.nif, numSerie: ultimo.numSerieFactura, fecha: ultimo.fechaExpedicionFactura, huella: ultimo.huella }
    : null;

  const xmlRegistro = xmlRegistroAlta({
    empresa,
    factura: facturaDatos,
    huella,
    fechaHoraGen,
    registroAnterior,
    tipoFactura,
    facturaRectificada,
  });
  const xml = sobreSoap(empresa, xmlRegistro);

  const registro = await RegistroFacturacion.create({
    empresa: empresa._id,
    facturaVenta: facturaDoc._id,
    tipo: "alta",
    numSerieFactura: facturaDatos.serieNumero,
    fechaExpedicionFactura: fechaExpedicion,
    huella,
    huellaAnterior,
    xml,
  });

  const verifactu = {
    huella,
    huellaAnterior,
    qrContenido: contenidoQr({
      nif: empresa.nif,
      numSerie: facturaDatos.serieNumero,
      fechaExpedicion,
      total: facturaDatos.total,
    }),
    enviada: false,
    estadoEnvio: "pendiente",
    fechaRegistro: new Date(),
  };

  // Remisión asíncrona; el reintento automático cubre los fallos.
  certificadoActual()
    .then(async (cert) => {
      if (!cert) return;
      try {
        const resp = await remitirAeat(xml, cert);
        const aceptado = /EstadoEnvio>Correcto</.test(resp.cuerpo);
        const conErrores = /AceptadoConErrores/.test(resp.cuerpo);
        const estado = aceptado ? "aceptado" : conErrores ? "aceptado_con_errores" : "rechazado";
        registro.estadoEnvio = estado;
        registro.respuestaAeat = { httpStatus: resp.httpStatus, cuerpo: resp.cuerpo.slice(0, 4000) };
        await registro.save();
        await FacturaVenta.findByIdAndUpdate(facturaDoc._id, {
          "verifactu.enviada": aceptado || conErrores,
          "verifactu.estadoEnvio": estado,
        });
      } catch (e) {
        registro.respuestaAeat = { error: e.message };
        await registro.save().catch(() => {});
      }
    })
    .catch(() => {});

  return verifactu;
}

// -------------------------------------------------------------- estado ---

router.get("/estado", async (req, res, next) => {
  try {
    const [sesion, articulos, empresa, mostrador] = await Promise.all([
      CajaSesion.findOne({ estado: "abierta" }).lean(),
      Articulo.find({ precioVenta: { $gt: 0 } }).sort({ descripcion: 1 }).lean(),
      Empresa.findOne().lean(),
      clienteMostrador(),
    ]);
    // Totales de la sesión abierta por método de cobro (para el arqueo).
    // Incluye los movimientos manuales de efectivo (entradas/salidas).
    let totalesSesion = null;
    let movimientos = [];
    if (sesion) {
      [movimientos] = await Promise.all([
        CajaMovimiento.find({ cajaSesion: sesion._id }).sort({ fecha: 1 }).lean(),
      ]);
      const tickets = await FacturaVenta.find({
        tipoFactura: "F2",
        cajaSesion: sesion._id,
        estado: { $in: ["emitida", "rectificada"] },
      }).lean();
      totalesSesion = { efectivo: 0, tarjeta: 0, otro: 0, entradas: 0, salidas: 0 };
      for (const t of tickets) {
        const metodo = METODOS.includes(t.cobros?.[0]?.metodo) ? t.cobros[0].metodo : "otro";
        totalesSesion[metodo] = redondear(totalesSesion[metodo] + t.total);
      }
      for (const m of movimientos) {
        totalesSesion[m.tipo === "entrada" ? "entradas" : "salidas"] = redondear(
          totalesSesion[m.tipo === "entrada" ? "entradas" : "salidas"] + m.importe
        );
      }
    }
    // Favoritos: los más vendidos en tickets de los últimos 30 días.
    const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recientes = await FacturaVenta.aggregate([
      { $match: { tipoFactura: "F2", estado: { $in: ["emitida", "rectificada"] }, fechaExpedicion: { $gte: hace30 } } },
      { $unwind: "$lineas" },
      { $group: { _id: "$lineas.descripcion", cantidad: { $sum: "$lineas.cantidad" } } },
      { $sort: { cantidad: -1 } },
      { $limit: 12 },
    ]);
    const ranking = new Map(recientes.map((r, i) => [r._id, i]));
    const favoritos = articulos
      .filter((a) => ranking.has(a.descripcion))
      .sort((a, b) => ranking.get(a.descripcion) - ranking.get(b.descripcion))
      .map((a) => a._id);

    const familias = [...new Set(articulos.map((a) => a.familia).filter(Boolean))].sort();

    res.json({
      caja: sesion
        ? { id: sesion._id, apertura: sesion.apertura, estado: sesion.estado }
        : null,
      totalesSesion,
      movimientos,
      articulos: articulos.map((a) => ({
        _id: a._id,
        codigo: a.codigo,
        codigoBarras: a.codigoBarras,
        descripcion: a.descripcion,
        familia: a.familia ?? "",
        precioVenta: a.precioVenta,
        iva: a.iva ?? 21,
      })),
      familias,
      favoritos,
      clienteMostradorId: mostrador._id,
      empresa: { nombre: empresa?.nombre ?? "", nif: empresa?.nif ?? "" },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- caja ---

router.post("/caja/abrir", async (req, res, next) => {
  try {
    const abierta = await CajaSesion.findOne({ estado: "abierta" }).lean();
    if (abierta) {
      return res.status(409).json({ error: "Ya hay una caja abierta. Ciérrala antes de abrir otra." });
    }
    const sesion = await CajaSesion.create({
      apertura: { fondo: redondear(req.body?.fondo), usuario: req.usuario.email },
    });
    res.status(201).json({ id: sesion._id, apertura: sesion.apertura.fecha, fondo: sesion.apertura.fondo });
  } catch (err) {
    next(err);
  }
});

router.post("/caja/cerrar", async (req, res, next) => {
  try {
    const sesion = await CajaSesion.findOne({ estado: "abierta" });
    if (!sesion) return res.status(404).json({ error: "No hay ninguna caja abierta" });

    // Ventas F2 de la sesión (emitidas y las ya devueltas con R5), netas de
    // devoluciones: las R5 tienen total negativo, así que la suma cuadra.
    const tickets = await FacturaVenta.find({
      tipoFactura: "F2",
      cajaSesion: sesion._id,
      estado: { $in: ["emitida", "rectificada"] },
    }).lean();

    const totales = { efectivo: 0, tarjeta: 0, otro: 0 };
    for (const t of tickets) {
      const metodo = METODOS.includes(t.cobros?.[0]?.metodo) ? t.cobros[0].metodo : "otro";
      totales[metodo] = redondear(totales[metodo] + t.total);
    }
    // Movimientos manuales de efectivo de la sesión.
    const movimientos = await CajaMovimiento.find({ cajaSesion: sesion._id }).lean();
    let entradas = 0;
    let salidas = 0;
    for (const m of movimientos) {
      if (m.tipo === "entrada") entradas = redondear(entradas + m.importe);
      else salidas = redondear(salidas + m.importe);
    }
    const fondo = sesion.apertura.fondo ?? 0;
    const esperado = redondear(fondo + totales.efectivo + entradas - salidas);
    const conteo = redondear(req.body?.conteoEfectivo);

    sesion.estado = "cerrada";
    sesion.cierre = {
      fecha: new Date(),
      usuario: req.usuario.email,
      conteoEfectivo: conteo,
      esperadoEfectivo: esperado,
      totalEfectivo: totales.efectivo,
      totalTarjeta: totales.tarjeta,
      totalOtro: totales.otro,
      totalEntradas: entradas,
      totalSalidas: salidas,
      totalVentas: redondear(totales.efectivo + totales.tarjeta + totales.otro),
      numeroTickets: tickets.length,
      diferencia: redondear(conteo - esperado),
      notas: String(req.body?.notas ?? ""),
    };
    await sesion.save();
    res.json({ ok: true, cierre: sesion.cierre });
  } catch (err) {
    next(err);
  }
});

// Movimientos manuales de efectivo (entrada/salida) de la sesión abierta.
router.post("/caja/movimientos", async (req, res, next) => {
  try {
    const sesion = await CajaSesion.findOne({ estado: "abierta" }).lean();
    if (!sesion) return res.status(409).json({ error: "No hay caja abierta" });
    const tipo = req.body?.tipo === "salida" ? "salida" : "entrada";
    const importe = redondear(req.body?.importe);
    if (!(importe > 0)) return res.status(400).json({ error: "El importe debe ser mayor que cero" });
    const mov = await CajaMovimiento.create({
      cajaSesion: sesion._id,
      tipo,
      importe,
      concepto: String(req.body?.concepto ?? "").trim(),
      usuario: req.usuario.email,
    });
    res.status(201).json(mov);
  } catch (err) {
    next(err);
  }
});

router.get("/caja/movimientos", async (req, res, next) => {
  try {
    const sesion = await CajaSesion.findOne({ estado: "abierta" }).lean();
    if (!sesion) return res.json([]);
    const movimientos = await CajaMovimiento.find({ cajaSesion: sesion._id }).sort({ fecha: 1 }).lean();
    res.json(movimientos);
  } catch (err) {
    next(err);
  }
});

router.get("/caja/sesiones", async (req, res, next) => {
  try {
    const sesiones = await CajaSesion.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json(sesiones);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------- cobrar ---

router.post("/cobrar", serializarRegistro, async (req, res, next) => {
  try {
    const sesion = await CajaSesion.findOne({ estado: "abierta" });
    if (!sesion) {
      return res.status(409).json({ error: "No hay caja abierta. Abre la caja antes de cobrar." });
    }

    const lineasEntrada = Array.isArray(req.body?.lineas) ? req.body.lineas : [];
    if (!lineasEntrada.length) {
      return res.status(400).json({ error: "El ticket no tiene líneas" });
    }
    const metodo = METODOS.includes(req.body?.metodoCobro) ? req.body.metodoCobro : "efectivo";

    const lineas = lineasEntrada.map((l) => ({
      descripcion: String(l.descripcion ?? "").trim() || "Artículo",
      cantidad: Number(l.cantidad) > 0 ? Number(l.cantidad) : 1,
      precioUnitario: Number(l.precioUnitario ?? l.precio) || 0,
      iva: Number(l.iva) || 0,
      descuento: Number(l.descuento) || 0,
    }));
    const totales = calcularTotales(lineas);
    if (totales.total <= 0) {
      return res.status(400).json({ error: "El ticket no puede ser de 0 €" });
    }

    const [empresa, mostrador] = await Promise.all([Empresa.findOne(), clienteMostrador()]);
    const numeracion = await tomarNumeroFacturaVentaAtomico(empresa, { serieNombre: "T" });

    const ticket = await FacturaVenta.create({
      empresa: empresa._id,
      cliente: mostrador._id,
      tipoFactura: "F2",
      cajaSesion: sesion._id,
      serie: numeracion.serie,
      numero: numeracion.numero,
      serieNumero: numeracion.serieNumero,
      fechaExpedicion: new Date(),
      estado: "emitida",
      descripcion: "Ticket de venta TPV",
      lineas,
      baseImponible: totales.baseImponible,
      cuotaIva: totales.cuotaIva,
      total: totales.total,
      cobros: [{ importe: totales.total, metodo }],
    });

    ticket.verifactu = await registrarVerifactu({
      empresa,
      facturaDoc: ticket,
      facturaDatos: {
        serieNumero: numeracion.serieNumero,
        fechaExpedicion: ticket.fechaExpedicion,
        lineas,
        baseImponible: totales.baseImponible,
        cuotaIva: totales.cuotaIva,
        total: totales.total,
        descripcion: "Ticket de venta TPV",
      },
      tipoFactura: "F2",
    });
    await ticket.save();

    const entregado = redondear(req.body?.entregado);
    res.status(201).json({
      ticket: vistaTicket(ticket),
      cambio: metodo === "efectivo" && entregado > totales.total ? redondear(entregado - totales.total) : 0,
      imprimirUrl: `/api/tpv/tickets/${ticket._id}/imprimir`,
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------- tickets ---

router.get("/tickets", async (req, res, next) => {
  try {
    const { fecha } = req.query;
    const filtro = { tipoFactura: "F2", estado: { $in: ["emitida", "rectificada"] } };
    if (fecha) {
      const desde = new Date(fecha);
      desde.setHours(0, 0, 0, 0);
      const hasta = new Date(fecha);
      hasta.setHours(23, 59, 59, 999);
      filtro.fechaExpedicion = { $gte: desde, $lte: hasta };
    }
    const tickets = await FacturaVenta.find(filtro).sort({ fechaExpedicion: -1 }).limit(200);
    res.json(tickets.map(vistaTicket));
  } catch (err) {
    next(err);
  }
});

// Devolución: rectificativa simplificada R5 con importes negativos.
// Sin body → devolución íntegra. Con { lineas: [{ indice, cantidad }] } →
// devolución parcial: solo esas cantidades; el original pasa a "rectificada"
// cuando todas sus líneas quedan completamente devueltas.
router.post("/tickets/:id/devolucion", serializarRegistro, async (req, res, next) => {
  try {
    const original = await FacturaVenta.findOne({ _id: req.params.id, tipoFactura: "F2" });
    if (!original) return res.status(404).json({ error: "Ticket no encontrado" });
    if (original.estado !== "emitida") {
      return res.status(409).json({ error: "Este ticket ya está devuelto o no se puede devolver" });
    }

    const pedidas = Array.isArray(req.body?.lineas) ? req.body.lineas : null;
    const seleccion = [];
    if (pedidas) {
      for (const p of pedidas) {
        const indice = Number(p?.indice);
        const cantidad = Number(p?.cantidad);
        const linea = original.lineas[indice];
        if (!linea || !(cantidad > 0)) continue;
        const pendiente = linea.cantidad - (linea.devuelto ?? 0);
        const aDevolver = Math.min(cantidad, pendiente);
        if (aDevolver > 0) seleccion.push({ indice, cantidad: aDevolver });
      }
      if (!seleccion.length) {
        return res.status(400).json({ error: "No hay cantidades pendientes de devolver en esas líneas" });
      }
    } else {
      // Íntegra: todo lo que quede pendiente en cada línea.
      original.lineas.forEach((linea, indice) => {
        const pendiente = linea.cantidad - (linea.devuelto ?? 0);
        if (pendiente > 0) seleccion.push({ indice, cantidad: pendiente });
      });
    }

    const empresa = await Empresa.findOne();
    const numeracion = await tomarNumeroFacturaVentaAtomico(empresa, { serieNombre: "T" });

    // Rectificación por sustitución de las líneas seleccionadas (negativas).
    const lineas = seleccion.map(({ indice, cantidad }) => {
      const l = original.lineas[indice];
      return {
        descripcion: l.descripcion,
        cantidad,
        precioUnitario: -Math.abs(l.precioUnitario),
        iva: l.iva,
        descuento: l.descuento ?? 0,
      };
    });
    const totales = calcularTotales(lineas);

    const sesion = await CajaSesion.findOne({ estado: "abierta" });
    const devolucion = await FacturaVenta.create({
      empresa: empresa._id,
      cliente: original.cliente,
      tipoFactura: "F2",
      cajaSesion: sesion?._id,
      serie: numeracion.serie,
      numero: numeracion.numero,
      serieNumero: numeracion.serieNumero,
      fechaExpedicion: new Date(),
      estado: "emitida",
      descripcion: `Devolución del ticket ${original.serieNumero}`,
      rectifica: original._id,
      lineas,
      baseImponible: totales.baseImponible,
      cuotaIva: totales.cuotaIva,
      total: totales.total,
      cobros: [{ importe: totales.total, metodo: original.cobros?.[0]?.metodo ?? "efectivo" }],
    });

    devolucion.verifactu = await registrarVerifactu({
      empresa,
      facturaDoc: devolucion,
      facturaDatos: {
        serieNumero: numeracion.serieNumero,
        fechaExpedicion: devolucion.fechaExpedicion,
        lineas,
        baseImponible: totales.baseImponible,
        cuotaIva: totales.cuotaIva,
        total: totales.total,
        descripcion: `Devolución del ticket ${original.serieNumero}`,
      },
      tipoFactura: "R5",
      facturaRectificada: {
        numSerie: original.serieNumero,
        fecha: fechaDDMMYYYY(original.fechaExpedicion),
      },
    });
    await devolucion.save();

    // Marcar lo devuelto en el original; "rectificada" solo cuando no quede
    // nada pendiente en ninguna línea.
    for (const { indice, cantidad } of seleccion) {
      original.lineas[indice].devuelto = (original.lineas[indice].devuelto ?? 0) + cantidad;
    }
    const agotado = original.lineas.every((l) => (l.devuelto ?? 0) >= l.cantidad);
    if (agotado) original.estado = "rectificada";
    await original.save();

    res.status(201).json({ devolucion: vistaTicket(devolucion), completa: agotado });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------ tickets en espera ---

router.get("/espera", async (req, res, next) => {
  try {
    const sesion = await CajaSesion.findOne({ estado: "abierta" }).lean();
    if (!sesion) return res.json([]);
    const pendientes = await TpvTicketEspera.find({ cajaSesion: sesion._id }).sort({ fecha: 1 }).lean();
    res.json(pendientes);
  } catch (err) {
    next(err);
  }
});

router.post("/espera", async (req, res, next) => {
  try {
    const sesion = await CajaSesion.findOne({ estado: "abierta" }).lean();
    if (!sesion) return res.status(409).json({ error: "No hay caja abierta" });
    const lineas = (Array.isArray(req.body?.lineas) ? req.body.lineas : []).map((l) => ({
      articulo: l.articulo || undefined,
      descripcion: String(l.descripcion ?? "").trim() || "Artículo",
      cantidad: Number(l.cantidad) > 0 ? Number(l.cantidad) : 1,
      precioUnitario: Number(l.precioUnitario ?? l.precio) || 0,
      iva: Number(l.iva) || 0,
      descuento: Number(l.descuento) || 0,
    }));
    if (!lineas.length) return res.status(400).json({ error: "El ticket no tiene líneas" });
    const espera = await TpvTicketEspera.create({
      cajaSesion: sesion._id,
      nombre: String(req.body?.nombre ?? "").trim(),
      lineas,
      usuario: req.usuario.email,
    });
    res.status(201).json(espera);
  } catch (err) {
    next(err);
  }
});

router.delete("/espera/:id", async (req, res, next) => {
  try {
    await TpvTicketEspera.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------ resumen día ---

router.get("/resumen", async (req, res, next) => {
  try {
    const fecha = req.query.fecha ? new Date(req.query.fecha) : new Date();
    const desde = new Date(fecha); desde.setHours(0, 0, 0, 0);
    const hasta = new Date(fecha); hasta.setHours(23, 59, 59, 999);

    const tickets = await FacturaVenta.find({
      tipoFactura: "F2",
      estado: { $in: ["emitida", "rectificada"] },
      fechaExpedicion: { $gte: desde, $lte: hasta },
    }).lean();

    const porMetodo = { efectivo: 0, tarjeta: 0, otro: 0 };
    const porHora = {};
    const porArticulo = new Map();
    let ventas = 0;
    let devoluciones = 0;
    for (const t of tickets) {
      const esDevolucion = t.total < 0;
      const metodo = METODOS.includes(t.cobros?.[0]?.metodo) ? t.cobros[0].metodo : "otro";
      porMetodo[metodo] = redondear(porMetodo[metodo] + t.total);
      if (esDevolucion) devoluciones = redondear(devoluciones + t.total);
      else ventas = redondear(ventas + t.total);
      const hora = new Date(t.fechaExpedicion).getHours();
      porHora[hora] = redondear((porHora[hora] ?? 0) + t.total);
      for (const l of t.lineas ?? []) {
        const actual = porArticulo.get(l.descripcion) ?? 0;
        const signo = l.precioUnitario < 0 ? -1 : 1;
        porArticulo.set(l.descripcion, actual + l.cantidad * signo);
      }
    }
    const topArticulos = [...porArticulo.entries()]
      .map(([descripcion, cantidad]) => ({ descripcion, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    res.json({
      fecha: desde.toISOString().slice(0, 10),
      numeroTickets: tickets.filter((t) => t.total >= 0).length,
      numeroDevoluciones: tickets.filter((t) => t.total < 0).length,
      ventas,
      devoluciones,
      total: redondear(ventas + devoluciones),
      porMetodo,
      porHora: Object.entries(porHora)
        .map(([hora, importe]) => ({ hora: Number(hora), importe }))
        .sort((a, b) => a.hora - b.hora),
      topArticulos,
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------- imprimir 80mm ---

router.get("/tickets/:id/imprimir", async (req, res, next) => {
  try {
    const [ticket, empresa] = await Promise.all([
      FacturaVenta.findOne({ _id: req.params.id, tipoFactura: "F2" }).lean(),
      Empresa.findOne().lean(),
    ]);
    if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });

    const esc = (s) =>
      String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const euros = (n) => `${redondear(n).toFixed(2).replace(".", ",")} €`;
    const fecha = new Date(ticket.fechaExpedicion);
    const fechaTxt = `${fecha.toLocaleDateString("es-ES")} ${fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;

    const filas = (ticket.lineas ?? [])
      .map((l) => {
        const totalLinea = redondear(l.cantidad * l.precioUnitario * (1 - (l.descuento ?? 0) / 100) * (1 + l.iva / 100));
        return `<tr>
          <td>${esc(l.descripcion)}</td>
          <td class="num">${l.cantidad}</td>
          <td class="num">${euros(l.precioUnitario)}</td>
          <td class="num">${euros(totalLinea)}</td>
        </tr>`;
      })
      .join("");

    const qr = ticket.verifactu?.qrContenido
      ? `<div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticket.verifactu.qrContenido)}" alt="QR VeriFactu"><br><small>Verificado en Veri*factu · AEAT</small></div>`
      : "";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Ticket ${esc(ticket.serieNumero)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { width: 72mm; margin: 4mm auto; font-family: 'Courier New', monospace; font-size: 11px; color: #000; }
  .centro { text-align: center; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .total { font-size: 15px; font-weight: bold; }
  .qr { text-align: center; margin-top: 6px; }
  .qr img { width: 34mm; }
  @media print { .noprint { display: none; } }
</style></head><body>
<button class="noprint" onclick="window.print()" style="width:100%;padding:8px;font-size:14px;margin-bottom:8px;">Imprimir ticket</button>
<div class="centro"><strong>${esc(empresa?.nombre)}</strong><br>NIF ${esc(empresa?.nif)}</div>
<div class="sep"></div>
<div>FACTURA SIMPLIFICADA<br>Nº <strong>${esc(ticket.serieNumero)}</strong><br>${fechaTxt}</div>
<div class="sep"></div>
<table>${filas}</table>
<div class="sep"></div>
<table>
  <tr><td>Base imponible</td><td class="num">${euros(ticket.baseImponible)}</td></tr>
  <tr><td>IVA</td><td class="num">${euros(ticket.cuotaIva)}</td></tr>
  <tr class="total"><td>TOTAL</td><td class="num">${euros(ticket.total)}</td></tr>
  <tr><td>Pago: ${esc(ticket.cobros?.[0]?.metodo ?? "efectivo")}</td><td class="num"></td></tr>
</table>
${qr}
<div class="sep"></div>
<div class="centro">Gracias por su compra</div>
</body></html>`);
  } catch (err) {
    next(err);
  }
});

export default router;
