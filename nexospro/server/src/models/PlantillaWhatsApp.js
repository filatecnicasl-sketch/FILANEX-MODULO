import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

const esquema = new Schema(
  {
    nombre: { type: String, required: true, unique: true },
    categoria: String,
    idioma: { type: String, default: "es" },
    estado: { type: String, default: "PENDING" },
    metaId: String,
    motivoRechazo: String,
    sincronizadaAt: Date,
  },
  { timestamps: true, collection: "whatsapp_plantillas" }
);

export default modeloTenant("PlantillaWhatsApp", esquema);