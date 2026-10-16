import { Router } from "express";
import Tramite from "../models/Tramite.js";
import Suministro from "../models/Suministro.js";
import Comercializadora from "../models/Comercializadora.js";

// Trámites de energía (altas, cambios de comercializadora, cambios de titular
// y bajas). Se monta dentro del router de energia, que ya aplica el guard
// requiereModulo("energia"). El trámite es el circuito: documentación →
// enviado → en trámite → activado (o rechazado/cancelado). Al activarse,
// aplica los cambios sobre el suministro.
const router = Router();

const TIPOS = ["alta", "cambio", "titular", "renovacion", "baja"];
const ESTADOS = ["documentacion", "enviado", "en_tramite", "activado", "rechazado", "cancelado"];

// Cambios de datos que acompañan a una renovación (propuesta ROLUSUR 16/10):
// solo se guardan los campos rellenados; el resto no se toca.
function limpiarCambios(body) {
  const c = body?.cambios;
  if (c === undefined) return undefined;
  if (c === null || typeof c !== "object") return {};
  const out = {};
  for (const t of ["telefono", "email", "calle", "cp", "ciudad", "provincia", "tarifa"]) {
    const v = String(c[t] ?? "").trim();
    if (v) out[t] = v;
  }
  if (c.consumoAnual !== undefined && c.consumoAnual !== null && c.consumoAnual !== "") {
    out.consumoAnual = Math.max(0, Number(c.consumoAnual) || 0);
  }
  if (c.fechaFin) out.fechaFin = new Date(c.fechaFin);
  return out;
}

async function denormalizar(datos) {
  const { default: Cliente } = await import("../models/Cliente.js");
  if (datos.cliente === null || datos.cliente === "") {
    datos.cliente = undefined;
    datos.clienteNombre = undefined;
  } else if (datos.cliente) {
    const c = await Cliente.findById(datos.cliente).lean();
    datos.clienteNombre = c?.nombre ?? undefined;
  }
  if (datos.nuevoTitular === null || datos.nuevoTitular === "") {
    datos.nuevoTitular = undefined;
    datos.nuevoTitularNombre = undefined;
  } else if (datos.nuevoTitular) {
    const c = await Cliente.findById(datos.nuevoTitular).lean();
    datos.nuevoTitularNombre = c?.nombre ?? undefined;
  }
  if (datos.comercializadoraDestino === null || datos.comercializadoraDestino === "") {
    datos.comercializadoraDestino = undefined;
    datos.comercializadoraDestinoNombre = undefined;
  } else if (datos.comercializadoraDestino) {
    const c = await Comercializadora.findById(datos.comercializadoraDestino).lean();
    datos.comercializadoraDestinoNombre = c?.nombre ?? undefined;
  }
  return datos;
}

function limpiarFechas(datos) {
  for (const campo of ["fechaSolicitud", "fechaEnvio", "fechaPrevista", "fechaActivacion"]) {
    if (datos[campo] === "") datos[campo] = undefined;
    if (datos[campo]) datos[campo] = new Date(datos[campo]);
  }
}

// Efecto del trámite sobre el suministro cuando se activa.
async function aplicarEnSuministro(tramite) {
  const s = await Suministro.findById(tramite.suministro);
  if (!s) return;
  if (tramite.tipo === "alta" || tramite.tipo === "cambio") {
    if (tramite.comercializadoraDestino) {
      const com = await Comercializadora.findById(tramite.comercializadoraDestino).lean();
      s.comercializadora = tramite.comercializadoraDestino;
      s.comercializadoraNombre = com?.nombre ?? s.comercializadoraNombre;
    }
    // Al activarse el trámite el suministro ya está con la nueva
    // comercializadora: pasa a "activo" y se refleja la fecha de alta.
    s.estado = "activo";
    s.fechaAlta = tramite.fechaActivacion ?? s.fechaAlta;
  } else if (tramite.tipo === "titular") {
    if (tramite.nuevoTitular) {
      const { default: Cliente } = await import("../models/Cliente.js");
      const cli = await Cliente.findById(tramite.nuevoTitular).lean();
      s.cliente = tramite.nuevoTitular;
      s.clienteNombre = cli?.nombre ?? s.clienteNombre;
    }
  } else if (tramite.tipo === "renovacion") {
    // Renovación con la misma compañía (propuesta ROLUSUR 16/10): la fecha
    // de alta pasa a ser la de la activación, con lo que el aviso de
    // renovación vuelve a saltar al año siguiente; y se aplican los datos
    // que hayan cambiado (teléfono, correo, dirección, tarifa…).
    s.fechaAlta = tramite.fechaActivacion ?? new Date();
    const c = tramite.cambios ?? {};
    if (c.fechaFin) s.fechaFin = c.fechaFin;
    if (c.tarifa) s.tarifa = c.tarifa;
    if (c.consumoAnual) s.consumoAnual = c.consumoAnual;
    if (c.calle || c.cp || c.ciudad || c.provincia) {
      s.direccion = {
        ...(s.direccion?.toObject?.() ?? s.direccion ?? {}),
        ...(c.calle ? { calle: c.calle } : {}),
        ...(c.cp ? { cp: c.cp } : {}),
        ...(c.ciudad ? { ciudad: c.ciudad } : {}),
        ...(c.provincia ? { provincia: c.provincia } : {}),
      };
    }
    if (tramite.comercializadoraDestino) {
      const com = await Comercializadora.findById(tramite.comercializadoraDestino).lean();
      s.comercializadora = tramite.comercializadoraDestino;
      s.comercializadoraNombre = com?.nombre ?? s.comercializadoraNombre;
    }
    // Teléfono/correo viven en la ficha del cliente titular.
    if (s.cliente && (c.telefono || c.email)) {
      const { default: Cliente } = await import("../models/Cliente.js");
      const set = {};
      if (c.telefono) set.telefono = c.telefono;
      if (c.email) set.email = c.email;
      await Cliente.findByIdAndUpdate(s.cliente, { $set: set });
    }
  } else if (tramite.tipo === "baja") {
    s.estado = "baja";
  }
  await s.save();
}

// Mientras un trámite de alta/cambio está en marcha, el suministro se ve
// como "en trámite"; si el trámite se tira atrás, vuelve a estar activo
// con la comercializadora que ya tenía (propuesta ROLUSUR 15/10).
async function marcarEnTramite(tramite) {
  const s = await Suministro.findById(tramite.suministro);
  if (!s) return;
  if (s.estado === "en_tramite") return;
  s.estado = "en_tramite";
  await s.save();
}

async function desmarcarEnTramite(tramite) {
  const s = await Suministro.findById(tramite.suministro);
  if (!s) return;
  if (s.estado !== "en_tramite") return;
  s.estado = "activo";
  await s.save();
}

router.get("/", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.estado) filtro.estado = req.query.estado;
    if (req.query.tipo) filtro.tipo = req.query.tipo;
    if (req.query.suministro) filtro.suministro = req.query.suministro;
    if (req.query.cliente) filtro.cliente = req.query.cliente;
    const lista = await Tramite.find(filtro)
      .sort({ createdAt: -1 })
      .populate("suministro", "cups tipo estado")
      .populate("cliente", "nombre grupo")
      .populate("comercializadoraDestino", "nombre")
      .populate("nuevoTitular", "nombre")
      .limit(500);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { tipo, suministro: suministroId } = req.body;
    if (!TIPOS.includes(tipo)) {
      return res.status(400).json({ error: "El tipo debe ser alta, cambio, titular, renovación o baja" });
    }
    const suministro = await Suministro.findById(suministroId).lean();
    if (!suministro) return res.status(400).json({ error: "Selecciona un suministro (CUPS)" });

    const datos = {
      tipo,
      suministro: suministroId,
      cups: suministro.cups,
      cliente: suministro.cliente,
      comercializadoraOrigen: suministro.comercializadoraNombre ?? null,
      comercializadoraDestino: req.body.comercializadoraDestino ?? null,
      nuevoTitular: req.body.nuevoTitular ?? null,
      fechaPrevista: req.body.fechaPrevista ?? null,
      notas: req.body.notas ?? "",
    };
    const cambios = limpiarCambios(req.body);
    if (cambios !== undefined) datos.cambios = cambios;
    if (["alta", "cambio"].includes(tipo) && !datos.comercializadoraDestino) {
      return res.status(400).json({ error: "Selecciona la comercializadora de destino" });
    }
    if (tipo === "titular" && !datos.nuevoTitular) {
      return res.status(400).json({ error: "Selecciona el nuevo titular" });
    }
    await denormalizar(datos);
    limpiarFechas(datos);
    datos.historia = [{ estado: "documentacion", nota: "Trámite abierto" }];
    const tramite = await Tramite.create(datos);
    // El suministro entra en trámite desde el momento en que se abre el
    // expediente de alta/cambio (se puede cambiar a mano en su ficha).
    if (["alta", "cambio"].includes(tipo)) await marcarEnTramite(tramite);
    res.status(201).json(tramite);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const tramite = await Tramite.findById(req.params.id);
    if (!tramite) return res.status(404).json({ error: "Trámite no encontrado" });
    if (tramite.estado === "activado") {
      return res.status(400).json({ error: "Un trámite activado ya surtió efecto y no se puede editar" });
    }
    const datos = {};
    for (const c of ["comercializadoraDestino", "nuevoTitular", "fechaPrevista", "notas"]) {
      if (req.body[c] !== undefined) datos[c] = req.body[c];
    }
    const cambios = limpiarCambios(req.body);
    if (cambios !== undefined) datos.cambios = cambios;
    await denormalizar(datos);
    limpiarFechas(datos);
    Object.assign(tramite, datos);
    await tramite.save();
    res.json(tramite);
  } catch (err) {
    next(err);
  }
});

// Cambio de estado del circuito. Al activar, aplica el efecto sobre el
// suministro (cambia la comercializadora, el titular o lo da de baja).
router.post("/:id/estado", async (req, res, next) => {
  try {
    const { estado, nota, fecha } = req.body;
    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({ error: "Estado no válido" });
    }
    const tramite = await Tramite.findById(req.params.id);
    if (!tramite) return res.status(404).json({ error: "Trámite no encontrado" });
    if (tramite.estado === "activado") {
      return res.status(400).json({ error: "El trámite ya está activado" });
    }
    if (["rechazado", "cancelado"].includes(tramite.estado) && estado !== tramite.estado) {
      return res.status(400).json({ error: `El trámite está ${tramite.estado} y no puede reabrirse` });
    }
    tramite.estado = estado;
    if (estado === "enviado") {
      tramite.fechaEnvio = fecha ? new Date(fecha) : new Date();
      // Enviado a la comercializadora: el suministro sigue en trámite (por
      // si se abrió sin pasar por el alta/cambio automática).
      if (["alta", "cambio"].includes(tramite.tipo)) await marcarEnTramite(tramite);
    }
    if (estado === "activado") {
      tramite.fechaActivacion = fecha ? new Date(fecha) : new Date();
      await aplicarEnSuministro(tramite);
    }
    if (["rechazado", "cancelado"].includes(estado) && ["alta", "cambio"].includes(tramite.tipo)) {
      // El cambio no salió adelante: el suministro vuelve a estar activo
      // con la comercializadora que ya tenía.
      await desmarcarEnTramite(tramite);
    }
    tramite.historia.push({ estado, nota: nota || undefined });
    await tramite.save();
    res.json(tramite);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const tramite = await Tramite.findById(req.params.id);
    if (!tramite) return res.status(404).json({ error: "Trámite no encontrado" });
    if (tramite.estado === "activado") {
      return res.status(400).json({
        error: "Este trámite ya está activado y cambió el suministro: no se puede borrar (cancela un trámite en curso si lo abriste por error)",
      });
    }
    await tramite.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
