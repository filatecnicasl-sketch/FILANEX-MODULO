import { Schema, model } from "mongoose";
import { lineaSchema } from "./FacturaVenta.js";

export const ESTADOS_PEDIDO_COMPRA = ["borrador", "confirmado", "recibido", "cancelado"];

// Pedido de compra: lo que nosotros pedimos al proveedor.
// Cuando llega la mercancía se pasa a albarán de compra.
const pedidoCompraSchema = new Schema(
  {
    numero: { type: String, required: true, unique: true }, // PC-000001
    proveedor: { type: Schema.Types.ObjectId, ref: "Proveedor", required: true },
    fecha: { type: Date, default: Date.now },
    lineas: { type: [lineaSchema], default: [] },
    baseImponible: { type: Number, default: 0 },
    cuotaIva: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    estado: { type: String, enum: ESTADOS_PEDIDO_COMPRA, default: "borrador" },
    albaran: { type: Schema.Types.ObjectId, ref: "AlbaranCompra" },
    numeroAlbaran: String,
    notas: String,
  },
  { timestamps: true }
);

export default model("PedidoCompra", pedidoCompraSchema);
