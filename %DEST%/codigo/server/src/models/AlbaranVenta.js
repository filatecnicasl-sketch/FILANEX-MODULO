import { Schema, model } from "mongoose";
import { lineaSchema } from "./FacturaVenta.js";

const albaranVentaSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    numero: Number,
    serieNumero: String, // p.ej. "ALB-1"
    fecha: { type: Date, default: Date.now },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente", required: true },
    // Entrega distinta de la dirección fiscal (obras, naves, delegaciones…).
    direccionEntrega: {
      calle: String,
      ciudad: String,
      cp: String,
    },
    lineas: [lineaSchema],
    estado: {
      type: String,
      enum: ["pendiente", "facturado"],
      default: "pendiente",
    },
    facturaVenta: { type: Schema.Types.ObjectId, ref: "FacturaVenta" },
    // Firma de entrega del material (tableta/móvil): acredita quién recoge.
    firmaEntrega: {
      nombre: String,
      dni: String,
      imagen: String, // ruta /uploads/firmas/...
      fecha: Date,
    },
  },
  { timestamps: true }
);

export default model("AlbaranVenta", albaranVentaSchema);
