import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Operario del taller: ficha con coste por hora para el informe de
// productividad (horas facturadas vs horas invertidas).
const operarioSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    especialidad: String, // Chapa, Pintura, Mecánica…
    costeHora: { type: Number, default: 0 }, // coste interno €/h
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default modeloTenant("Operario", operarioSchema);
