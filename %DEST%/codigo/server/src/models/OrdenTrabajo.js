import { Schema, model } from "mongoose";
import { lineaSchema } from "./FacturaVenta.js";

export const ESTADOS_OT = ["recepcion", "en_curso", "finalizado", "entregado"];

const ordenTrabajoSchema = new Schema(
  {
    numero: { type: String, required: true, unique: true }, // OT-000001
    vehiculo: { type: Schema.Types.ObjectId, ref: "Vehiculo" },
    matricula: { type: String, required: true, uppercase: true, trim: true },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    clienteNombre: String,
    telefono: String,
    trabajos: { type: [String], default: [] }, // Chapa, Pintura, Mecánica...
    motivo: String,
    km: Number,
    estado: { type: String, enum: ESTADOS_OT, default: "recepcion" },
    fechaEntrada: { type: Date, default: Date.now },
    fechaEntregaPrevista: Date,
    lineas: { type: [lineaSchema], default: [] }, // mano de obra y materiales a facturar
    total: { type: Number, default: 0 }, // total con IVA de las líneas
    factura: { type: Schema.Types.ObjectId, ref: "FacturaVenta" },
    numeroFactura: String, // se rellena al emitir la factura
  },
  { timestamps: true }
);

export default model("OrdenTrabajo", ordenTrabajoSchema);
