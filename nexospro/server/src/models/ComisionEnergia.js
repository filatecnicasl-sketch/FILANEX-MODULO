import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Comisión devengada por un punto de suministro según las condiciones de la
// comercializadora. Tres conceptos: "alta" (pago único por alta/portabilidad),
// "mensual" (€ por contrato activo cada mes) y "anual" (recurrente cada año
// de vigencia). El periodo es el mes de devengo ("2026-10"). El índice único
// (suministro + concepto + periodo) hace que regenerar un mes sea seguro:
// nunca se duplica una comisión.
const comisionEnergiaSchema = new Schema(
  {
    comercializadora: { type: Schema.Types.ObjectId, ref: "Comercializadora" },
    comercializadoraNombre: String, // desnormalizado para listados
    suministro: { type: Schema.Types.ObjectId, ref: "Suministro", required: true },
    cups: String, // desnormalizado
    tipo: { type: String, enum: ["luz", "gas"] },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    clienteNombre: String,
    concepto: { type: String, enum: ["alta", "mensual", "anual"], required: true },
    periodo: { type: String, required: true }, // "YYYY-MM" del devengo
    importe: { type: Number, required: true, default: 0 },
    estado: { type: String, enum: ["pendiente", "cobrada"], default: "pendiente" },
    fechaCobro: Date,
    notas: String,
  },
  { timestamps: true }
);

comisionEnergiaSchema.index({ suministro: 1, concepto: 1, periodo: 1 }, { unique: true });
comisionEnergiaSchema.index({ estado: 1 });
comisionEnergiaSchema.index({ periodo: -1 });
comisionEnergiaSchema.index({ comercializadora: 1 });

export default modeloTenant("ComisionEnergia", comisionEnergiaSchema);
