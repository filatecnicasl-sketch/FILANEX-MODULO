import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Documento fiscal de un cliente de la cartera de la asesoría: facturas
// emitidas y recibidas, tickets de gasto, nóminas y otros justificantes.
// Normalmente entra por OCR (foto o escaneo) y pasa por la bandeja de
// revisión antes de darse por bueno.

export const TIPOS_DOCUMENTO = ["emitida", "recibida", "gasto", "nomina", "otro"];
export const ESTADOS_DOCUMENTO = ["pendiente", "revisado", "contabilizado", "devuelto"];

const documentoFiscalSchema = new Schema(
  {
    clienteAsesoria: {
      type: Schema.Types.ObjectId,
      ref: "ClienteAsesoria",
      required: true,
      index: true,
    },
    tipo: { type: String, enum: TIPOS_DOCUMENTO, required: true, index: true },
    fecha: { type: Date, required: true },
    numero: { type: String, trim: true },
    // Tercero del documento: el cliente del cliente (emitida) o su proveedor.
    tercero: { type: String, trim: true },
    nifTercero: { type: String, trim: true },
    base: { type: Number, default: 0 },
    tipoIva: { type: Number, default: 21 },
    cuotaIva: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    // Retención de IRPF en facturas emitidas por autónomos (7 % o 15 %):
    // se necesita para calcular la previsión del modelo 130.
    retencion: { type: Number, default: 0, min: 0, max: 25 },
    cuotaRetencion: { type: Number, default: 0 },
    // Año y trimestre calculados en el alta para filtrar rápido los libros.
    ano: { type: Number, index: true },
    trimestre: { type: Number, min: 1, max: 4, index: true },
    archivo: { type: String },
    nombreArchivo: { type: String },
    origen: { type: String, enum: ["manual", "ocr"], default: "manual" },
    ocr: {
      confianza: Number,
      datosExtraidos: Schema.Types.Mixed,
    },
    estado: { type: String, enum: ESTADOS_DOCUMENTO, default: "pendiente", index: true },
    notas: String,
  },
  { timestamps: true }
);

documentoFiscalSchema.index({ clienteAsesoria: 1, ano: 1, trimestre: 1, tipo: 1 });

documentoFiscalSchema.pre("validate", function () {
  if (this.fecha) {
    const f = new Date(this.fecha);
    if (!Number.isNaN(f.getTime())) {
      this.ano = f.getFullYear();
      this.trimestre = Math.floor(f.getMonth() / 3) + 1;
    }
  }
  if (this.nifTercero) this.nifTercero = this.nifTercero.toUpperCase().replace(/[\s.-]/g, "");
  this.cuotaRetencion = Math.round((this.base ?? 0) * (this.retencion ?? 0)) / 100;
});

export default modeloTenant("DocumentoFiscal", documentoFiscalSchema);
