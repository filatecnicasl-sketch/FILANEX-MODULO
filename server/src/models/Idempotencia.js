import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Registro de operaciones ya procesadas, para que un reenvío desde la cola
// sin conexión no cree el documento dos veces. Cada operación de la cola
// lleva su propia clave (X-Idem-Key); si la clave ya está aquí, se devuelve
// la respuesta guardada en lugar de volver a ejecutar la ruta.
const idempotenciaSchema = new Schema(
  {
    clave: { type: String, required: true, unique: true, index: true },
    metodo: String,
    url: String,
    estado: { type: Number, default: 200 },
    respuesta: Schema.Types.Mixed,
    creadoEn: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
  },
  { versionKey: false }
);

export default modeloTenant("Idempotencia", idempotenciaSchema);
