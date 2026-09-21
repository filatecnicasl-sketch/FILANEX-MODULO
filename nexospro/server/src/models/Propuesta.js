import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Sugerencias de mejora que escriben los usuarios de cada empresa desde
// Ayuda → Novedades → Propuestas.
const propuestaSchema = new Schema(
  {
    texto: { type: String, required: true, trim: true, maxlength: 1000 },
    usuarioNombre: { type: String, default: "" },
    usuarioEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

propuestaSchema.index({ createdAt: -1 });

export default modeloTenant("Propuesta", propuestaSchema);
