import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";
import { normalizarMatricula } from "../services/validacion.js";

const vehiculoSchema = new Schema(
  {
    matricula: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      set: normalizarMatricula, // siempre sin espacios ni guiones
    },
    marca: String,
    modelo: String,
    bastidor: String, // VIN
    color: String,
    combustible: String,
    anio: Number,
    km: Number,
    tipo: { type: String, enum: ["cliente", "cortesia"], default: "cliente" },
    // Datos de gestión de la flota de cortesía (propuesta 23/10): cuándo se
    // incorporó el coche a la flota, cuándo se devuelve (fin de renting o
    // préstamo) y de qué empresa de renting es (vacío = propiedad).
    fechaLlegada: Date,
    fechaEntrega: Date,
    renting: String,
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    clienteNombre: String, // desnormalizado para listados rápidos
    notas: String,
    // Notas internas del vehículo (no salen en impresos): avisos del coche,
    // incidencias con el cliente, particularidades de la reparación… Cada
    // nota se puede marcar como aviso: entonces salta al abrir el historial
    // y al crear una cita con este vehículo.
    notasInternas: {
      type: [
        {
          texto: { type: String, required: true, trim: true, maxlength: 2000 },
          aviso: { type: Boolean, default: false },
          fecha: { type: Date, default: Date.now },
          autor: String,
        },
      ],
      default: [],
    },
    // Historial del vehículo: una entrada por cada recepción (OT), con las
    // fotos del estado tomadas al entrar. Se rellena solo desde el taller.
    historial: {
      type: [
        {
          fecha: Date,
          numeroOrden: String,
          orden: { type: Schema.Types.ObjectId, ref: "OrdenTrabajo" },
          motivo: String,
          km: Number,
          fotos: { type: [String], default: [] }, // rutas /uploads/taller/...
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

vehiculoSchema.index({ matricula: 1 }, { unique: true });

export default modeloTenant("Vehiculo", vehiculoSchema);
