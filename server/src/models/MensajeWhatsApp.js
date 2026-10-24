import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

export const ESTADOS_WHATSAPP = [
  "programado",
  "procesando",
  "enviado",
  "entregado",
  "leido",
  "respondido",
  "cancelado",
  "fallido",
];

const esquema = new Schema(
  {
    telefono: { type: String, required: true, index: true },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    clienteNombre: String,
    origen: {
      ambito: { type: String, enum: ["agenda", "taller", "servicio", "cliente", "documento"], required: true },
      tipo: String,
      id: String,
      numero: String,
    },
    clase: {
      type: String,
      enum: ["confirmacion", "recordatorio", "modificacion", "cancelacion", "documento", "manual"],
      required: true,
    },
    plantilla: { type: String, required: true },
    idioma: { type: String, default: "es" },
    variables: { type: [String], default: [] },
    programadoPara: { type: Date, required: true, index: true },
    estado: { type: String, enum: ESTADOS_WHATSAPP, default: "programado", index: true },
    intentos: { type: Number, default: 0 },
    proximoIntento: Date,
    bloqueadoHasta: Date,
    wamid: { type: String, sparse: true, index: true },
    idempotencia: { type: String, required: true, unique: true },
    enviadoAt: Date,
    entregadoAt: Date,
    leidoAt: Date,
    respondidoAt: Date,
    fallidoAt: Date,
    errorCodigo: String,
    error: String,
    creadoPor: { type: Schema.Types.ObjectId },
    creadoPorNombre: String,
  },
  { timestamps: true, collection: "whatsapp_mensajes" }
);

esquema.index({ estado: 1, programadoPara: 1, proximoIntento: 1 });
esquema.index({ "origen.ambito": 1, "origen.id": 1, createdAt: -1 });

export default modeloTenant("MensajeWhatsApp", esquema);