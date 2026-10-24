import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Registro histórico de conciliaciones bancarias: cada conciliación o
// desconciliación (automática o manual) deja aquí una entrada auditable.
const conciliacionLogSchema = new Schema(
  {
    // "conciliacion" | "desconciliacion"
    accion: { type: String, enum: ["conciliacion", "desconciliacion"], required: true },
    // "automatica" | "manual"
    modo: { type: String, enum: ["automatica", "manual"], required: true },
    // Usuario que la ejecutó (email); en automática, quien lanzó el proceso.
    usuario: { type: String, default: "" },
    // Movimiento bancario afectado (id + copia de datos clave).
    movimiento: {
      id: { type: Schema.Types.ObjectId, required: true },
      fecha: Date,
      concepto: String,
      importe: Number,
    },
    // Documento con el que se vinculó (o del que se desvinculó).
    documento: {
      tipo: { type: String, enum: ["factura_compra", "gasto", "factura_venta", "facturas_venta", "remesa", "movimiento_tesoreria", "manual"] },
      id: { type: Schema.Types.ObjectId, default: null },
      descripcion: String,
      // Detalle de por qué casó (puntuación, referencia, nombre...) en automática.
      criterio: String,
    },
    // Importe aplicado como pago/cobro (si se registró), para auditoría.
    importeAplicado: { type: Number, default: 0 },
    notas: String,
  },
  { timestamps: true }
);

conciliacionLogSchema.index({ createdAt: -1 });
conciliacionLogSchema.index({ "movimiento.id": 1 });

export default modeloTenant("ConciliacionLog", conciliacionLogSchema);
