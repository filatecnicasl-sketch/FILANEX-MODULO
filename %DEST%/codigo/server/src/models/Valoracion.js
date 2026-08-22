import { Schema, model } from "mongoose";

export const ESTADOS_VALORACION = ["pendiente", "valorado", "aprobado", "rechazado"];

// Valoración / peritaje de daños (normalmente para compañía de seguros).
// Una valoración aprobada puede convertirse en orden de trabajo.
const lineaValoracionSchema = new Schema(
  {
    descripcion: { type: String, required: true },
    importe: { type: Number, default: 0 },
  },
  { _id: false }
);

const valoracionSchema = new Schema(
  {
    numero: { type: String, required: true, unique: true }, // PER-000001
    vehiculo: { type: Schema.Types.ObjectId, ref: "Vehiculo" },
    matricula: { type: String, required: true, uppercase: true, trim: true },
    clienteNombre: String,
    telefono: String,
    compania: String, // compañía de seguros
    numeroSiniestro: String,
    fechaSiniestro: Date,
    lineas: { type: [lineaValoracionSchema], default: [] },
    total: { type: Number, default: 0 }, // suma de líneas (valoración)
    estado: { type: String, enum: ESTADOS_VALORACION, default: "pendiente" },
    observaciones: String,
    orden: { type: Schema.Types.ObjectId, ref: "OrdenTrabajo" }, // OT generada
    numeroOrden: String,
  },
  { timestamps: true }
);

export default model("Valoracion", valoracionSchema);
