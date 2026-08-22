import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Préstamo de un vehículo de cortesía a un cliente (normalmente mientras su
// coche está en el taller). "Vencido" es derivado: activo con fechaPrevista pasada.
const prestamoCortesiaSchema = new Schema(
  {
    vehiculo: { type: Schema.Types.ObjectId, ref: "Vehiculo", required: true },
    matricula: { type: String, required: true, uppercase: true, trim: true },
    clienteNombre: { type: String, required: true },
    telefono: String,
    orden: { type: Schema.Types.ObjectId, ref: "OrdenTrabajo" },
    numeroOrden: String,
    fechaSalida: { type: Date, default: Date.now },
    fechaPrevista: { type: Date, required: true }, // devolución acordada
    fechaDevolucion: Date, // real
    kmSalida: Number,
    kmEntrada: Number,
    estado: { type: String, enum: ["activo", "devuelto"], default: "activo" },
    notas: String,
  },
  { timestamps: true }
);

prestamoCortesiaSchema.index({ estado: 1, fechaPrevista: 1 });

export default modeloTenant("PrestamoCortesia", prestamoCortesiaSchema);
