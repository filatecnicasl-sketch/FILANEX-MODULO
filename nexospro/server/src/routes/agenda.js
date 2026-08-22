import { Router } from "express";
import Cita, { ESTADOS_CITA } from "../models/Cita.js";
import Cliente from "../models/Cliente.js";

// Agenda general de FILANEX facturación: citas y recordatorios para empresas
// que no tienen ningún módulo sectorial. Comparte el modelo Cita con
// ambito = "general" (las del taller usan ambito = "taller").
const router = Router();

function diaLocal(texto) {
  const d = texto ? new Date(`${texto}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function finDia(dia) {
  const fin = new Date(dia);
  fin.setHours(23, 59, 59, 999);
  return fin;
}

router.get("/eventos", async (req, res, next) => {
  try {
    const filtro = { ambito: "general" };
    const desde = req.query.desde ? diaLocal(req.query.desde) : null;
    const hasta = req.query.hasta ? diaLocal(req.query.hasta) : null;
    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = desde;
      if (hasta) filtro.fecha.$lte = finDia(hasta);
    }
    const lista = await Cita.find(filtro).sort({ fecha: 1, hora: 1 }).limit(500);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/eventos", async (req, res, next) => {
  try {
    const { fecha, hora } = req.body;
    if (!fecha || !hora) return res.status(400).json({ error: "Fecha y hora son obligatorias" });
    const dia = diaLocal(fecha);
    if (!dia) return res.status(400).json({ error: "Fecha no válida" });

    let clienteId;
    if (req.body.clienteId) {
      const c = await Cliente.findById(req.body.clienteId).lean();
      if (c) clienteId = c._id;
    }

    const evento = await Cita.create({
      ambito: "general",
      fecha: dia,
      hora,
      duracion: req.body.duracion || 60,
      cliente: clienteId,
      clienteNombre: req.body.clienteNombre || undefined,
      telefono: req.body.telefono || undefined,
      motivo: req.body.motivo || undefined,
      notas: req.body.notas || undefined,
    });
    res.status(201).json(evento);
  } catch (err) {
    next(err);
  }
});

router.put("/eventos/:id", async (req, res, next) => {
  try {
    const { fecha, hora, duracion, clienteId, clienteNombre, telefono, motivo, estado, notas } = req.body;
    if (estado !== undefined && !ESTADOS_CITA.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_CITA.join(", ")}` });
    }
    const cambios = { hora, duracion, clienteNombre, telefono, motivo, estado, notas };
    if (fecha) {
      const dia = diaLocal(fecha);
      if (!dia) return res.status(400).json({ error: "Fecha no válida" });
      cambios.fecha = dia;
    }
    if (clienteId !== undefined) {
      if (!clienteId) {
        cambios.cliente = null;
      } else {
        const c = await Cliente.findById(clienteId).lean();
        cambios.cliente = c?._id ?? null;
      }
    }
    const evento = await Cita.findOneAndUpdate({ _id: req.params.id, ambito: "general" }, cambios, {
      new: true,
      omitUndefined: true,
    });
    if (!evento) return res.status(404).json({ error: "Evento no encontrado" });
    res.json(evento);
  } catch (err) {
    next(err);
  }
});

router.delete("/eventos/:id", async (req, res, next) => {
  try {
    const evento = await Cita.findOneAndDelete({ _id: req.params.id, ambito: "general" });
    if (!evento) return res.status(404).json({ error: "Evento no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
