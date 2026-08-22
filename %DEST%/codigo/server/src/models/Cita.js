import { Schema, model } from "mongoose";

export const ESTADOS_CITA = ["pendiente", "confirmada", "realizada", "cancelada"];

const citaSchema = new Schema(
  {
    fecha: { type: Date, required: true }, // día de la cita (medianoche local)
    hora: { type: String, required: true }, // "09:30"
    duracion: { type: Number, default: 60 }, // minutos
    clienteNombre: String,
    telefono: String,
    vehiculo: { type: Schema.Types.ObjectId, ref: "Vehiculo" },
    matricula: { type: String, uppercase: true, trim: true },
    motivo: String,
    estado: { type: String, enum: ESTADOS_CITA, default: "pendiente" },
    notas: String,
  },
  { timestamps: true }
);

citaSchema.index({ fecha: 1, hora: 1 });

export default model("Cita", citaSchema);
