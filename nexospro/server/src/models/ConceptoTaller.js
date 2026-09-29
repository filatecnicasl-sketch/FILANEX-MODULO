import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Catálogo de conceptos de taller: operaciones habituales con código corto
// ("1" = Reparar, "2" = Resanar…). Al escribir líneas en la orden/factura se
// teclea el código y se rellena la descripción; la sección decide en qué
// bloque de la factura de taller se imprime la línea.
const conceptoTallerSchema = new Schema(
  {
    codigo: { type: String, required: true, trim: true },
    descripcion: { type: String, required: true, trim: true },
    seccion: {
      type: String,
      enum: ["piezas", "mo_chapa", "mo_pintura"],
      default: "mo_chapa",
    },
    orden: { type: Number, default: 0 },
  },
  { timestamps: true }
);

conceptoTallerSchema.index({ codigo: 1 }, { unique: true });

export default modeloTenant("ConceptoTaller", conceptoTallerSchema);
