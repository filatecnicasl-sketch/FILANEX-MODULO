import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Registro inmutable exigido por el RRSIF (RD 1007/2023):
// alta/anulación de facturas emitidas, con huella encadenada.
const registroFacturacionSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    facturaVenta: { type: Schema.Types.ObjectId, ref: "FacturaVenta" },
    tipo: { type: String, enum: ["alta", "anulacion"], required: true },
    numSerieFactura: String,          // snapshot para el encadenamiento
    fechaExpedicionFactura: String,   // DD-MM-AAAA, snapshot
    huella: String,          // SHA-256 de este registro
    huellaAnterior: String,  // huella del registro previo (encadenamiento)
    fechaHoraGeneracion: { type: Date, default: Date.now },
    xml: String,             // XML remitido a la AEAT
    estadoEnvio: {
      type: String,
      enum: ["pendiente", "aceptado", "aceptado_con_errores", "rechazado"],
      default: "pendiente",
    },
    respuestaAeat: Schema.Types.Mixed,
  },
  { timestamps: true }
);

registroFacturacionSchema.index({ facturaVenta: 1, tipo: 1 }, { unique: true });
registroFacturacionSchema.index({ empresa: 1, numSerieFactura: 1, tipo: 1 }, { unique: true });

export default modeloTenant("RegistroFacturacion", registroFacturacionSchema);
