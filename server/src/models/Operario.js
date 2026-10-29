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
    // Contacto del operario (propuestas Montiel 27/10).
    telefono: String,
    email: String,
    // Situación laboral: alta fija, periodo de prueba o baja.
    situacion: { type: String, enum: ["alta", "prueba", "baja"], default: "alta" },
    fechaAlta: Date,
    fechaBaja: Date,
    // Notas importantes: categoría profesional, convenio, avisos…
    notas: String,
    // Curriculum en PDF o imagen (el que traen impreso en mano).
    curriculum: {
      url: String,
      nombre: String,
      fecha: Date,
    },
  },
  { timestamps: true }
);

export default modeloTenant("Operario", operarioSchema);
