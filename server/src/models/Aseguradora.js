import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Compañía aseguradora con las condiciones negociadas por el taller:
// precio de la hora de mano de obra y descuentos por tipo de línea.
// Al facturar una OT a la compañía se aplican automáticamente.
const aseguradoraSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    nif: { type: String, uppercase: true, trim: true },
    telefono: String,
    email: { type: String, lowercase: true, trim: true },
    contacto: String, // persona de contacto / perito habitual
    calle: String,
    ciudad: String,
    cp: String,
    // Condiciones negociadas:
    precioHoraMO: { type: Number, default: 0 }, // €/hora de mano de obra pactado
    dtoManoObra: { type: Number, default: 0 }, // % dto. en líneas de mano de obra
    dtoMateriales: { type: Number, default: 0 }, // % dto. en líneas de materiales
    dtoTotal: { type: Number, default: 0 }, // % dto. global (si > 0 sustituye a los dos anteriores)
    // Ficha de cliente usada al facturar a la compañía (se crea sola la 1ª vez).
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    notas: String,
  },
  { timestamps: true }
);

export default modeloTenant("Aseguradora", aseguradoraSchema);
