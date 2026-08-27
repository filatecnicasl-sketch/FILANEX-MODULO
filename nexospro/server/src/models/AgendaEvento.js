import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

export const ESTADOS_EVENTO = ["pendiente", "confirmada", "realizada", "cancelada"];
export const TIPOS_EVENTO = ["reunion", "llamada", "tarea", "recordatorio", "otro"];

const agendaEventoSchema = new Schema(
  {
    fecha: { type: Date, required: true, index: true },
    hora: { type: String, required: true },
    horaFin: { type: String, required: true },
    tipo: { type: String, enum: TIPOS_EVENTO, default: "reunion" },
    titulo: { type: String, required: true, trim: true },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    clienteNombre: String,
    telefono: String,
    lugar: String,
    estado: { type: String, enum: ESTADOS_EVENTO, default: "pendiente" },
    notas: String,
    avisar: { type: Boolean, default: true },
    minutosAviso: { type: Number, min: 1, max: 240, default: 15 },
    claveHorario: { type: String, unique: true, sparse: true },
    legacyCita: { type: Schema.Types.ObjectId, unique: true, sparse: true },
  },
  { timestamps: true }
);

agendaEventoSchema.index({ fecha: 1, hora: 1 });

export default modeloTenant("AgendaEvento", agendaEventoSchema);