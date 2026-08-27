import { Router } from "express";
import Cita from "../models/Cita.js";
import AgendaEvento, { ESTADOS_EVENTO, TIPOS_EVENTO } from "../models/AgendaEvento.js";
import Cliente from "../models/Cliente.js";
import Empresa from "../models/Empresa.js";
import { interpretarEvento } from "../services/interpretar-evento.js";

// Agenda profesional independiente de las citas de Taller y Servicio Técnico.
const router = Router();

// POST /api/agenda/interpretar — convierte un texto dictado por voz en los
// campos de una cita/evento (fecha, hora, cliente, matrícula, motivo…).
router.post("/interpretar", async (req, res, next) => {
  try {
    const texto = String(req.body?.texto ?? "").trim();
    if (!texto) return res.status(400).json({ error: "No se recibió ningún texto" });
    const hoy = new Date().toLocaleDateString("sv-SE");
    const campos = await interpretarEvento(texto, hoy);
    res.json(campos);
  } catch (err) {
    next(err);
  }
});

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

function aMinutos(hora) {
  const [h, m] = String(hora ?? "").split(":").map(Number);
  return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : NaN;
}

function aHora(minutos) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

function claveHorario(fecha, hora, estado) {
  const dia = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
  return estado === "cancelada" ? undefined : `${dia}|${hora}`;
}

async function migrarEventosAnteriores() {
  const empresa = await Empresa.findOne().select("agendaSeparadaMigrada");
  if (empresa?.agendaSeparadaMigrada) return;
  const anteriores = await Cita.find({ ambito: "general" }).lean();
  if (anteriores.length > 0) {
    await AgendaEvento.bulkWrite(
      anteriores.map((evento) => {
        const horaFin = aHora(aMinutos(evento.hora) + (evento.duracion || 60));
        return {
          updateOne: {
            filter: { legacyCita: evento._id },
            update: {
              $setOnInsert: {
                fecha: evento.fecha,
                hora: evento.hora,
                horaFin,
                tipo: "reunion",
                titulo: evento.motivo || "Evento",
                cliente: evento.cliente,
                clienteNombre: evento.clienteNombre,
                telefono: evento.telefono,
                estado: evento.estado,
                notas: evento.notas,
                avisar: true,
                minutosAviso: 15,
                legacyCita: evento._id,
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false }
    );
  }
  if (empresa) {
    empresa.agendaSeparadaMigrada = true;
    await empresa.save();
  }
}

async function comprobarDisponibilidad({ fecha, hora, horaFin, excluirId }) {
  const inicio = aMinutos(hora);
  const fin = aMinutos(horaFin);
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) {
    return "La hora de fin debe ser posterior a la de inicio";
  }
  const ocupados = await AgendaEvento.find({
    fecha: { $gte: fecha, $lte: finDia(fecha) },
    estado: { $ne: "cancelada" },
    ...(excluirId ? { _id: { $ne: excluirId } } : {}),
  })
    .select("hora horaFin titulo")
    .lean();
  const conflicto = ocupados.find(
    (evento) => inicio < aMinutos(evento.horaFin) && fin > aMinutos(evento.hora)
  );
  return conflicto
    ? `Ese horario ya está ocupado de ${conflicto.hora} a ${conflicto.horaFin}: ${conflicto.titulo}`
    : null;
}

router.get("/eventos", async (req, res, next) => {
  try {
    await migrarEventosAnteriores();
    const filtro = {};
    const desde = req.query.desde ? diaLocal(req.query.desde) : null;
    const hasta = req.query.hasta ? diaLocal(req.query.hasta) : null;
    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = desde;
      if (hasta) filtro.fecha.$lte = finDia(hasta);
    }
    const lista = await AgendaEvento.find(filtro).sort({ fecha: 1, hora: 1 }).limit(500);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

// GET /api/agenda/proximas?dia=YYYY-MM-DD — eventos próximos de la agenda de facturación.
router.get("/proximas", async (req, res, next) => {
  try {
    await migrarEventosAnteriores();
    const dia = diaLocal(req.query.dia);
    if (!dia) return res.status(400).json({ error: "Parámetro dia (YYYY-MM-DD) obligatorio" });
    const lista = await AgendaEvento.find({
      fecha: { $gte: dia, $lte: finDia(dia) },
      estado: { $in: ["pendiente", "confirmada"] },
      avisar: true,
    })
      .sort({ hora: 1 })
      .limit(200)
      .lean();
    res.json(
      lista.map((c) => ({
        _id: c._id,
        hora: c.hora,
        horaFin: c.horaFin,
        titulo: c.titulo,
        clienteNombre: c.clienteNombre ?? "",
        telefono: c.telefono ?? "",
        estado: c.estado,
        minutosAviso: c.minutosAviso,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post("/eventos", async (req, res, next) => {
  try {
    const { fecha, hora, horaFin, titulo } = req.body;
    if (!fecha || !hora || !horaFin || !String(titulo ?? "").trim()) {
      return res.status(400).json({ error: "Fecha, horario y asunto son obligatorios" });
    }
    const dia = diaLocal(fecha);
    if (!dia) return res.status(400).json({ error: "Fecha no válida" });
    const conflicto = await comprobarDisponibilidad({ fecha: dia, hora, horaFin });
    if (conflicto) return res.status(409).json({ error: conflicto });

    let clienteId;
    if (req.body.clienteId) {
      const c = await Cliente.findById(req.body.clienteId).lean();
      if (c) clienteId = c._id;
    }

    const estado = ESTADOS_EVENTO.includes(req.body.estado) ? req.body.estado : "pendiente";
    const minutosAviso = Math.max(1, Math.min(240, Number(req.body.minutosAviso) || 15));
    const evento = await AgendaEvento.create({
      fecha: dia,
      hora,
      horaFin,
      tipo: TIPOS_EVENTO.includes(req.body.tipo) ? req.body.tipo : "reunion",
      titulo: String(titulo).trim(),
      cliente: clienteId,
      clienteNombre: req.body.clienteNombre || undefined,
      telefono: req.body.telefono || undefined,
      lugar: req.body.lugar || undefined,
      estado,
      notas: req.body.notas || undefined,
      avisar: req.body.avisar !== false,
      minutosAviso,
      claveHorario: claveHorario(dia, hora, estado),
    });
    res.status(201).json(evento);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Ese horario ya está ocupado por otro evento" });
    }
    next(err);
  }
});

router.put("/eventos/:id", async (req, res, next) => {
  try {
    const actual = await AgendaEvento.findById(req.params.id);
    if (!actual) return res.status(404).json({ error: "Evento no encontrado" });
    const { fecha, hora, horaFin, tipo, titulo, clienteId, clienteNombre, telefono, lugar, estado, notas, avisar, minutosAviso } = req.body;
    if (estado !== undefined && !ESTADOS_EVENTO.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido. Válidos: ${ESTADOS_EVENTO.join(", ")}` });
    }
    if (tipo !== undefined && !TIPOS_EVENTO.includes(tipo)) {
      return res.status(400).json({ error: "Tipo de evento no válido" });
    }
    if (titulo !== undefined && !String(titulo).trim()) {
      return res.status(400).json({ error: "El asunto del evento es obligatorio" });
    }
    const dia = fecha ? diaLocal(fecha) : actual.fecha;
    if (!dia) return res.status(400).json({ error: "Fecha no válida" });
    const horaNueva = hora ?? actual.hora;
    const horaFinNueva = horaFin ?? actual.horaFin;
    const estadoNuevo = estado ?? actual.estado;
    const conflicto = estadoNuevo === "cancelada"
      ? null
      : await comprobarDisponibilidad({
          fecha: dia,
          hora: horaNueva,
          horaFin: horaFinNueva,
          excluirId: actual._id,
        });
    if (conflicto) return res.status(409).json({ error: conflicto });

    const cambios = {
      fecha: dia,
      hora: horaNueva,
      horaFin: horaFinNueva,
      tipo,
      titulo: titulo !== undefined ? String(titulo).trim() : undefined,
      clienteNombre,
      telefono,
      lugar,
      estado,
      notas,
      avisar,
      minutosAviso: minutosAviso !== undefined
        ? Math.max(1, Math.min(240, Number(minutosAviso) || 15))
        : undefined,
      claveHorario: estadoNuevo === "cancelada"
        ? `cancelada|${actual._id}`
        : claveHorario(dia, horaNueva, estadoNuevo),
    };
    if (clienteId !== undefined) {
      if (!clienteId) {
        cambios.cliente = null;
      } else {
        const c = await Cliente.findById(clienteId).lean();
        cambios.cliente = c?._id ?? null;
      }
    }
    const evento = await AgendaEvento.findByIdAndUpdate(req.params.id, cambios, {
      new: true,
      omitUndefined: true,
    });
    if (!evento) return res.status(404).json({ error: "Evento no encontrado" });
    res.json(evento);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Ese horario ya está ocupado por otro evento" });
    }
    next(err);
  }
});

router.delete("/eventos/:id", async (req, res, next) => {
  try {
    const evento = await AgendaEvento.findByIdAndDelete(req.params.id);
    if (!evento) return res.status(404).json({ error: "Evento no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
