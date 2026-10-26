import { Router } from "express";
import FacturaVenta from "../models/FacturaVenta.js";
import AlbaranVenta from "../models/AlbaranVenta.js";
import Empresa from "../models/Empresa.js";
import RegistroFacturacion from "../models/RegistroFacturacion.js";
import { generarPdfFactura } from "../services/factura-pdf.js";
import { calcularTotales, limpiarLineas } from "../services/totales.js";
import { extraerAutofactura } from "../services/ocr-gemini.js";
import { validarNIF, normalizarNIF } from "../services/validacion.js";
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
import { envioPermitido } from "../services/verifactu-envio.js";
import { serializarRegistro } from "../services/registro-cola.js";
import { ejercicioCerrado, errorEjercicioCerrado } from "./cierres.js";
import { moverStock } from "../services/stock.js";
import { leerArchivo, guardarArchivo, urlPublica } from "../services/storage.js";
import Cliente from "../models/Cliente.js";
import Contador from "../models/Contador.js";
import { contextoActual, conContexto, slugActual } from "../models/tenant.js";
import { contextoTrasSubida } from "../middleware/empresa.js";
import { uploadMemoria } from "../middleware/upload.js";

const router = Router();

function inicioDelDia(valor) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  fecha.setHours(0, 0, 0, 0);
  return fecha;
}

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
    // Las autofacturas (facturación por el destinatario) tienen su propia
    // sección. El listado general de Ventas no las mezcla; la tesorería sí
    // las ve (pendientesCobro) porque son cobros como cualquier otro.
    if (req.query.tipoDocumento === "autofactura") {
      filtro.tipoDocumento = "autofactura";
    } else if (req.query.pendientesCobro !== "1") {
      filtro.tipoDocumento = { $ne: "autofactura" };
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

// --- Autofacturas (facturación por el destinatario) ---

const subidaAutofactura = uploadMemoria;

// Normaliza números de documento para compararlos entre sí: ignora
// mayúsculas, espacios y separadores, y las confusiones clásicas O↔0 e I↔1.
function claveNumeroAutofactura(numero) {
  return String(numero ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s./_-]/g, "")
    .replace(/O/g, "0")
    .replace(/I/g, "1");
}

// Busca una autofactura ya registrada con el mismo número de documento
// (el número original de la contraparte: es único por empresa emisora).
async function autofacturaDuplicada(numero, excluirId) {
  const n = String(numero ?? "").trim();
  if (!n) return null;
  const clave = claveNumeroAutofactura(n);
  const candidatas = await FacturaVenta.find({ tipoDocumento: "autofactura" })
    .select("serieNumero cliente estado")
    .populate("cliente", "nombre")
    .lean();
  return (
    candidatas.find(
      (f) => String(f._id) !== String(excluirId ?? "") && claveNumeroAutofactura(f.serieNumero) === clave
    ) ?? null
  );
}

// Siguiente número de la serie interna AUTO-<año>, con contador atómico
// inicializado al máximo ya usado en esa serie. Las autofacturas guardan en
// `serieNumero` el número ORIGINAL de la contraparte, así que el máximo se
// calcula por los campos `serie` + `numero` (no por serieNumero).
async function siguienteNumeroAutofactura(ano) {
  const clave = `autofactura:AUTO-${ano}`;
  const existe = await Contador.findOne({ clave }).lean();
  if (!existe) {
    const usados = await FacturaVenta.find({ serie: `AUTO-${ano}` }).select("numero").lean();
    const maximo = usados.reduce((max, d) => Math.max(max, Number(d.numero) || 0), 0);
    await Contador.findOneAndUpdate({ clave }, { $setOnInsert: { valor: maximo } }, { upsert: true });
  }
  const contador = await Contador.findOneAndUpdate({ clave }, { $inc: { valor: 1 } }, { new: true });
  return contador.valor;
}

// Sube el PDF (o foto) de una autofactura recibida, la lee con OCR y crea
// un BORRADOR con lo extraído para revisión humana: nada se contabiliza ni
// aparece en tesorería hasta que se valida (POST /:id/validar-autofactura).
router.post("/autofacturas/ocr", subidaAutofactura.single("documento"), contextoTrasSubida, async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Falta el fichero (campo 'documento') o el tipo no es PDF/PNG/JPG/WEBP" });
    }
    const tiposValidos = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!tiposValidos.includes(req.file.mimetype)) {
      return res
        .status(400)
        .json({ error: "Falta el fichero (campo 'documento') o el tipo no es PDF/PNG/JPG/WEBP" });
    }
    // El contexto de empresa se guarda antes de esperar al OCR: esa espera
    // puede volver con el contexto de otra petición y las escrituras
    // acabarían en otra base.
    const empresaCtx = contextoActual();
    const extraccion = await extraerAutofactura(req.file);

    return await conContexto(empresaCtx, async () => {
      const avisos = [...(extraccion._ocr?.avisos ?? [])];
      const nombreContraparte = String(extraccion.contraparte?.nombre ?? "").trim();
      const nifOcr = String(extraccion.contraparte?.nif ?? "").trim();
      const numero = String(extraccion.numeroDocumento ?? "").trim();
      const confianza = extraccion.confianza ?? 0;
      if (confianza < 0.75) avisos.push(`Confianza OCR baja (${Math.round(confianza * 100)} %)`);
      if (extraccion.divisa && extraccion.divisa !== "EUR") {
        avisos.push(
          "El documento parece no estar en euros: revísalo antes de validar (una autofactura española debe estar en EUR)."
        );
      }

      // Mismo documento subido dos veces: no se crea un duplicado.
      if (numero) {
        const dup = await autofacturaDuplicada(numero);
        if (dup) {
          return res.status(409).json({
            error: `Ya existe una autofactura con el número ${dup.serieNumero}${dup.cliente?.nombre ? ` (${dup.cliente.nombre})` : ""}. Si es este mismo documento, no lo subas de nuevo; si es otro distinto, revisa el número.`,
          });
        }
      }

      // Contraparte → cliente: se identifica por NIF (y si no, por nombre
      // exacto, avisando). Si no existe, se da de alta con los datos leídos,
      // igual que en la importación histórica.
      let cliente = null;
      if (nifOcr) {
        cliente = await Cliente.findOne({ nif: normalizarNIF(nifOcr) });
      }
      if (!cliente && nombreContraparte) {
        const objetivo = nombreContraparte.toLowerCase();
        const candidatos = await Cliente.find({}).select("nombre").limit(2000).lean();
        const porNombre = candidatos.find((c) => String(c.nombre ?? "").trim().toLowerCase() === objetivo);
        if (porNombre) {
          cliente = porNombre;
          avisos.push(
            "La contraparte se ha identificado por el nombre: el NIF leído no coincide con el de su ficha. Revísalo antes de validar."
          );
        }
      }
      if (!cliente) {
        if (!nifOcr || !validarNIF(nifOcr)) {
          return res.status(422).json({
            error: `No se ha podido identificar a la contraparte (${nombreContraparte || "sin nombre"}, NIF "${nifOcr || "no leído"}"). Crea primero su ficha en Clientes y vuelve a subir el documento.`,
          });
        }
        cliente = await Cliente.create({
          nombre: nombreContraparte,
          nif: normalizarNIF(nifOcr),
          notas: "Alta automática al subir una autofactura por OCR.",
        });
      }

      // Importes: se completan los que falten a partir de los otros y, si no
      // cuadran, manda el total (es el dato que mejor se lee).
      const ivaPorc = [21, 10, 4, 0].includes(Number(extraccion.ivaPorcentaje))
        ? Number(extraccion.ivaPorcentaje)
        : 21;
      let base = Number(extraccion.baseImponible) || 0;
      let cuota = Number(extraccion.cuotaIva) || 0;
      let total = Number(extraccion.total) || 0;
      if (!base && total && cuota) base = Math.round((total - cuota) * 100) / 100;
      if (!cuota && base) cuota = Math.round(base * ivaPorc) / 100;
      if (!total && base) total = Math.round((base + cuota) * 100) / 100;
      if (!(base > 0) || !(total > 0)) {
        return res.status(422).json({
          error: "No se han podido leer los importes del documento. Prueba con un PDF o una foto más nítidos.",
        });
      }
      if (Math.abs(base + cuota - total) > 0.05) {
        base = Math.round((total / (1 + ivaPorc / 100)) * 100) / 100;
        cuota = Math.round((total - base) * 100) / 100;
        avisos.push("La base y el IVA leídos no cuadraban con el total: se han recalculado a partir del total. Revísalos.");
      }

      const fechaExpedicion =
        extraccion.fecha && /^\d{4}-\d{2}-\d{2}$/.test(extraccion.fecha)
          ? new Date(`${extraccion.fecha}T12:00:00`)
          : new Date();
      if (!extraccion.fecha) {
        avisos.push("No se ha leído la fecha del documento: se ha puesto la de hoy. Corrígela si no es correcta.");
      }
      const anoDoc = fechaExpedicion.getFullYear();
      if (await ejercicioCerrado(anoDoc)) {
        return res.status(409).json({ error: errorEjercicioCerrado(anoDoc) });
      }

      const slug = slugActual();
      const nombreFichero = `${Date.now()}-${req.file.originalname.replace(/[^\w.\-]+/g, "_")}`;
      const remoto = `uploads/${slug}/documentos/${nombreFichero}`;
      await guardarArchivo(remoto, req.file.buffer, req.file.mimetype || "application/octet-stream");
      const ficheroUrl = urlPublica(remoto);

      const empresaDoc = await Empresa.findOne();
      const concepto =
        String(extraccion.concepto ?? "").trim() || `Liquidación de comisiones: ${nombreContraparte}`;
      const factura = await FacturaVenta.create({
        empresa: empresaDoc?._id,
        tipoDocumento: "autofactura",
        estado: "borrador",
        serieNumero: numero || null,
        fechaExpedicion,
        vencimiento: extraccion.fechaVencimiento
          ? new Date(`${extraccion.fechaVencimiento}T12:00:00`)
          : undefined,
        cliente: cliente._id,
        descripcion: concepto,
        lineas: [{ descripcion: concepto, cantidad: 1, precioUnitario: base, iva: ivaPorc }],
        baseImponible: base,
        cuotaIva: cuota,
        total,
        metodoPago: "Transferencia",
        documentoOriginal: ficheroUrl,
        notaImportacion:
          "Creada desde OCR al subir el documento. Revisa los datos y valídala: hasta entonces no cuenta en informes ni en tesorería.",
        ocr: { confianza, ficheroUrl, datosExtraidos: { ...extraccion, avisos } },
      });

      res.status(201).json({
        documento: conTesoreria(await factura.populate("cliente", "nombre nif")),
        avisos,
      });
    });
  } catch (err) {
    if (err.message?.includes("GEMINI_API_KEY") || err.message?.includes("servicio de OCR")) {
      return res.status(503).json({ error: err.message });
    }
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
    if (!Number.isFinite(totales.total)) {
      return res.status(422).json({ error: "El total de la factura no es válido. Revisa las líneas." });
    }
    // El vencimiento nunca puede ser anterior a la fecha de expedición:
    // descuadraría la antigüedad de saldos y la conciliación.
    const fechaExpedicion = inicioDelDia(req.body.fechaExpedicion ?? new Date());
    const vencimiento = req.body.vencimiento ? inicioDelDia(req.body.vencimiento) : null;
    if (vencimiento && fechaExpedicion && vencimiento < fechaExpedicion) {
      return res.status(400).json({ error: "El vencimiento no puede ser anterior a la fecha de expedición" });
    }
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
    if (!Number.isFinite(totales.total)) {
      return res.status(422).json({ error: "El total de la factura no es válido. Revisa las líneas." });
    }
    const vencimientoNuevo = req.body.vencimiento ? inicioDelDia(req.body.vencimiento) : inicioDelDia(factura.vencimiento);
    const fechaExpedicion = inicioDelDia(req.body.fechaExpedicion ?? factura.fechaExpedicion);
    if (vencimientoNuevo && fechaExpedicion && vencimientoNuevo < fechaExpedicion) {
      return res.status(400).json({ error: "El vencimiento no puede ser anterior a la fecha de expedición" });
    }
    const empresa = await Empresa.findById(factura.empresa) ?? (await Empresa.findOne());
    const metodo = buscarMetodoPago(empresa, req.body.metodoPago);
    const cambios = {
      cliente: req.body.cliente,
      lineas,
      ...totales,
      metodoPago: req.body.metodoPago,
      matricula: req.body.matricula,
      direccionEntrega: req.body.direccionEntrega,
      vencimiento: req.body.vencimiento ? new Date(req.body.vencimiento) : factura.vencimiento,
      plazos: [],
    };
    // Autofacturas en borrador (revisión del OCR): además de lo normal, se
    // puede corregir el número del documento original, la fecha y el
    // concepto leídos.
    if (factura.tipoDocumento === "autofactura") {
      const nuevoNumero = String(req.body.serieNumero ?? "").trim();
      if (nuevoNumero) {
        const dup = await autofacturaDuplicada(nuevoNumero, factura._id);
        if (dup) {
          return res.status(409).json({
            error: `Ya existe una autofactura con el número ${dup.serieNumero}${dup.cliente?.nombre ? ` (${dup.cliente.nombre})` : ""}`,
          });
        }
        cambios.serieNumero = nuevoNumero;
      }
      if (req.body.fechaExpedicion) {
        cambios.fechaExpedicion = inicioDelDia(req.body.fechaExpedicion);
      }
      if (req.body.descripcion != null) {
        cambios.descripcion = req.body.descripcion;
      }
    }
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
    // Reserva atómica antes de empezar: un doble clic o un reintento de la
    // cola offline solo puede entrar una vez; el segundo recibe 409 y no
    // genera un segundo registro VeriFactu ni gasta un número.
    const claim = await FacturaVenta.findOneAndUpdate(
      {
        _id: req.params.id,
        estado: "borrador",
        $or: [{ emisionEnCurso: null }, { emisionEnCurso: { $lt: new Date(Date.now() - 2 * 60 * 1000) } }],
      },
      { $set: { emisionEnCurso: new Date() } }
    );
    if (!claim) {
      const existe = await FacturaVenta.findById(req.params.id).lean();
      if (!existe) return res.status(404).json({ error: "Factura no encontrada" });
      if (existe.estado !== "borrador") {
        return res.status(409).json({ error: `La factura ya está ${existe.estado}` });
      }
      return res.status(409).json({ error: "La factura se está emitiendo. Espera un momento." });
    }

    try {
    const factura = await FacturaVenta.findById(req.params.id).populate("cliente", "nombre nif");
    if (!factura) return res.status(404).json({ error: "Factura no encontrada" });

    // La fecha de un borrador es provisional (el día en que se creó); la
    // factura nace legalmente al validar. Si se valida otro día, la fecha de
    // expedición pasa a ser el de la validación — también para la serie, que
    // lleva el año del documento. Una fecha futura (casos programáticos) se
    // respeta.
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const inicioFecha = factura.fechaExpedicion ? new Date(factura.fechaExpedicion) : null;
    if (inicioFecha) inicioFecha.setHours(0, 0, 0, 0);
    if (!inicioFecha || inicioFecha < inicioHoy) {
      factura.fechaExpedicion = new Date();
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

    // Si el envío a la AEAT todavía no está activado, la factura se registra
    // con su huella y su QR pero nace marcada como "no remitida": no entra en
    // la cola de envío y no se mandará el día que se active. Solo se remite lo
    // emitido a partir de la activación.
    const puedeEnviar = await envioPermitido();
    const estadoInicial = puedeEnviar ? "pendiente" : "no_remitido";

    const registro = await RegistroFacturacion.create({
      empresa: empresa._id,
      facturaVenta: factura._id,
      tipo: "alta",
      numSerieFactura: serieNumero,
      fechaExpedicionFactura: fechaExpedicion,
      huella,
      huellaAnterior,
      xml,
      estadoEnvio: estadoInicial,
    });

    factura.serie = nombreSerie;
    factura.numero = numero;
    factura.serieNumero = serieNumero;
    factura.estado = "emitida";
    factura.emisionEnCurso = null;
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
      estadoEnvio: estadoInicial,
      fechaRegistro: new Date(),
    };
    await factura.save();

    // Salida de stock al emitir. Si la factura viene de albaranes, el stock
    // ya se descontó al crear esos albaranes: no se mueve dos veces.
    if (!factura.origen?.albaranes?.length) {
      await moverStock(factura.lineas, -1);
    }

    // Remisión a la AEAT: se hace en segundo plano para no bloquear al
    // usuario. El registro ya está guardado; el reintento automático o manual
    // lo terminará si falla. La factura es válida igualmente: tiene huella y QR.
    const certAeat = puedeEnviar ? await certificadoActual() : null;
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
    } catch (errorEmision) {
      // Si la emisión no llegó a terminar, la reserva se libera para que el
      // borrador pueda emitirse de nuevo (los registros VeriFactu creados a
      // medias quedan enlazados a la factura y no molestan: solo uno llega
      // a existir por reserva).
      await FacturaVenta.updateOne(
        { _id: req.params.id, estado: "borrador" },
        { $unset: { emisionEnCurso: "" } }
      ).catch(() => {});
      throw errorEmision;
    }
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
    if (original.verifactu?.estadoEnvio === "historica") {
      return res.status(409).json({ error: "La factura es histórica y no se puede rectificar desde FILANEX. Corrígela según el procedimiento fiscal aplicable." });
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
    // Se conserva el enlace al artículo para reponer el stock devuelto.
    const lineas = original.lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precioUnitario: -Math.abs(l.precioUnitario),
      iva: l.iva,
      ...(l.articulo ? { articulo: l.articulo } : {}),
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

    // Igual que en la emisión: si el envío no está activado, nace "no remitida".
    const puedeEnviarRect = await envioPermitido();
    const estadoRect = puedeEnviarRect ? "pendiente" : "no_remitido";

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
        estadoEnvio: estadoRect,
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
      estadoEnvio: estadoRect,
    });

    original.estado = "rectificada";
    await original.save();

    // Entrada de stock: la mercancía rectificada vuelve al almacén.
    await moverStock(original.lineas, +1);

    const certRect = puedeEnviarRect ? await certificadoActual() : null;
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
    // Si el borrador venía de albaranes, los deja libres para volver a facturar.
    if (factura.origen?.albaranes?.length) {
      await AlbaranVenta.updateMany(
        { _id: { $in: factura.origen.albaranes } },
        { estado: "pendiente", $unset: { facturaVenta: 1 } }
      );
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Valida una autofactura en borrador: le asigna la serie interna AUTO-<año>
// con su número secuencial y la activa como venta histórica (no genera
// registro VeriFactu: el documento lo emitió la contraparte, no FILANEX).
// Hasta aquí era solo un borrador de revisión del OCR.
router.post("/:id/validar-autofactura", async (req, res, next) => {
  try {
    const factura = await FacturaVenta.findById(req.params.id);
    if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
    if (factura.tipoDocumento !== "autofactura") {
      return res.status(400).json({ error: "No es una autofactura" });
    }
    if (factura.estado !== "borrador") {
      return res.status(409).json({ error: `La autofactura ya está ${factura.estado}` });
    }
    const ano = new Date(factura.fechaExpedicion ?? Date.now()).getFullYear();
    if (await ejercicioCerrado(ano)) {
      return res.status(409).json({ error: errorEjercicioCerrado(ano) });
    }
    factura.serie = `AUTO-${ano}`;
    factura.numero = await siguienteNumeroAutofactura(ano);
    factura.estado = "emitida";
    factura.verifactu = { enviada: false, estadoEnvio: "historica" };
    await factura.save();
    const validada = await FacturaVenta.findById(factura._id).populate("cliente", "nombre nif");
    res.json(conTesoreria(validada));
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
// $push atómico: dos cobros simultáneos no se pisan entre sí.
const METODOS_COBRO = new Set(["transferencia", "efectivo", "tarjeta", "remesa", "otro"]);
router.post("/:id/cobros", async (req, res, next) => {
  try {
    const { importe, fecha, metodo, notas } = req.body;
    if (!(importe > 0)) return res.status(400).json({ error: "importe debe ser mayor que cero" });
    const factura = await FacturaVenta.findOneAndUpdate(
      { _id: req.params.id, estado: "emitida" },
      {
        $push: {
          cobros: {
            importe,
            fecha: fecha ? new Date(fecha) : new Date(),
            metodo: METODOS_COBRO.has(metodo) ? metodo : "otro",
            notas,
          },
        },
      },
      { new: true }
    );
    if (!factura) {
      const existe = await FacturaVenta.findById(req.params.id).lean();
      if (!existe) return res.status(404).json({ error: "Factura no encontrada" });
      return res.status(409).json({ error: "Solo se cobran facturas emitidas" });
    }
    res.json(conTesoreria(factura));
  } catch (err) {
    next(err);
  }
});

// Quita un cobro registrado (se metió mal: importe, fecha, método...). Es un
// dato interno de tesorería, no forma parte del registro VeriFactu, así que
// se puede borrar sin tocar la cadena de huellas. Al quitarlo, la factura
// vuelve a aparecer como pendiente o parcial según lo que quede cobrado.
router.delete("/:id/cobros/:cobroId", async (req, res, next) => {
  try {
    const factura = await FacturaVenta.findOneAndUpdate(
      { _id: req.params.id, "cobros._id": req.params.cobroId },
      { $pull: { cobros: { _id: req.params.cobroId } } },
      { new: true }
    );
    if (!factura) {
      const existe = await FacturaVenta.findById(req.params.id).lean();
      if (!existe) return res.status(404).json({ error: "Factura no encontrada" });
      return res.status(404).json({ error: "Cobro no encontrado" });
    }
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
    if (factura.documentoOriginal) {
      const ruta = factura.documentoOriginal.startsWith("/")
        ? factura.documentoOriginal.slice(1)
        : factura.documentoOriginal;
      const pdf = await leerArchivo(ruta);
      const nombre = (factura.serieNumero ?? factura._id).replace(/[^a-zA-Z0-9_.-]/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="factura-${nombre}.pdf"`);
      return res.send(pdf);
    }
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
