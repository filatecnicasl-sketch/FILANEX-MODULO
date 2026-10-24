import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

const usuarioSchema = new Schema(
  {
    nombre: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    rol: { type: String, enum: ["admin", "usuario"], default: "usuario" },
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
  },
  { timestamps: true }
);

export default modeloTenant("Usuario", usuarioSchema);
