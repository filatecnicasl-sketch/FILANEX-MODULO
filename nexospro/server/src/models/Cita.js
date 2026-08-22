import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

export const ESTADOS_CITA = ["pendiente", "confirmada", "realizada", "cancelada"];

const citaSchema = new Schema(
  {
    // "taller": citas del módulo de taller · "general": agenda de FILANEX
    // facturación · "servicio": citas del Servicio Técnico (SAT)
    ambito: { type: String, enum: ["taller", "general", "servicio"], default: "taller", index: true },
    fecha: { type: Date, required: true }, // día de la cita (medianoche local)
    hora: { type: String, required: true }, // "09:30"
    duracion: { type: Number, default: 60 }, // minutos
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" }, // agenda general
    clienteNombre: String,
    telefono: String,
    vehiculo: { type: Schema.Types.ObjectId, ref: "Vehiculo" },
    matricula: { type: String, uppercase: true, trim: true },
    // SAT: aparato y dirección de la intervención (visitas a domicilio).
    aparato: { type: Schema.Types.ObjectId, ref: "Aparato" },
    aparatoDescripcion: String,
    direccion: String,
    motivo: String,
    // Las citas del taller suelen venir de un presupuesto aceptado.
    presupuesto: { type: Boolean, default: false },
    estado: { type: String, enum: ESTADOS_CITA, default: "pendiente" },
    notas: String,
  },
  { timestamps: true }
);

citaSchema.index({ fecha: 1, hora: 1 });

export default modeloTenant("Cita", citaSchema);
