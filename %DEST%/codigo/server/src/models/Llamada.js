import { Schema, model } from "mongoose";

// Llamada telefónica registrada por la integración con la centralita IP
// (handSIP de Alhambra-Eidos u otra vía webhook genérico).
const llamadaSchema = new Schema(
  {
    numero: { type: String, required: true }, // tal como llega de la centralita
    numeroNormalizado: String, // últimos 9 dígitos, para cruzar con contactos
    direccion: { type: String, enum: ["entrante", "saliente"], default: "entrante" },
    estado: {
      type: String,
      enum: ["sonando", "en-curso", "atendida", "perdida"],
      default: "sonando",
    },
    extension: String, // extensión que recibe/marca
    extId: String, // id externo de la llamada en la centralita (para correlar eventos)
    inicio: { type: Date, default: Date.now },
    fin: Date,
    duracionSeg: { type: Number, default: 0 },
    // Contacto reconocido por el número (si existe).
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    proveedor: { type: Schema.Types.ObjectId, ref: "Proveedor" },
    notas: String,
  },
  { timestamps: true }
);

export default model("Llamada", llamadaSchema);
