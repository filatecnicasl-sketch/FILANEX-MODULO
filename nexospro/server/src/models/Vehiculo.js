import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

const vehiculoSchema = new Schema(
  {
    matricula: { type: String, required: true, uppercase: true, trim: true },
    marca: String,
    modelo: String,
    bastidor: String, // VIN
    color: String,
    combustible: String,
    anio: Number,
    km: Number,
    tipo: { type: String, enum: ["cliente", "cortesia"], default: "cliente" },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    clienteNombre: String, // desnormalizado para listados rápidos
    notas: String,
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
