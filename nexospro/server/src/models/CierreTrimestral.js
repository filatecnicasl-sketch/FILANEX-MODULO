import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Estado del cierre de un trimestre para un cliente de la cartera. Es el
// corazón del trabajo del asesor: de un vistazo sabe con qué clientes puede
// cerrar el trimestre y con cuáles no.

export const ESTADOS_CIERRE = [
  "pendiente_docs", // Falta documentación del cliente
  "en_revision", // Hay documentación pendiente de revisar
  "listo", // Todo revisado: se puede calcular y presentar
  "presentado", // Modelos presentados en la AEAT
];

const cierreTrimestralSchema = new Schema(
  {
    clienteAsesoria: {
      type: Schema.Types.ObjectId,
      ref: "ClienteAsesoria",
      required: true,
    },
    ano: { type: Number, required: true },
    trimestre: { type: Number, required: true, min: 1, max: 4 },
    estado: { type: String, enum: ESTADOS_CIERRE, default: "pendiente_docs" },
    notas: String,
    presentadoEn: Date,
  },
  { timestamps: true }
);

cierreTrimestralSchema.index({ clienteAsesoria: 1, ano: 1, trimestre: 1 }, { unique: true });

export default modeloTenant("CierreTrimestral", cierreTrimestralSchema);
