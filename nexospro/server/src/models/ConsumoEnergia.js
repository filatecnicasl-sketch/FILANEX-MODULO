import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Consumo mensual de un punto de suministro. Se apunta mes a mes (a mano o
// desde la lectura OCR de la factura) y permite ver la evolución del consumo
// y la media, que es lo que alimenta los estudios de ahorro.
const consumoEnergiaSchema = new Schema(
  {
    suministro: { type: Schema.Types.ObjectId, ref: "Suministro", required: true },
    cups: String, // desnormalizado
    periodo: { type: String, required: true }, // "YYYY-MM" del mes facturado
    kwh: { type: Number, required: true, default: 0 },
    importe: { type: Number, default: 0 }, // total de la factura del cliente ese mes
    origen: { type: String, enum: ["manual", "ocr"], default: "manual" },
  },
  { timestamps: true }
);

consumoEnergiaSchema.index({ suministro: 1, periodo: 1 }, { unique: true });
consumoEnergiaSchema.index({ periodo: -1 });

export default modeloTenant("ConsumoEnergia", consumoEnergiaSchema);
