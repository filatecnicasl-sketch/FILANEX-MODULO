import { Router } from "express";
import FacturaVenta from "../models/FacturaVenta.js";
import Empresa from "../models/Empresa.js";
import RegistroFacturacion from "../models/RegistroFacturacion.js";
import { generarPdfFactura } from "../services/factura-pdf.js";
import { calcularTotales, limpiarLineas } from "../services/totales.js";
import { buscarMetodoPago } from "../services/metodos-pago.js";
import { tomarNumero, tomarNumeroFacturaVentaAtomico } from "../services/numeracion.js";
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
import { serializarRegistro } from "../services/registro-cola.js";
import { ejercicioCerrado, errorEjercicioCerrado } from "./cierres.js";

const router = Router();

// Añade información de tesorería derivada (no persistida) a cada factura.
function conTesoreria(f) {
  const obj = f.toObject ? f.toObject() : f;
  return { ...obj, cobrado: f.cobrado(), estadoCobro: f.estadoCobro() };
}

router.get("/", async (req, res, next) => {
  try {
    const filtro = { ...(req.query.estado ? { estado: req.query.estado } : {}) };
    if (req.query.pendientesCobro === "1") {
      filtro.estado = "emitida";
    }
    const lista = await FacturaVenta.find(filtro)
      .populate("cliente", "nombre nif iban telefono comunicaciones")
      .populate("rectifica", "serieNumero")
      .sort({ serie: 1, numero: 1 })
      .limit(200);
    let resultado = lista.map(conTesoreria);
    if (req.query.pendientesCobro === "1") {
      resultado = resultado.filter((f) => f.estadoCobro !== "cobrada");
    }
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// Crea la factura en estado borrador (aún no genera registro VeriFactu).
router.post("/", async (req, res, next) => {
  try {
    const { cliente } = req.body;
    const lineas = limpiarLineas(req.body.lineas);
    if (!cliente || !lineas) {
      return res.status(400).json({ error: "cliente y al menos una línea con descripción son obligatorios" });
    }
    // Ejercicio cerrado: no se pueden crear documentos con fecha de ese año.
    const anoDoc = new Date(req.body.fechaExpedicion ?? Date.now()).getFullYear();
    if (await ejercicioCerrado(anoDoc)) {
      return res.status(409).json({ error: errorEjercicioCerrado(anoDoc) });
    }
    const totales = calcularTotales(lineas);
    const empresa = await Empresa.findOne();
    const datos = {
      ...req.body,
      lineas,
      ...totales,
      empresa: empresa?._id,
    };
    // El método de pago sale del catálogo de la empresa (Sistema → Series).
    // Si tiene plazos (p.ej. [30, 60, 90]) se generan esos vencimientos a
    // partes iguales y el vencimiento "global" es el del último plazo.
    const metodo = buscarMetodoPago(empresa, req.body.metodoPago);
    if (metodo?.plazos?.length > 0) {
      const n = metodo.plazos.length;
      const parte = Math.floor((totales.total / n) * 100) / 100;
      const ultimo = Math.round((totales.total - (n - 1) * parte) * 100) / 100;
      datos.plazos = metodo.plazos.map((dias, i) => ({
        fecha: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
        importe: i < n - 1 ? parte : ultimo,
      }));
      datos.vencimiento = req.body.vencimiento
        ? new Date(req.body.vencimiento)
        : datos.plazos[n - 1].fecha;
    } else {
      // Vencimiento por defecto: 30 días desde hoy si no se indica otro.
      datos.vencimiento = req.body.vencimiento
        ? new Date(req.body.vencimiento)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    const factura = await FacturaVenta.create(datos);
    res.status(201).json(factura);
  } catch (err) {
    next(err);
  }
});

// Modifica una factura mientras siga siendo borrador. Una vez emitida,
// VeriFactu impide alterar sus datos y debe usarse una rectificativa.
router.put("/:id", async (req, res, next) => {
  try {
    const factura = await FacturaVenta.findById(req.params.id);
    if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
    if (factura.estado !== "borrador") {
      return res.status(409).json({
        error: "Solo se pueden modificar facturas en borrador. Una factura validada debe corregirse mediante una rectificativa",
      });
    }
    const anoDoc = new Date(factura.fechaExpedicion ?? Date.now()).getFullYear();
    if (await ejercicioCerrado(anoDoc)) {
      return res.status(409).json({ error: errorEjercicioCerrado(anoDoc) });
    }
    const lineas = limpiarLineas(req.body.lineas);
    if (!req.body.cliente || !lineas) {
      return res.status(400).json({ error: "cliente y al menos una línea con descripción son obligatorios" });
    }
    const totales = calcularTotales(lineas);
    const empresa = await Empresa.findById(factura.empresa) ?? (await Empresa.findOne());
    const metodo = buscarMetodoPago(empresa, req.body.metodoPago);
    const cambios = {
      cliente: req.body.cliente,
      lineas,
      ...totales,
      metodoPago: req.body.metodoPago,
      direccionEntrega: req.body.direccionEntrega,
      vencimiento: req.body.vencimiento ? new Date(req.body.vencimiento) : factura.vencimiento,
      plazos: [],
    };
    if (metodo?.plazos?.length > 0) {
      const n = metodo.plazos.length;
      const parte = Math.floor((totales.total / n) * 100) / 100;
      const ultimo = Math.round((totales.total - (n - 1) * parte) * 100) / 100;
      cambios.plazos = metodo.plazos.map((dias, indice) => ({
        fecha: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
        importe: indice < n - 1 ? parte : ultimo,
      }));
      if (!req.body.vencimiento) cambios.vencimiento = cambios.plazos[n - 1].fecha;
    }
    Object.assign(factura, cambios);
    await factura.save();
    res.json(factura);
  } catch (err) {
    next(err);
  }
});

// Emite la factura: número por serie, registro de alta con huella
// encadenada, QR y (si hay certificado configurado) remisión a la AEAT.
router.post("/:id/emitir", serializarRegistro, async (req, res, next) => {
  try {
    const factura = await FacturaVenta.findById(req.params.id).populate("cliente", "nombre nif");
    if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
    if (factura.estado !== "borrador") {
      return res.status(409).json({ error: `La factura ya está ${factura.estado}` });
    }

    // MVP monoinquilino: una única empresa configurada.
    const empresa = await Empresa.findById(factura.empresa) ?? (await Empresa.findOne());
    if (!empresa) {
      return res.status(503).json({ error: "No hay empresa configurada (ver /api/configuracion)" });
    }
    const anoDoc = new Date(factura.fechaExpedicion ?? Date.now()).getFullYear();
    if (await ejercicioCerrado(anoDoc)) {
      return res.status(409).json({ error: errorEjercicioCerrado(anoDoc) });
    }
    // Numeración atómica con contador separado: libre de duplicados y sin
    // bloquear el documento Empresa. La serie lleva el año del documento
    // (A-2027-…), con renumeración a 1 cada 1 de enero.
    const { serie: nombreSerie, numero, serieNumero } = await tomarNumeroFacturaVentaAtomico(empresa, { ano: anoDoc });
    const fechaExpedicion = fechaDDMMYYYY(factura.fechaExpedicion);
    const fechaHoraGen = timestampRegistro();

    const ultimo = await RegistroFacturacion.findOne({ empresa: empresa._id }).sort({ _id: -1 });
    const huellaAnterior = ultimo?.huella ?? "";

    const huella = huellaAlta({
      nifEmisor: empresa.nif,
      numSerie: serieNumero,
      fechaExpedicion,
      tipoFactura: "F1",
      cuotaTotal: factura.cuotaIva,
      importeTotal: factura.total,
      huellaAnterior,
      fechaHoraGen,
    });

    const registroAnterior = ultimo
      ? {
          emisor: empresa.nif,
          numSerie: ultimo.numSerieFactura,
          fecha: ultimo.fechaExpedicionFactura,
          huella: ultimo.huella,
        }
      : null;

    const xmlRegistro = xmlRegistroAlta({
      empresa,
      factura: { ...factura.toObject(), serieNumero, descripcion: factura.descripcion },
      huella,
      fechaHoraGen,
      registroAnterior,
    });
    const xml = sobreSoap(empresa, xmlRegistro);

    const registro = await RegistroFacturacion.create({
      empresa: empresa._id,
      facturaVenta: factura._id,
      tipo: "alta",
      numSerieFactura: serieNumero,
      fechaExpedicionFactura: fechaExpedicion,
      huella,
      huellaAnterior,
      xml,
    });

    factura.serie = nombreSerie;
    factura.numero = numero;
    factura.serieNumero = serieNumero;
    factura.estado = "emitida";
    factura.verifactu = {
      huella,
      huellaAnterior,
      qrContenido: contenidoQr({
        nif: empresa.nif,
        numSerie: serieNumero,
        fechaExpedicion,
        total: factura.total,
      }),
      enviada: false,
      estadoEnvio: "pendiente",
      fechaRegistro: new Date(),
    };
    await factura.save();

    // Remisión a la AEAT: se hace en segundo plano para no bloquear al
    // usuario. El registro ya está guardado como pendiente; el reintento
    // automático o manual lo terminará si falla. Si no hay certificado,
    // simplemente queda pendiente.
    const certAeat = await certificadoActual();
    if (certAeat) {
      // Lanzamos sin await: la respuesta HTTP se envía antes de contactar con AEAT.
      (async () => {
        try {
          const resp = await remitirAeat(xml, certAeat);
          const aceptado = /EstadoEnvio>Correcto</.test(resp.cuerpo);
          const conErrores = /AceptadoConErrores/.test(resp.cuerpo);
          const estado = aceptado ? "aceptado" : conErrores ? "aceptado_con_errores" : "rechazado";
          registro.estadoEnvio = estado;
          registro.respuestaAeat = { httpStatus: resp.httpStatus, cuerpo: resp.cuerpo.slice(0, 4000) };
          await registro.save();
          await FacturaVenta.findByIdAndUpdate(factura._id, {
            "verifactu.enviada": aceptado || conErrores,
            "verifactu.estadoEnvio": estado,
          });
        } catch (e) {
          registro.respuestaAeat = { error: e.message };
          await registro.save().catch(() => {});
        }
      })();
    }

    res.json(factura);
  } catch (err) {
    next(err);
  }
});

// Crea la factura rectificativa de una emitida: importes en negativo,
// registro VeriFactu de alta tipo R1 y la original pasa a "rectificada".
router.post("/:id/rectificativa", serializarRegistro, async (req, res, next) => {
  try {
    const original = await FacturaVenta.findById(req.params.id).populate("cliente", "nombre nif");
    if (!original) return res.status(404).json({ error: "Factura no encontrada" });
    if (original.estado !== "emitida") {
      return res.status(409).json({ error: "Solo se pueden rectificar facturas emitidas" });
    }
    if (original.rectifica) {
      return res.status(409).json({ error: "No se puede rectificar una rectificativa" });
    }

    const empresa = await Empresa.findById(original.empresa) ?? (await Empresa.findOne());
    if (!empresa) return res.status(503).json({ error: "No hay empresa configurada" });

    // La rectificativa se numera en el ejercicio ACTUAL (la corrección de un
    // año cerrado se registra en el año en curso, como exige la AEAT).
    const { serie, numero, serieNumero } = await tomarNumeroFacturaVentaAtomico(empresa);

    // Líneas y totales en negativo (rectificación íntegra por sustitución).
    const lineas = original.lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precioUnitario: -Math.abs(l.precioUnitario),
      iva: l.iva,
    }));
    const totales = calcularTotales(lineas);
    const fechaExpedicion = fechaDDMMYYYY(new Date());
    const fechaHoraGen = timestampRegistro();

    const ultimo = await RegistroFacturacion.findOne({ empresa: empresa._id }).sort({ _id: -1 });
    const huellaAnterior = ultimo?.huella ?? "";

    const huella = huellaAlta({
      nifEmisor: empresa.nif,
      numSerie: serieNumero,
      fechaExpedicion,
      tipoFactura: "R1",
      cuotaTotal: totales.cuotaIva,
      importeTotal: totales.total,
      huellaAnterior,
      fechaHoraGen,
    });

    const registroAnterior = ultimo
      ? {
          emisor: empresa.nif,
          numSerie: ultimo.numSerieFactura,
          fecha: ultimo.fechaExpedicionFactura,
          huella: ultimo.huella,
        }
      : null;

    const xmlRegistro = xmlRegistroAlta({
      empresa,
      factura: {
        ...original.toObject(),
        lineas,
        ...totales,
        serieNumero,
        fechaExpedicion: new Date(),
        descripcion: `Rectificativa de ${original.serieNumero}`,
      },
      huella,
      fechaHoraGen,
      registroAnterior,
      tipoFactura: "R1",
      facturaRectificada: {
        numSerie: original.serieNumero,
        fecha: fechaDDMMYYYY(original.fechaExpedicion),
      },
    });
    const xml = sobreSoap(empresa, xmlRegistro);

    const rectificativa = await FacturaVenta.create({
      empresa: empresa._id,
      cliente: original.cliente._id,
      lineas,
      ...totales,
      estado: "emitida",
      descripcion: `Rectificativa de ${original.serieNumero}`,
      rectifica: original._id,
      serie,
      numero,
      serieNumero,
      fechaExpedicion: new Date(),
      verifactu: {
        huella,
        huellaAnterior,
        qrContenido: contenidoQr({
          nif: empresa.nif,
          numSerie: serieNumero,
          fechaExpedicion,
          total: totales.total,
        }),
        enviada: false,
        estadoEnvio: "pendiente",
        fechaRegistro: new Date(),
      },
    });

    await RegistroFacturacion.create({
      empresa: empresa._id,
      facturaVenta: rectificativa._id,
      tipo: "alta",
      numSerieFactura: serieNumero,
      fechaExpedicionFactura: fechaExpedicion,
      huella,
      huellaAnterior,
      xml,
    });

    original.estado = "rectificada";
    await original.save();

    const certRect = await certificadoActual();
    if (certRect) {
      try {
        const resp = await remitirAeat(xml, certRect);
        const aceptado = /EstadoEnvio>Correcto</.test(resp.cuerpo);
        const conErrores = /AceptadoConErrores/.test(resp.cuerpo);
        rectificativa.verifactu.enviada = aceptado || conErrores;
        rectificativa.verifactu.estadoEnvio = aceptado
          ? "aceptado"
          : conErrores
            ? "aceptado_con_errores"
            : "rechazado";
        await rectificativa.save();
      } catch {
        // Queda pendiente de reintento desde Sistema → VeriFactu.
      }
    }

    res.status(201).json(rectificativa);
  } catch (err) {
    next(err);
  }
});

// Elimina una factura en borrador (aún no tiene registro VeriFactu).
// Una emitida NO se puede borrar: solo rectificar (POST /:id/rectificativa).
router.delete("/:id", async (req, res, next) => {
  try {
    const factura = await FacturaVenta.findById(req.params.id);
    if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
    if (factura.estado !== "borrador") {
      return res.status(409).json({
        error: "Solo se pueden eliminar borradores. Una factura validada ya está en VeriFactu: corrígela con una factura rectificativa",
      });
    }
    const anoDoc = new Date(factura.fechaExpedicion ?? Date.now()).getFullYear();
    if (await ejercicioCerrado(anoDoc)) {
      return res.status(409).json({ error: errorEjercicioCerrado(anoDoc) });
    }
    await factura.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Una factura emitida ya tiene registro en VeriFactu: no se puede anular,
// solo corregir mediante factura rectificativa (POST /:id/rectificativa).
router.post("/:id/anular", async (req, res, next) => {
  try {
    const factura = await FacturaVenta.findById(req.params.id);
    if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
    return res.status(409).json({
      error: "Una factura validada ya está en VeriFactu y no se puede anular: corrígela con una factura rectificativa",
    });
  } catch (err) {
    next(err);
  }
});

// Registra un cobro (total o parcial) de una factura emitida.
router.post("/:id/cobros", async (req, res, next) => {
  try {
    const { importe, fecha, metodo, notas } = req.body;
    if (!(importe > 0)) return res.status(400).json({ error: "importe debe ser mayor que cero" });
    const factura = await FacturaVenta.findById(req.params.id);
    if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
    if (factura.estado !== "emitida") {
      return res.status(409).json({ error: "Solo se cobran facturas emitidas" });
    }
    factura.cobros.push({ importe, fecha: fecha ? new Date(fecha) : new Date(), metodo, notas });
    await factura.save();
    res.json(conTesoreria(factura));
  } catch (err) {
    next(err);
  }
});

// Actualiza la fecha de vencimiento.
router.post("/:id/vencimiento", async (req, res, next) => {
  try {
    const { vencimiento } = req.body;
    const factura = await FacturaVenta.findByIdAndUpdate(
      req.params.id,
      { vencimiento: vencimiento ? new Date(vencimiento) : null },
      { new: true }
    );
    if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
    res.json(conTesoreria(factura));
  } catch (err) {
    next(err);
  }
});

// PDF de la factura (con QR tributario si está emitida).
router.get("/:id/pdf", async (req, res, next) => {
  try {
    const factura = await FacturaVenta.findById(req.params.id).populate("cliente", "nombre nif direccion");
    if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
    const empresa = await Empresa.findById(factura.empresa) ?? (await Empresa.findOne());
    const pdf = await generarPdfFactura({ empresa, factura, cliente: factura.cliente });
    const nombre = factura.serieNumero ?? factura._id;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="factura-${nombre}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

// XML del registro VeriFactu de alta (solo facturas ya emitidas).
router.get("/:id/xml", async (req, res, next) => {
  try {
    const factura = await FacturaVenta.findById(req.params.id);
    if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
    const registro = await RegistroFacturacion.findOne({
      facturaVenta: factura._id,
      tipo: "alta",
    }).sort({ _id: -1 });
    if (!registro) {
      return res.status(409).json({ error: "La factura aún no tiene registro VeriFactu" });
    }
    const nombre = factura.serieNumero ?? factura._id;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="verifactu-${nombre}.xml"`);
    res.send(registro.xml);
  } catch (err) {
    next(err);
  }
});

export default router;
