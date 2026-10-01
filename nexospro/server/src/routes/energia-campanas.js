import { Router } from "express";
import CampanaPrecios from "../models/CampanaPrecios.js";
import Comercializadora from "../models/Comercializadora.js";
import Empresa from "../models/Empresa.js";
import { extraerCampanaPrecios } from "../services/ocr-gemini.js";
import {
  configuracionEntrantePublica,
  normalizarConfiguracionEntrante,
  probarCorreoEntrante,
  revisarCorreoCampanas,
} from "../services/energia-correo.js";
import { requiereRol } from "../middleware/auth.js";
import { cifrar } from "../services/cifrado.js";
import { uploadMemoria } from "../middleware/upload.js";
import { contextoTrasSubida } from "../middleware/empresa.js";

// Campañas de precios de las comercializadoras (Energía). Se monta dentro
// del router de energia, que ya aplica el guard requiereModulo("energia").
//
// Flujo: el PDF de la campaña se lee con IA (POST /ocr, no guarda nada),
// el usuario revisa el formulario y guarda; la campaña queda "pendiente"
// hasta que alguien la publica. Solo las publicadas se ofrecen en los
// estudios de ahorro.
const router = Router();

const NUMERICOS = [
  "precioEnergia", "precioEnergiaPunta", "precioEnergiaLlano", "precioEnergiaValle",
  "precioPotenciaPunta", "precioPotenciaValle", "mantenimiento",
];

function limpiar(body) {
  const datos = {};
  const texto = ["tipo", "nombre", "tarifa", "descuento", "notas"];
  for (const c of texto) if (body[c] !== undefined) datos[c] = String(body[c]).trim() || undefined;
  for (const n of NUMERICOS) {
    if (body[n] !== undefined) datos[n] = Math.max(0, Number(body[n]) || 0);
  }
  for (const f of ["vigenciaDesde", "vigenciaHasta"]) {
    if (body[f]) {
      const d = new Date(body[f]);
      if (!Number.isNaN(d.getTime())) datos[f] = d;
    } else if (body[f] !== undefined) {
      datos[f] = undefined;
    }
  }
  return datos;
}

async function denormalizar(datos) {
  if (datos.comercializadora) {
    const com = await Comercializadora.findById(datos.comercializadora).lean();
    if (!com) throw Object.assign(new Error("La comercializadora indicada no existe"), { status: 400 });
    datos.comercializadoraNombre = com.nombre;
  }
  return datos;
}

// Orden natural para el listado: pendientes primero (tocan revisarlas),
// luego publicadas y al final las descartadas; dentro de cada grupo, las
// más recientes primero.
const ORDEN = { pendiente: 0, publicada: 1, descartada: 2 };
const porEstadoYFecha = (a, b) =>
  ORDEN[a.estado] - ORDEN[b.estado] || new Date(b.createdAt) - new Date(a.createdAt);

router.get("/", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.estado) filtro.estado = req.query.estado;
    if (req.query.tipo) filtro.tipo = req.query.tipo;
    const lista = await CampanaPrecios.find(filtro)
      .populate("comercializadora", "nombre")
      .limit(500)
      .lean();
    lista.sort(porEstadoYFecha);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

// OCR: lee el PDF o la foto de la campaña con IA y devuelve los términos
// precargados. NADA se guarda: el usuario revisa el formulario, guarda y
// luego publica. Los precios de potencia en €/kW·día se convierten aquí a
// €/kW·año (lo que usan los estudios).
const subida = uploadMemoria;

router.post("/ocr", subida.single("documento"), contextoTrasSubida, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Falta el fichero (campo 'documento') o el tipo no es PDF/PNG/JPG/WEBP" });
    }
    const extraccion = await extraerCampanaPrecios(req.file);

    const avisos = [...(extraccion._ocr?.avisos ?? [])];
    const confianza = extraccion.confianza ?? 0;
    if (confianza < 0.75) avisos.push(`Confianza OCR baja (${Math.round(confianza * 100)}%)`);

    // Comercializadora: si ya está dada de alta con ese nombre, se enlaza.
    const nombreCom = String(extraccion.comercializadora ?? "").trim();
    let comercializadora = null;
    if (nombreCom) {
      comercializadora = await Comercializadora.findOne({
        nombre: new RegExp(`^${nombreCom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      }).lean();
      if (!comercializadora) {
        avisos.push(`La comercializadora «${nombreCom}» no está dada de alta: créala o elige otra antes de guardar`);
      }
    } else {
      avisos.push("No he podido leer la comercializadora: elígela a mano");
    }

    // Energía: precio único o promedio de los tramos leídos.
    const tramos = [extraccion.energiaPunta, extraccion.energiaLlano, extraccion.energiaValle]
      .map((v) => Number(v) || 0)
      .filter((v) => v > 0);
    const precioEnergia = Number(extraccion.energiaUnica) > 0
      ? Number(extraccion.energiaUnica)
      : tramos.length > 0
        ? Math.round((tramos.reduce((a, b) => a + b, 0) / tramos.length) * 10000) / 10000
        : 0;
    if (!precioEnergia) avisos.push("No he leído el precio de energía: apúntalo a mano");
    else if (tramos.length > 1) {
      avisos.push("El precio de energía es la media simple de los tramos: ajústalo si quieres ponderarla");
    }

    // Potencia: los estudios trabajan en €/kW·año; si viene en €/kW·día
    // (lo habitual en las campañas), se convierte.
    const unidad = String(extraccion.potenciaUnidad ?? "").toLowerCase();
    const factor = unidad === "ano" ? 1 : 365;
    const convertirPotencia = (v) => {
      const n = Number(v) || 0;
      return n > 0 ? Math.round(n * factor * 100) / 100 : 0;
    };
    const precioPotenciaPunta = convertirPotencia(extraccion.potenciaPunta);
    const precioPotenciaValle = convertirPotencia(extraccion.potenciaValle);
    const potenciaDetalle = {
      unidadLeida: unidad === "ano" ? "€/kW·año" : "€/kW·día",
      potenciaPuntaLeida: Number(extraccion.potenciaPunta) || 0,
      potenciaValleLeida: Number(extraccion.potenciaValle) || 0,
    };

    res.json({
      prefill: {
        comercializadora: comercializadora?._id ?? null,
        comercializadoraNombre: comercializadora?.nombre ?? nombreCom ?? null,
        tipo: extraccion.tipo ?? "luz",
        nombre: extraccion.nombreCampana ?? null,
        tarifa: extraccion.tarifa ?? null,
        vigenciaDesde: extraccion.vigenciaDesde ?? null,
        vigenciaHasta: extraccion.vigenciaHasta ?? null,
        precioEnergia: precioEnergia || null,
        precioEnergiaPunta: Number(extraccion.energiaPunta) || null,
        precioEnergiaLlano: Number(extraccion.energiaLlano) || null,
        precioEnergiaValle: Number(extraccion.energiaValle) || null,
        precioPotenciaPunta: precioPotenciaPunta || null,
        precioPotenciaValle: precioPotenciaValle || null,
        mantenimiento: Number(extraccion.mantenimientoMensual) || null,
        descuento: extraccion.descuento ?? null,
      },
      detalle: potenciaDetalle,
      confianza,
      avisos,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const datos = limpiar(req.body);
    if (req.body.comercializadora) datos.comercializadora = req.body.comercializadora;
    if (!datos.comercializadora) {
      return res.status(400).json({ error: "Elige la comercializadora de la campaña" });
    }
    await denormalizar(datos);
    datos.origen = req.body.origen === "ocr" ? "ocr" : "manual";
    datos.estado = ["pendiente", "publicada", "descartada"].includes(req.body.estado)
      ? req.body.estado
      : "pendiente";
    const campana = await CampanaPrecios.create(datos);
    res.status(201).json(campana);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const campana = await CampanaPrecios.findById(req.params.id);
    if (!campana) return res.status(404).json({ error: "Campaña no encontrada" });
    const datos = limpiar(req.body);
    if (req.body.comercializadora !== undefined) {
      datos.comercializadora = req.body.comercializadora || undefined;
      if (!datos.comercializadora) return res.status(400).json({ error: "Elige la comercializadora de la campaña" });
    }
    await denormalizar(datos);
    Object.assign(campana, datos);
    await campana.save();
    res.json(campana);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// Publicar, descartar o volver a dejar pendiente.
router.post("/:id/estado", async (req, res, next) => {
  try {
    const { estado } = req.body;
    if (!["pendiente", "publicada", "descartada"].includes(estado)) {
      return res.status(400).json({ error: "Estado no válido" });
    }
    const campana = await CampanaPrecios.findByIdAndUpdate(
      req.params.id,
      { estado },
      { new: true }
    );
    if (!campana) return res.status(404).json({ error: "Campaña no encontrada" });
    res.json(campana);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const campana = await CampanaPrecios.findByIdAndDelete(req.params.id);
    if (!campana) return res.status(404).json({ error: "Campaña no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Recogida automática por correo (Fase 2) ---
// Configuración del buzón (IMAP/Gmail), prueba de conexión y pasada a
// mano. La contraseña nunca sale del servidor (solo "passwordGuardada").

router.get("/correo/config", async (req, res, next) => {
  try {
    const empresa = await Empresa.findOne().lean();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });
    res.json(configuracionEntrantePublica(empresa));
  } catch (err) {
    next(err);
  }
});

router.put("/correo/config", requiereRol("admin"), async (req, res, next) => {
  try {
    const empresa = await Empresa.findOne();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });
    let config;
    try {
      config = normalizarConfiguracionEntrante(req.body, empresa);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const password = String(req.body.password ?? "");
    if (password) config.passwordCifrada = cifrar(password);
    if (!config.passwordCifrada) {
      config.activo = false;
      config.ultimoError = "Falta la contraseña del buzón";
    }
    empresa.correoEntrante = config;
    await empresa.save();
    res.json(configuracionEntrantePublica(empresa.toObject()));
  } catch (err) {
    next(err);
  }
});

router.post("/correo/probar", requiereRol("admin"), async (req, res, next) => {
  try {
    res.json(await probarCorreoEntrante());
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// Pasada a mano: conecta, procesa los correos sin leer de la carpeta y
// devuelve el resumen (cuántas campañas nuevas, qué se ignoró...).
router.post("/correo/revisar", async (req, res, next) => {
  try {
    res.json(await revisarCorreoCampanas());
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

export default router;
