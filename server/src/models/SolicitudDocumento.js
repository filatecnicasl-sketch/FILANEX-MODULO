import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Petición de documentación que la asesoría hace a un cliente de su cartera:
// "la factura de mayo de Recambios del Sur", "los tickets del 2T", etc.
// Cuando el documento llega (subido por OCR o a mano) se vincula y la
// solicitud queda resuelta.

export const ESTADOS_SOLICITUD = ["pendiente", "recibida", "cancelada"];

const solicitudDocumentoSchema = new Schema(
  {
    clienteAsesoria: {
      type: Schema.Types.ObjectId,
      ref: "ClienteAsesoria",
      required: true,
      index: true,
    },
    descripcion: { type: String, required: true, trim: true },
    // Periodo al que pertenece lo pedido, en texto libre: "2T 2026", "mayo 2026"...
    periodo: { type: String, trim: true },
    estado: { type: String, enum: ESTADOS_SOLICITUD, default: "pendiente", index: true },
    documento: { type: Schema.Types.ObjectId, ref: "DocumentoFiscal" },
    notas: String,
  },
  { timestamps: true }
);

export default modeloTenant("SolicitudDocumento", solicitudDocumentoSchema);
