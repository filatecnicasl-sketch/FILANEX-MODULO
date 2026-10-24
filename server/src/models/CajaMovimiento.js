import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Movimiento manual de efectivo dentro de una sesión de caja del TPV:
// entradas (meter cambio, un ingreso) y salidas (pagar a un proveedor,
// retirada al banco). Se tienen en cuenta en el arqueo del cierre.
const cajaMovimientoSchema = new Schema(
  {
    cajaSesion: { type: Schema.Types.ObjectId, ref: "CajaSesion", required: true, index: true },
    tipo: { type: String, enum: ["entrada", "salida"], required: true },
    importe: { type: Number, required: true },
    concepto: { type: String, default: "" },
    fecha: { type: Date, default: Date.now },
    usuario: String, // email del usuario que lo registró
  },
  { timestamps: true }
);

export default modeloTenant("CajaMovimiento", cajaMovimientoSchema);
