import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Autofactura mensual de una comercializadora: el documento por el que la
// comercializadora liquida las comisiones del canal. Se registra y se
// concilia contra las comisiones que el programa calculó para ese mes y esa
// comercializadora, para cazar diferencias.
const autofacturaEnergiaSchema = new Schema(
  {
    comercializadora: { type: Schema.Types.ObjectId, ref: "Comercializadora", required: true },
    comercializadoraNombre: String, // desnormalizado
    numero: { type: String, trim: true },
    periodo: { type: String, required: true }, // "YYYY-MM" que liquida
    fecha: { type: Date, default: Date.now },
    base: { type: Number, required: true, default: 0 },
    ivaPorcentaje: { type: Number, default: 21 },
    iva: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    estado: { type: String, enum: ["pendiente", "cobrada"], default: "pendiente" },
    fechaCobro: Date,
    notas: String,
  },
  { timestamps: true }
);

autofacturaEnergiaSchema.index({ comercializadora: 1, periodo: 1 });
autofacturaEnergiaSchema.index({ periodo: -1 });
autofacturaEnergiaSchema.index({ estado: 1 });

export default modeloTenant("AutofacturaEnergia", autofacturaEnergiaSchema);
