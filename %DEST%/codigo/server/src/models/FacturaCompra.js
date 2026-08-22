import { Schema, model } from "mongoose";
import { lineaSchema } from "./FacturaVenta.js";

const facturaCompraSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    proveedor: { type: Schema.Types.ObjectId, ref: "Proveedor" },
    numeroFacturaProveedor: String,
    fechaExpedicion: Date,
    lineas: [lineaSchema],
    baseImponible: { type: Number, default: 0 },
    cuotaIva: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    estado: {
      type: String,
      enum: ["pendiente_revision", "validada", "rechazada"],
      default: "pendiente_revision",
    },
    origen: { type: String, enum: ["ocr", "manual"], default: "manual" },
    albaranes: [{ type: Schema.Types.ObjectId, ref: "AlbaranCompra" }], // conciliación
    pagos: [
      {
        fecha: { type: Date, default: Date.now },
        importe: { type: Number, required: true },
        metodo: {
          type: String,
          enum: ["transferencia", "tarjeta", "efectivo", "domiciliacion", "otro"],
          default: "transferencia",
        },
        nota: String,
      },
    ],
    ocr: {
      confianza: Number, // 0..1 devuelta por Gemini
      ficheroUrl: String,
      datosExtraidos: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// Pagado acumulado y estado de pago derivado (no se persisten).
facturaCompraSchema.methods.pagado = function () {
  return Math.round((this.pagos ?? []).reduce((s, p) => s + (p.importe ?? 0), 0) * 100) / 100;
};
facturaCompraSchema.methods.estadoPago = function () {
  if (this.estado === "rechazada") return "rechazada";
  const p = this.pagado();
  if (p <= 0) return "pendiente";
  if (p + 0.005 < (this.total ?? 0)) return "parcial";
  return "pagada";
};

export default model("FacturaCompra", facturaCompraSchema);
