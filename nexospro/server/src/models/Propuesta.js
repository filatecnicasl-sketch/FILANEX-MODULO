import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Sugerencias de mejora que escriben los usuarios de cada empresa desde
// Ayuda → Novedades → Propuestas.
const propuestaSchema = new Schema(
  {
    texto: { type: String, required: true, trim: true, maxlength: 1000 },
    usuarioNombre: { type: String, default: "" },
    usuarioEmail: { type: String, default: "" },
    // Capturas de pantalla que aclaran la propuesta (hasta 4 imágenes).
    adjuntos: { type: [{ url: String, nombre: String, _id: false }], default: [] },
    // Seguimiento: el administrador de la plataforma archiva cada propuesta
    // como realizada o descartada para saber lo que queda pendiente.
    estado: {
      type: String,
      enum: ["pendiente", "realizada", "descartada"],
      default: "pendiente",
    },
  },
  { timestamps: true }
);

propuestaSchema.index({ createdAt: -1 });
propuestaSchema.index({ estado: 1, createdAt: -1 });

export default modeloTenant("Propuesta", propuestaSchema);
