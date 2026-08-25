// Módulo ASESORÍA: cartera de clientes de la asesoría, documentación fiscal
// con OCR, bandeja de revisión, libros de IVA y calendario de obligaciones.
import { Router } from "express";
import ClienteAsesoria, { MODELOS_FISCALES } from "../models/ClienteAsesoria.js";
import DocumentoFiscal from "../models/DocumentoFiscal.js";
import SolicitudDocumento from "../models/SolicitudDocumento.js";
import CierreTrimestral, { ESTADOS_CIERRE } from "../models/CierreTrimestral.js";
import Empresa from "../models/Empresa.js";
import { requiereModulo } from "../config/modulos.js";
import { extraerDocumentoCompra, extraerTicket } from "../services/ocr-gemini.js";
import { cuadrarIva } from "../services/validar-ocr.js";
import { contextoActual, conContexto, slugActual } from "../models/tenant.js";
import { contextoTrasSubida } from "../middleware/empresa.js";
import { uploadMemoria } from "../middleware/upload.js";
import { guardarArchivo, urlPublica, borrarArchivo } from "../services/storage.js";

const router = Router();
router.use(requiereModulo("asesoria"));

const subida = uploadMemoria;
const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Detecta si ya existe un documento igual (mismo cliente, tercero, número y
// año): antes de contabilizar hay que saber que puede estar duplicado.
async function duplicadoDe({ clienteAsesoria, nifTercero, numero, fecha, excluirId }) {
  if (!numero) return null;
  const ano = fecha ? new Date(fecha).getFullYear() : null;
  const filtro = {
    clienteAsesoria,
    numero: String(numero).trim(),
    ...(nifTercero ? { nifTercero: String(nifTercero).toUpperCase().replace(/[\s.-]/g, "") } : {}),
    ...(ano ? { ano } : {}),
    ...(excluirId ? { _id: { $ne: excluirId } } : {}),
  };
  return DocumentoFiscal.findOne(filtro).lean();
}

// ------------------------------------------------------------- vencimientos
// Fechas oficiales habituales de los modelos (día límite de presentación).
const VENCIMIENTOS = {
  "303": [[1, 20], [4, 20], [7, 20], [10, 30]],
  "390": [[1, 30]],
  "130": [[1, 20], [4, 20], [7, 20], [10, 20]],
  "131": [[1, 20], [4, 20], [7, 20], [10, 20]],
  "100": [[6, 30]],
  "111": [[1, 20], [4, 20], [7, 20], [10, 20]],
  "190": [[1, 31]],
  "115": [[1, 20], [4, 20], [7, 20], [10, 20]],
  "180": [[1, 31]],
  "123": [[1, 20], [4, 20], [7, 20], [10, 20]],
  "349": [[1, 20], [4, 20], [7, 20], [10, 20]],
  "347": [[2, 28]],
  "200": [[7, 25]],
  "202": [[4, 20], [10, 20], [12, 20]],
  "036": [],
};

const NOMBRES_MODELOS = {
  "303": "IVA trimestral",
  "390": "Resumen anual de IVA",
  "130": "Pago fraccionado IRPF",
  "131": "Pago fraccionado IRPF (módulos)",
  "100": "Renta",
  "111": "Retenciones trabajo/profesionales",
  "190": "Resumen anual de retenciones",
  "115": "Retenciones arrendamientos",
  "180": "Resumen anual arrendamientos",
  "123": "Retenciones capital",
  "349": "Operaciones intracomunitarias",
  "347": "Operaciones con terceros",
  "200": "Impuesto de sociedades",
  "202": "Pago a cuenta sociedades",
  "036": "Censo de empresarios",
};

// Devuelve los vencimientos del año indicado para un cliente de cartera.
function vencimientosDe(cliente, ano) {
  const salida = [];
  for (const modelo of cliente.modelos ?? []) {
    for (const [mes, dia] of VENCIMIENTOS[modelo] ?? []) {
      salida.push({
        modelo,
        nombreModelo: NOMBRES_MODELOS[modelo] ?? `Modelo ${modelo}`,
        fecha: new Date(Date.UTC(ano, mes - 1, dia)),
        cliente: cliente._id,
        clienteNombre: cliente.nombre,
      });
    }
  }
  return salida;
}

// ------------------------------------------------------------------ cartera

router.get("/cartera", async (req, res, next) => {
  try {
    const { q, activo } = req.query;
    const filtro = {};
    if (activo !== undefined && activo !== "") filtro.activo = activo === "true";
    let clientes = await ClienteAsesoria.find(filtro).sort({ nombre: 1 }).lean();
    if (q) {
      const buscar = String(q).toLowerCase();
      clientes = clientes.filter((c) =>
        [c.nombre, c.nif, c.codigo, c.telefono, c.email, c.actividad]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(buscar))
      );
    }
    // Estado de documentación de cada cliente: pendientes de revisar.
    const pendientes = await DocumentoFiscal.aggregate([
      { $match: { estado: "pendiente" } },
      { $group: { _id: "$clienteAsesoria", n: { $sum: 1 } } },
    ]);
    const porCliente = new Map(pendientes.map((p) => [String(p._id), p.n]));
    res.json(clientes.map((c) => ({ ...c, pendientesRevision: porCliente.get(String(c._id)) ?? 0 })));
  } catch (err) {
    next(err);
  }
});

function datosCartera(cuerpo) {
  const salida = {};
  for (const clave of [
    "nombre", "nif", "formaJuridica", "regimenIrpf", "actividad", "epigrafe",
    "telefono", "email", "direccion", "personaContacto", "areas", "modelos",
    "numeroEmpleados", "cuotaMensual", "notas", "activo",
  ]) {
    if (cuerpo[clave] !== undefined) salida[clave] = cuerpo[clave];
  }
  return salida;
}

router.post("/cartera", async (req, res, next) => {
  try {
    const empresa = await Empresa.findOne();
    empresa.contadores = empresa.contadores ?? {};
    const siguiente = (empresa.contadores.clienteAsesoria ?? 0) + 1;
    const cliente = await ClienteAsesoria.create({
      ...datosCartera(req.body),
      codigo: String(siguiente),
    });
    empresa.contadores.clienteAsesoria = siguiente;
    await empresa.save();
    res.status(201).json(cliente);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Ya existe un cliente de la cartera con ese NIF." });
    }
    next(err);
  }
});

router.put("/cartera/:id", async (req, res, next) => {
  try {
    const cliente = await ClienteAsesoria.findByIdAndUpdate(
      req.params.id,
      datosCartera(req.body),
      { new: true, runValidators: true }
    );
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(cliente);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Ya existe un cliente de la cartera con ese NIF." });
    }
    next(err);
  }
});

router.delete("/cartera/:id", async (req, res, next) => {
  try {
    const documentos = await DocumentoFiscal.countDocuments({ clienteAsesoria: req.params.id });
    if (documentos > 0) {
      return res.status(409).json({
        error: `Tiene ${documentos} documentos. Desactívalo en lugar de borrarlo para no perder su histórico.`,
      });
    }
    const borrado = await ClienteAsesoria.findByIdAndDelete(req.params.id);
    if (!borrado) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------- documentos

router.get("/documentos", async (req, res, next) => {
  try {
    const { cliente, tipo, estado, ano, trimestre, q } = req.query;
    const filtro = {};
    if (cliente) filtro.clienteAsesoria = cliente;
    if (tipo) filtro.tipo = tipo;
    if (estado) filtro.estado = estado;
    if (ano) filtro.ano = Number(ano);
    if (trimestre) filtro.trimestre = Number(trimestre);
    let docs = await DocumentoFiscal.find(filtro)
      .populate("clienteAsesoria", "nombre nif codigo")
      .sort({ fecha: -1 })
      .limit(500)
      .lean();
    if (q) {
      const buscar = String(q).toLowerCase();
      docs = docs.filter((d) =>
        [d.tercero, d.nifTercero, d.numero, d.notas, d.clienteAsesoria?.nombre]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(buscar))
      );
    }
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

// Alta manual de un documento.
router.post("/documentos", async (req, res, next) => {
  try {
    const { clienteAsesoria, tipo, fecha, numero, tercero, nifTercero, base, tipoIva, cuotaIva, total, retencion, notas } = req.body;
    if (!clienteAsesoria || !tipo || !fecha) {
      return res.status(400).json({ error: "Cliente, tipo y fecha son obligatorios" });
    }
    const cuadre = cuadrarIva({ base, cuotaIva, total, tipoIva });
    const doc = await DocumentoFiscal.create({
      clienteAsesoria, tipo, fecha, numero, tercero, nifTercero,
      base: cuadre.base, tipoIva: cuadre.tipoIva, cuotaIva: cuadre.cuotaIva, total: cuadre.total,
      retencion: Number(retencion) || 0,
      notas, origen: "manual",
    });
    const duplicado = await duplicadoDe({
      clienteAsesoria, nifTercero, numero, fecha, excluirId: doc._id,
    });
    const avisos = duplicado
      ? [`Posible duplicado: ya hay un documento de ${duplicado.tercero ?? "ese tercero"} con el número ${numero} de ${duplicado.ano}.`]
      : [];
    res.status(201).json({ ...doc.toObject(), avisos });
  } catch (err) {
    next(err);
  }
});

// Alta por OCR: la foto/PDF se lee con la IA y queda pendiente de revisión.
router.post("/documentos/ocr", subida.single("documento"), contextoTrasSubida, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Adjunta la foto o el PDF del documento" });
    }
    const { clienteAsesoria, tipo } = req.body;
    if (!clienteAsesoria) {
      return res.status(400).json({ error: "Indica a qué cliente de la cartera pertenece" });
    }
    const tiposValidos = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!tiposValidos.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Adjunta el documento en JPG, PNG, WEBP o PDF" });
    }

    const empresa = contextoActual();
    let extraccion;
    try {
      extraccion =
        tipo === "gasto"
          ? await extraerTicket(req.file)
          : await extraerDocumentoCompra(req.file);
    } catch (fallo) {
      return res.status(502).json({ error: fallo.message });
    }

    return await conContexto(empresa, async () => {
      const nombreFichero = `${Date.now()}-${(req.file.originalname || "documento.jpg").replace(/[^\w.\-]+/g, "_")}`;
      const remoto = `uploads/${slugActual()}/asesoria/${nombreFichero}`;
      await guardarArchivo(remoto, req.file.buffer, req.file.mimetype || "application/octet-stream");
      const ficheroUrl = urlPublica(remoto);

      const cuadre = cuadrarIva(extraccion);
      const avisos = [];
      for (const pega of extraccion._ocr?.avisos ?? []) {
        avisos.push(`Revisa antes de validar: ${pega}.`);
      }
      if ((extraccion.confianza ?? 1) < 0.6) {
        avisos.push("El documento se ha leído con poca seguridad: revisa los importes.");
      }
      const posibleDuplicado = await duplicadoDe({
        clienteAsesoria,
        nifTercero: extraccion.nifProveedor ?? extraccion.nifComercio,
        numero: extraccion.numeroFacturaProveedor ?? extraccion.numero,
        fecha: extraccion.fecha,
      });
      if (posibleDuplicado) {
        avisos.push(
          `Posible duplicado: ya existe ese número de ${posibleDuplicado.tercero ?? "ese tercero"} de ${posibleDuplicado.ano}.`
        );
      }

      const doc = await DocumentoFiscal.create({
        clienteAsesoria,
        tipo: tipo ?? "recibida",
        fecha: extraccion.fecha ?? new Date(),
        numero: extraccion.numeroFacturaProveedor ?? extraccion.numero ?? undefined,
        tercero: extraccion.proveedor ?? extraccion.comercio ?? undefined,
        nifTercero: extraccion.nifProveedor ?? extraccion.nifComercio ?? undefined,
        base: cuadre.base,
        tipoIva: cuadre.tipoIva,
        cuotaIva: cuadre.cuotaIva,
        total: cuadre.total,
        archivo: ficheroUrl,
        nombreArchivo: nombreFichero,
        origen: "ocr",
        ocr: { confianza: extraccion.confianza, datosExtraidos: { ...extraccion, avisos } },
        estado: "pendiente",
      });

      res.status(201).json({ ...doc.toObject(), avisos });
    });
  } catch (err) {
    next(err);
  }
});

// Corrección/revisión del documento (marca revisado, contabilizado, devuelto).
router.put("/documentos/:id", async (req, res, next) => {
  try {
    const salida = {};
    for (const clave of [
      "tipo", "fecha", "numero", "tercero", "nifTercero",
      "base", "tipoIva", "cuotaIva", "total", "retencion", "estado", "notas", "clienteAsesoria",
    ]) {
      if (req.body[clave] !== undefined) salida[clave] = req.body[clave];
    }
    if (salida.base !== undefined || salida.total !== undefined || salida.tipoIva !== undefined) {
      const cuadre = cuadrarIva({ ...salida });
      salida.base = cuadre.base;
      salida.cuotaIva = cuadre.cuotaIva;
      salida.total = cuadre.total;
      salida.tipoIva = cuadre.tipoIva;
    }
    const doc = await DocumentoFiscal.findByIdAndUpdate(req.params.id, salida, {
      new: true,
      runValidators: true,
    });
    if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.delete("/documentos/:id", async (req, res, next) => {
  try {
    const doc = await DocumentoFiscal.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
    if (doc.archivo) {
      const remoto = doc.archivo.replace(/^\/uploads\//, "uploads/");
      await borrarArchivo(remoto).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- libros IVA

function agruparLibro(docs) {
  const libro = { base: 0, cuota: 0, total: 0, documentos: docs.length };
  for (const d of docs) {
    libro.base = redondear(libro.base + d.base);
    libro.cuota = redondear(libro.cuota + d.cuotaIva);
    libro.total = redondear(libro.total + d.total);
  }
  return libro;
}

async function librosIva(req) {
  const { cliente, ano } = req.query;
  if (!cliente || !ano) throw new Error("Indica el cliente y el año");
  const docs = await DocumentoFiscal.find({
    clienteAsesoria: cliente,
    ano: Number(ano),
    estado: { $in: ["revisado", "contabilizado"] },
    tipo: { $in: ["emitida", "recibida", "gasto"] },
  }).sort({ fecha: 1, numero: 1 }).lean();

  const trimestres = [1, 2, 3, 4].map((t) => {
    const delTrimestre = docs.filter((d) => d.trimestre === t);
    return {
      trimestre: t,
      emitidas: agruparLibro(delTrimestre.filter((d) => d.tipo === "emitida")),
      recibidas: agruparLibro(delTrimestre.filter((d) => d.tipo === "recibida")),
      gastos: agruparLibro(delTrimestre.filter((d) => d.tipo === "gasto")),
    };
  });
  return { trimestres, documentos: docs };
}

router.get("/libros-iva", async (req, res, next) => {
  try {
    const { trimestres } = await librosIva(req);
    res.json({ trimestres });
  } catch (err) {
    next(err);
  }
});

// Exportación a CSV (punto y coma, decimales con coma) lista para importar en
// el programa de contabilidad de la asesoría.
router.get("/libros-iva.csv", async (req, res, next) => {
  try {
    const { documentos } = await librosIva(req);
    const cliente = await ClienteAsesoria.findById(req.query.cliente).lean();
    const eur = (n) => redondear(n).toFixed(2).replace(".", ",");
    const fechaCorta = (f) => new Date(f).toLocaleDateString("es-ES");
    const filas = [["Libro", "Fecha", "Número", "Tercero", "NIF", "Base", "IVA %", "Cuota", "Total", "Trimestre"].join(";")];
    for (const d of documentos) {
      filas.push([
        d.tipo === "emitida" ? "Emitidas" : "Recibidas",
        fechaCorta(d.fecha),
        d.numero ?? "",
        (d.tercero ?? "").replace(/;/g, ","),
        d.nifTercero ?? "",
        eur(d.base),
        d.tipoIva,
        eur(d.cuotaIva),
        eur(d.total),
        `${d.trimestre}T`,
      ].join(";"));
    }
    const nombre = `libro-iva-${(cliente?.nif ?? "cliente")}-${req.query.ano}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
    res.send("﻿" + filas.join("\r\n"));
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------ cierres

// Matriz de cierres del año: cada cliente activo con el estado de sus 4
// trimestres y cuántos documentos le quedan por revisar en cada uno.
router.get("/cierres", async (req, res, next) => {
  try {
    const ano = Number(req.query.ano) || new Date().getFullYear();
    const [clientes, cierres, pendientes] = await Promise.all([
      ClienteAsesoria.find({ activo: true }).sort({ nombre: 1 }).lean(),
      CierreTrimestral.find({ ano }).lean(),
      DocumentoFiscal.aggregate([
        { $match: { ano, estado: "pendiente" } },
        { $group: { _id: { c: "$clienteAsesoria", t: "$trimestre" }, n: { $sum: 1 } } },
      ]),
    ]);
    const mapa = new Map(cierres.map((c) => [`${c.clienteAsesoria}:${c.trimestre}`, c]));
    const mapaPend = new Map(pendientes.map((p) => [`${p._id.c}:${p._id.t}`, p.n]));

    res.json({
      ano,
      clientes: clientes.map((cliente) => ({
        cliente: { _id: cliente._id, nombre: cliente.nombre, nif: cliente.nif },
        trimestres: [1, 2, 3, 4].map((t) => {
          const cierre = mapa.get(`${cliente._id}:${t}`);
          return {
            trimestre: t,
            estado: cierre?.estado ?? "pendiente_docs",
            notas: cierre?.notas,
            presentadoEn: cierre?.presentadoEn,
            pendientes: mapaPend.get(`${cliente._id}:${t}`) ?? 0,
          };
        }),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Cambia el estado de un cierre (se crea si no existía).
router.put("/cierres", async (req, res, next) => {
  try {
    const { clienteAsesoria, ano, trimestre, estado, notas } = req.body;
    if (!clienteAsesoria || !ano || !trimestre || !ESTADOS_CIERRE.includes(estado)) {
      return res.status(400).json({ error: "Cliente, año, trimestre y un estado válido son obligatorios" });
    }
    const cierre = await CierreTrimestral.findOneAndUpdate(
      { clienteAsesoria, ano: Number(ano), trimestre: Number(trimestre) },
      {
        estado,
        ...(notas !== undefined ? { notas } : {}),
        presentadoEn: estado === "presentado" ? new Date() : null,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(cierre);
  } catch (err) {
    next(err);
  }
});

// Kit de solicitudes de cierre: pide al cliente de una vez toda la
// documentación habitual del trimestre. No duplica lo ya pedido y pendiente.
const KIT_CIERRE = [
  "Extractos bancarios del trimestre",
  "Nóminas y seguros sociales",
  "Facturas emitidas que falten",
  "Facturas de compras y gastos que falten",
  "Tickets y justificantes de gasto",
];

router.post("/solicitudes/kit", async (req, res, next) => {
  try {
    const { clienteAsesoria, ano, trimestre } = req.body;
    if (!clienteAsesoria || !trimestre) {
      return res.status(400).json({ error: "Indica el cliente y el trimestre" });
    }
    const periodo = `${trimestre}T ${ano ?? new Date().getFullYear()}`;
    const yaPedidas = new Set(
      (
        await SolicitudDocumento.find({ clienteAsesoria, estado: "pendiente" })
          .select("descripcion")
          .lean()
      ).map((s) => s.descripcion)
    );
    let creadas = 0;
    for (const descripcion of KIT_CIERRE) {
      if (yaPedidas.has(descripcion)) continue;
      await SolicitudDocumento.create({ clienteAsesoria, descripcion, periodo });
      creadas++;
    }
    res.status(201).json({ creadas, periodo });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------- previsión

// Previsión fiscal del año por cliente: modelo 303 (IVA con compensación de
// cuotas negativas) y modelo 130 (pagos fraccionados de IRPF para autónomos
// en estimación directa, con acumulados y retenciones soportadas).
router.get("/prevision", async (req, res, next) => {
  try {
    const ano = Number(req.query.ano) || new Date().getFullYear();
    const filtroCliente = { activo: true };
    if (req.query.cliente) filtroCliente._id = req.query.cliente;
    const clientes = await ClienteAsesoria.find(filtroCliente).sort({ nombre: 1 }).lean();
    if (!clientes.length) return res.json({ ano, clientes: [] });

    const docs = await DocumentoFiscal.find({
      clienteAsesoria: { $in: clientes.map((c) => c._id) },
      ano,
      estado: { $in: ["revisado", "contabilizado"] },
      tipo: { $in: ["emitida", "recibida", "gasto"] },
    }).lean();

    const salida = [];
    for (const cliente of clientes) {
      const suyos = docs.filter((d) => String(d.clienteAsesoria) === String(cliente._id));
      const presenta130 = (cliente.modelos ?? []).includes("130");
      let compensar = 0;
      let irAcumulado = { ingresos: 0, gastos: 0, retenciones: 0, pagado: 0 };

      const trimestres = [1, 2, 3, 4].map((t) => {
        const delTrimestre = suyos.filter((d) => d.trimestre === t);
        const emitidas = delTrimestre.filter((d) => d.tipo === "emitida");
        const deducibles = delTrimestre.filter((d) => d.tipo !== "emitida");

        // --- Modelo 303
        const repercutido = redondear(emitidas.reduce((s, d) => s + d.cuotaIva, 0));
        const soportado = redondear(deducibles.reduce((s, d) => s + d.cuotaIva, 0));
        const resultado = redondear(repercutido - soportado);
        let cuota303 = 0;
        if (resultado >= 0) {
          cuota303 = redondear(Math.max(0, resultado - compensar));
          compensar = redondear(Math.max(0, compensar - resultado));
        } else {
          compensar = redondear(compensar - resultado);
        }

        // --- Modelo 130 (acumulado del año hasta este trimestre)
        let irpf = null;
        if (presenta130) {
          irAcumulado = {
            ingresos: redondear(irAcumulado.ingresos + emitidas.reduce((s, d) => s + d.base, 0)),
            gastos: redondear(irAcumulado.gastos + deducibles.reduce((s, d) => s + d.base, 0)),
            retenciones: redondear(
              irAcumulado.retenciones + emitidas.reduce((s, d) => s + (d.cuotaRetencion ?? 0), 0)
            ),
            pagado: irAcumulado.pagado,
          };
          const rendimiento = redondear(Math.max(0, irAcumulado.ingresos - irAcumulado.gastos));
          const pago = redondear(
            Math.max(0, rendimiento * 0.2 - irAcumulado.retenciones - irAcumulado.pagado)
          );
          irAcumulado.pagado = redondear(irAcumulado.pagado + pago);
          irpf = { ...irAcumulado, rendimiento, pagoTrimestre: pago };
        }

        return {
          trimestre: t,
          documentos: delTrimestre.length,
          iva: { repercutido, soportado, resultado, cuota: cuota303, aCompensar: compensar },
          irpf,
        };
      });

      salida.push({
        cliente: {
          _id: cliente._id,
          nombre: cliente.nombre,
          nif: cliente.nif,
          formaJuridica: cliente.formaJuridica,
        },
        presenta130,
        trimestres,
      });
    }
    res.json({ ano, clientes: salida });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------- solicitudes

router.get("/solicitudes", async (req, res, next) => {
  try {
    const { cliente, estado } = req.query;
    const filtro = {};
    if (cliente) filtro.clienteAsesoria = cliente;
    if (estado) filtro.estado = estado;
    const solicitudes = await SolicitudDocumento.find(filtro)
      .populate("clienteAsesoria", "nombre nif telefono email")
      .populate("documento", "tipo fecha numero tercero total estado")
      .sort({ estado: 1, createdAt: -1 })
      .limit(300)
      .lean();
    res.json(solicitudes);
  } catch (err) {
    next(err);
  }
});

router.post("/solicitudes", async (req, res, next) => {
  try {
    const { clienteAsesoria, descripcion, periodo, notas } = req.body;
    if (!clienteAsesoria || !descripcion) {
      return res.status(400).json({ error: "Indica el cliente y qué documento necesitas" });
    }
    const solicitud = await SolicitudDocumento.create({ clienteAsesoria, descripcion, periodo, notas });
    res.status(201).json(solicitud);
  } catch (err) {
    next(err);
  }
});

router.put("/solicitudes/:id", async (req, res, next) => {
  try {
    const salida = {};
    for (const clave of ["descripcion", "periodo", "estado", "notas"]) {
      if (req.body[clave] !== undefined) salida[clave] = req.body[clave];
    }
    // Si se reabre, se desvincula el documento.
    if (salida.estado === "pendiente") salida.documento = null;
    const solicitud = await SolicitudDocumento.findByIdAndUpdate(req.params.id, salida, {
      new: true,
      runValidators: true,
    });
    if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
    res.json(solicitud);
  } catch (err) {
    next(err);
  }
});

// Vincula un documento ya subido con la solicitud: queda recibida.
router.post("/solicitudes/:id/vincular", async (req, res, next) => {
  try {
    const doc = await DocumentoFiscal.findById(req.body.documentoId);
    if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
    const solicitud = await SolicitudDocumento.findByIdAndUpdate(
      req.params.id,
      { documento: doc._id, estado: "recibida" },
      { new: true }
    );
    if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
    res.json(solicitud);
  } catch (err) {
    next(err);
  }
});

router.delete("/solicitudes/:id", async (req, res, next) => {
  try {
    const borrada = await SolicitudDocumento.findByIdAndDelete(req.params.id);
    if (!borrada) return res.status(404).json({ error: "Solicitud no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- fiscalidad

router.get("/fiscalidad", async (req, res, next) => {
  try {
    const ano = Number(req.query.ano) || new Date().getFullYear();
    const clientes = await ClienteAsesoria.find({ activo: true }).sort({ nombre: 1 }).lean();
    const vencimientos = clientes
      .flatMap((c) => vencimientosDe(c, ano))
      .sort((a, b) => a.fecha - b.fecha);
    res.json({ ano, vencimientos, modelos: MODELOS_FISCALES });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------------- panel

router.get("/panel", async (req, res, next) => {
  try {
    const ahora = new Date();
    const ano = ahora.getFullYear();
    const trimestre = Math.floor(ahora.getMonth() / 3) + 1;

    const [clientesActivos, pendientes, docsTrimestre, solicitudesPendientes] = await Promise.all([
      ClienteAsesoria.countDocuments({ activo: true }),
      DocumentoFiscal.countDocuments({ estado: "pendiente" }),
      DocumentoFiscal.countDocuments({ ano, trimestre }),
      SolicitudDocumento.countDocuments({ estado: "pendiente" }),
    ]);

    // Próximos vencimientos (30 días) de todos los clientes activos.
    const clientes = await ClienteAsesoria.find({ activo: true }).lean();
    const limite = new Date(ahora.getTime() + 30 * 86400000);
    const proximos = clientes
      .flatMap((c) => vencimientosDe(c, ano))
      .filter((v) => v.fecha >= ahora && v.fecha <= limite)
      .sort((a, b) => a.fecha - b.fecha)
      .slice(0, 12);

    const ultimos = await DocumentoFiscal.find()
      .populate("clienteAsesoria", "nombre")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    // Resumen IVA del trimestre en curso de toda la cartera.
    const docsIva = await DocumentoFiscal.find({
      ano, trimestre,
      estado: { $in: ["revisado", "contabilizado"] },
      tipo: { $in: ["emitida", "recibida", "gasto"] },
    }).lean();
    const rep = redondear(docsIva.filter((d) => d.tipo === "emitida").reduce((s, d) => s + d.cuotaIva, 0));
    const sop = redondear(
      docsIva.filter((d) => d.tipo !== "emitida").reduce((s, d) => s + d.cuotaIva, 0)
    );

    // Alertas de trabajo: clientes activos sin documentos en 30 días (se les
    // va a echar de menos al cerrar el trimestre) y lecturas dudosas.
    const hace30 = new Date(ahora.getTime() - 30 * 86400000);
    const conMovimiento = new Set(
      (
        await DocumentoFiscal.find({ createdAt: { $gte: hace30 } })
          .select("clienteAsesoria")
          .lean()
      ).map((d) => String(d.clienteAsesoria))
    );
    const sinMovimiento = clientes.filter((c) => !conMovimiento.has(String(c._id)));
    const pocaConfianza = await DocumentoFiscal.countDocuments({
      estado: "pendiente",
      "ocr.confianza": { $lt: 0.7 },
    });

    res.json({
      clientesActivos,
      pendientesRevision: pendientes,
      documentosTrimestre: docsTrimestre,
      solicitudesPendientes,
      iva: { repercutido: rep, soportado: sop, resultado: redondear(rep - sop), trimestre, ano },
      proximosVencimientos: proximos,
      ultimosDocumentos: ultimos,
      alertas: {
        clientesSinMovimiento: sinMovimiento.map((c) => ({ _id: c._id, nombre: c.nombre })),
        pocaConfianza,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
