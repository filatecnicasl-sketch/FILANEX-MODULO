import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Comercializadora de luz y gas con las condiciones pactadas con la agencia
// (canal directo). Las comisiones son distintas para luz y gas, y de tres
// tipos: pago único por alta, cantidad mensual por contrato activo y
// recurrente anual. Al calcular comisiones se leen de aquí.
const comercializadoraSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    nif: { type: String, uppercase: true, trim: true },
    telefono: String,
    email: { type: String, lowercase: true, trim: true },
    contacto: String, // persona de contacto / delegado
    calle: String,
    ciudad: String,
    cp: String,
    // Condiciones pactadas, en euros, separadas por tipo de suministro:
    // alta = pago único por cada alta/portabilidad conseguida,
    // mensual = € por contrato activo cada mes,
    // anual = € recurrentes cada año de vigencia.
    condiciones: {
      luz: { alta: { type: Number, default: 0 }, mensual: { type: Number, default: 0 }, anual: { type: Number, default: 0 } },
      gas: { alta: { type: Number, default: 0 }, mensual: { type: Number, default: 0 }, anual: { type: Number, default: 0 } },
    },
    notas: String,
  },
  { timestamps: true }
);

export default modeloTenant("Comercializadora", comercializadoraSchema);
