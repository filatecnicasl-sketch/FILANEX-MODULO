import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

export const lineaSchema = new Schema(
  {
    descripcion: { type: String, required: true },
    // Texto extendido bajo la descripción (detalle del servicio, alcance del
    // mantenimiento…). Multilínea, opcional; se imprime bajo la línea.
    detalle: String,
    cantidad: { type: Number, default: 1 },
    precioUnitario: { type: Number, default: 0 },
    // Descuento en porcentaje sobre cantidad × precio (habitual en facturas
    // de compra: "dto 10 %"). Viaja con la línea entre documentos.
    descuento: { type: Number, default: 0 },
    iva: { type: Number, default: 21 },
    // Taller: distingue mano de obra de materiales para aplicar los
    // descuentos negociados con la aseguradora al facturar la OT.
    tipo: { type: String, enum: ["mano_obra", "material"] },
    // Taller: imputación — nombre del grupo de trabajo al que pertenece la
    // línea (p.ej. "Chapa aleta derecha"). Permite subtotales por trabajo
    // en la orden y en el parte impreso.
    grupo: String,
  },
  { _id: false }
);

const facturaVentaSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    serie: { type: String, default: "A" },
    numero: Number,
    serieNumero: { type: String, index: true, sparse: true }, // número completo emitido: prefijo + número (p.ej. "A-1")
    fechaExpedicion: { type: Date, default: Date.now, index: true },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente", required: true, index: true },
    // Entrega distinta de la dirección fiscal (viene del presupuesto/albarán).
    direccionEntrega: {
      calle: String,
      ciudad: String,
      cp: String,
    },
    descripcion: String, // operación (DescripcionOperacion en el registro VeriFactu)
    lineas: [lineaSchema],
    baseImponible: { type: Number, default: 0 },
    cuotaIva: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    estado: {
      type: String,
      enum: ["borrador", "emitida", "anulada", "rectificada"],
      default: "borrador",
      index: true,
    },
    // Si es una rectificativa: factura original que rectifica (importes en negativo).
    rectifica: { type: Schema.Types.ObjectId, ref: "FacturaVenta", index: true },
    vencimiento: Date,
    // Método de pago previsto: texto libre, sale del catálogo configurable
    // de la empresa (Sistema → Series → Métodos de pago). Si el método tiene
    // plazos (p.ej. [30, 60, 90]) la factura genera esos vencimientos.
    metodoPago: { type: String, default: "Transferencia" },
    // Vencimientos parciales cuando el pago es a plazos (30/60/90, etc.).
    plazos: [
      {
        fecha: Date,
        importe: Number,
        _id: false,
      },
    ],
    cobros: [
      {
        fecha: { type: Date, default: Date.now },
        importe: { type: Number, required: true },
        metodo: {
          type: String,
          enum: ["transferencia", "efectivo", "tarjeta", "remesa", "otro"],
          default: "transferencia",
        },
        notas: String,
        _id: false,
      },
    ],
    remesa: { type: Schema.Types.ObjectId, ref: "Remesa" },
    origen: {
      presupuesto: { type: Schema.Types.ObjectId, ref: "Presupuesto" },
      presupuestos: [{ type: Schema.Types.ObjectId, ref: "Presupuesto" }],
      albaranes: [{ type: Schema.Types.ObjectId, ref: "AlbaranVenta" }],
      recurrencia: { type: Schema.Types.ObjectId, ref: "Recurrencia" },
      ordenTrabajo: { type: Schema.Types.ObjectId, ref: "OrdenTrabajo", index: true },
      ordenServicio: { type: Schema.Types.ObjectId, ref: "OrdenServicio" },
    },
    verifactu: {
      huella: String,
      huellaAnterior: String,
      qrContenido: String,
      enviada: { type: Boolean, default: false },
      estadoEnvio: String,
      fechaRegistro: Date,
    },
  },
  { timestamps: true }
);

// Índices compuestos para los listados más frecuentes.
facturaVentaSchema.index({ estado: 1, createdAt: -1 });
facturaVentaSchema.index({ cliente: 1, createdAt: -1 });
facturaVentaSchema.index({ estado: 1, vencimiento: 1 });

// Cobrado acumulado y estado de cobro derivado (no se persisten).
facturaVentaSchema.methods.cobrado = function () {
  return Math.round((this.cobros ?? []).reduce((s, c) => s + (c.importe ?? 0), 0) * 100) / 100;
};
facturaVentaSchema.methods.estadoCobro = function () {
  if (this.estado === "anulada") return "anulada";
  const c = this.cobrado();
  if (c <= 0) return "pendiente";
  if (c + 0.005 < (this.total ?? 0)) return "parcial";
  return "cobrada";
};

export default modeloTenant("FacturaVenta", facturaVentaSchema);
