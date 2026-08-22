import { Schema, model } from "mongoose";
import { lineaSchema } from "./FacturaVenta.js";

const presupuestoSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    numero: Number,
    serieNumero: String, // p.ej. "P-1"
    fecha: { type: Date, default: Date.now },
    validezDias: { type: Number, default: 30 },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente", required: true },
    // Entrega distinta de la dirección fiscal (se traslada a albarán y factura).
    direccionEntrega: {
      calle: String,
      ciudad: String,
      cp: String,
    },
    lineas: [lineaSchema],
    baseImponible: { type: Number, default: 0 },
    cuotaIva: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    estado: {
      type: String,
      enum: ["borrador", "enviado", "aceptado", "rechazado", "facturado"],
      default: "borrador",
    },
    facturaVenta: { type: Schema.Types.ObjectId, ref: "FacturaVenta" },
    albaranVenta: { type: Schema.Types.ObjectId, ref: "AlbaranVenta" },
  },
  { timestamps: true }
);

export default model("Presupuesto", presupuestoSchema);
