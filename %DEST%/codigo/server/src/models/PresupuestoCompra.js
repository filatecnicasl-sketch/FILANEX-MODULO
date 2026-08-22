import { Schema, model } from "mongoose";
import { lineaSchema } from "./FacturaVenta.js";

export const ESTADOS_PRESUPUESTO_COMPRA = ["pendiente", "aceptado", "rechazado"];

// Presupuesto de compra: la oferta que nos envía el proveedor.
// Si la aceptamos, se convierte en pedido de compra.
const presupuestoCompraSchema = new Schema(
  {
    numero: { type: String, required: true, unique: true }, // PR-000001
    proveedor: { type: Schema.Types.ObjectId, ref: "Proveedor", required: true },
    numeroPresupuestoProveedor: String, // referencia de la oferta del proveedor
    fecha: { type: Date, default: Date.now },
    lineas: { type: [lineaSchema], default: [] },
    baseImponible: { type: Number, default: 0 },
    cuotaIva: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    estado: { type: String, enum: ESTADOS_PRESUPUESTO_COMPRA, default: "pendiente" },
    pedido: { type: Schema.Types.ObjectId, ref: "PedidoCompra" },
    numeroPedido: String,
    notas: String,
  },
  { timestamps: true }
);

export default model("PresupuestoCompra", presupuestoCompraSchema);
