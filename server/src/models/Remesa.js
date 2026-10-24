import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Remesa SEPA de domiciliaciones (pain.008.001.02).
const remesaSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    fechaCargo: { type: Date, required: true },
    recibos: [
      {
        facturaVenta: { type: Schema.Types.ObjectId, ref: "FacturaVenta" },
        cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
        iban: String,
        importe: Number,
        _id: false,
      },
    ],
    total: { type: Number, default: 0 },
    xml: String,
    estado: {
      type: String,
      enum: ["generada", "presentada", "cerrada"],
      default: "generada",
    },
  },
  { timestamps: true }
);

export default modeloTenant("Remesa", remesaSchema);
