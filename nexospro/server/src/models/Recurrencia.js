import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";
import { lineaSchema } from "./FacturaVenta.js";

// Plantilla de facturación recurrente (cuotas de mantenimiento, etc.).
// Cada generación crea una FacturaVenta en estado borrador.
const recurrenciaSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente", required: true },
    concepto: { type: String, required: true }, // "Cuota mantenimiento centralita"
    lineas: [lineaSchema],
    periodicidad: {
      type: String,
      enum: ["mensual", "trimestral", "anual"],
      default: "mensual",
    },
    diaEmision: { type: Number, default: 1, min: 1, max: 28 },
    proximaEmision: { type: Date, required: true },
    activa: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default modeloTenant("Recurrencia", recurrenciaSchema);
