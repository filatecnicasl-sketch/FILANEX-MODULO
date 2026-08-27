import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";
import { lineaSchema } from "./FacturaVenta.js";

// Plantilla de facturación/albaranes recurrentes (cuotas de mantenimiento, etc.).
// tipoDocumento "factura" crea una FacturaVenta borrador; "albaran" crea un AlbaranVenta.
const recurrenciaSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente", required: true },
    concepto: { type: String, required: true }, // "Cuota mantenimiento centralita"
    tipoDocumento: { type: String, enum: ["factura", "albaran"], default: "factura" },
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
