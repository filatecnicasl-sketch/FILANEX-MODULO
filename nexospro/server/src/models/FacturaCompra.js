import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";
import { lineaSchema } from "./FacturaVenta.js";

const facturaCompraSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    proveedor: { type: Schema.Types.ObjectId, ref: "Proveedor", index: true },
    numeroFacturaProveedor: { type: String, index: true, sparse: true },
    fechaExpedicion: { type: Date, index: true },
    notas: String,
    lineas: [lineaSchema],
    baseImponible: { type: Number, default: 0 },
    cuotaIva: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    // Diferencia en céntimos entre el total calculado (base + IVA) y el total
    // que el proveedor imprimió en SU factura, cuando redondeó distinto.
    // Invariante: total = baseImponible + cuotaIva + ajusteRedondeo.
    ajusteRedondeo: { type: Number, default: 0 },
    // Si es false, al validar NO se crean artículos nuevos en el catálogo
    // (para facturas de material que no se revende: queda solo el gasto).
    crearArticulos: { type: Boolean, default: true },
    estado: {
      type: String,
      enum: ["pendiente_revision", "validada", "rechazada"],
      default: "pendiente_revision",
      index: true,
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

// Índices compuestos para listados frecuentes.
facturaCompraSchema.index({ estado: 1, createdAt: -1 });
facturaCompraSchema.index({ proveedor: 1, createdAt: -1 });

// Pagado acumulado y estado de pago derivado (no se persisten).
facturaCompraSchema.methods.pagado = function () {
  return Math.round((this.pagos ?? []).reduce((s, p) => s + (p.importe ?? 0), 0) * 100) / 100;
};
facturaCompraSchema.methods.estadoPago = function () {
  if (this.estado === "rechazada") return "rechazada";
  // Una factura en negativo (abono del proveedor) o de total cero no es algo
  // que haya que pagar: se considera saldada para que no aparezca como
  // pago pendiente en tesorería.
  if ((this.total ?? 0) <= 0) return "pagada";
  const p = this.pagado();
  if (p <= 0) return "pendiente";
  if (p + 0.005 < (this.total ?? 0)) return "parcial";
  return "pagada";
};

export default modeloTenant("FacturaCompra", facturaCompraSchema);
