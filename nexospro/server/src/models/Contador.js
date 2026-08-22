import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

const contadorSchema = new Schema(
  {
    clave: { type: String, required: true, unique: true }, // ej. "facturaVenta:A", "ordenTrabajo"
    valor: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default modeloTenant("Contador", contadorSchema);
