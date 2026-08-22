import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";
import { lineaSchema } from "./FacturaVenta.js";

export const ESTADOS_ALBARAN_COMPRA = ["borrador", "confirmado", "facturado"];

// Albarán de compra: mercancía recibida del proveedor (a mano, desde un
// pedido, o por OCR). "numero" es el nuestro (AC-000001); numeroAlbaran es
// el del proveedor cuando viene del OCR.
const albaranCompraSchema = new Schema(
  {
    numero: { type: String, unique: true, sparse: true }, // AC-000001
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    proveedor: { type: Schema.Types.ObjectId, ref: "Proveedor" },
    numeroAlbaran: String, // nº de albarán del proveedor
    fecha: { type: Date, default: Date.now },
    lineas: { type: [lineaSchema], default: [] },
    baseImponible: { type: Number, default: 0 },
    cuotaIva: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    estado: {
      type: String,
      enum: ESTADOS_ALBARAN_COMPRA,
      default: "confirmado",
    },
    pedido: { type: Schema.Types.ObjectId, ref: "PedidoCompra" },
    facturaCompra: { type: Schema.Types.ObjectId, ref: "FacturaCompra" },
    // Taller: líneas de este albarán enviadas a órdenes de reparación
    // (materiales). Trazabilidad cruzada con OrdenTrabajo.albaranesCompra.
    ordenesTaller: [
      {
        orden: { type: Schema.Types.ObjectId, ref: "OrdenTrabajo" },
        numeroOrden: String,
        fecha: { type: Date, default: Date.now },
        lineas: Number, // cuántas líneas se enviaron
      },
    ],
    ocr: {
      confianza: Number,
      ficheroUrl: String,
      datosExtraidos: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

export default modeloTenant("AlbaranCompra", albaranCompraSchema);
