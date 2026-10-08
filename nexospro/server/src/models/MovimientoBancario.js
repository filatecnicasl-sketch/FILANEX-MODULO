import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

const movimientoBancarioSchema = new Schema(
  {
    fecha: { type: Date, required: true, index: true },
    concepto: { type: String, required: true },
    // Importe del movimiento: negativo para cargos, positivo para ingresos.
    importe: { type: Number, required: true },
    // Divisa en la que está el movimiento (el banco suele cargar en EUR).
    divisa: { type: String, default: "EUR" },
    // Saldo de la cuenta tras el movimiento, si viene en el extracto.
    saldo: { type: Number, default: 0 },
    // Referencia interna del banco (operación, transferencia...).
    referencia: { type: String, index: true, sparse: true },
    // Enlace con el documento con el que se concilió.
    conciliadoCon: {
      tipo: {
        type: String,
        enum: ["factura_compra", "gasto", "manual"],
        default: null,
      },
      id: { type: Schema.Types.ObjectId, default: null },
      fecha: { type: Date, default: null },
    },
    // Archivo del extracto desde el que se importó (opcional).
    archivoUrl: String,
    // Notas del usuario al conciliar.
    notas: String,
  },
  { timestamps: true }
);

// Índices para listados y conciliación.
movimientoBancarioSchema.index({ fecha: -1, createdAt: -1 });
movimientoBancarioSchema.index({ "conciliadoCon.tipo": 1, "conciliadoCon.id": 1 });

export default modeloTenant("MovimientoBancario", movimientoBancarioSchema);
