import { Schema, model } from "mongoose";

const esquema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },
    slug: { type: String, required: true, index: true },
    dbName: { type: String, required: true, index: true },
    wabaId: { type: String, required: true, index: true },
    phoneNumberId: { type: String, required: true, unique: true },
    numero: String,
    nombreVisible: String,
    tokenCifrado: { type: String, required: true },
    estado: { type: String, enum: ["activa", "desconectada", "error"], default: "activa" },
    calidad: String,
    conectadaAt: { type: Date, default: Date.now },
    desconectadaAt: Date,
    comprobadaAt: Date,
    ultimoError: String,
  },
  { timestamps: true, collection: "whatsapp_cuentas" }
);

export default model("WhatsAppCuenta", esquema);