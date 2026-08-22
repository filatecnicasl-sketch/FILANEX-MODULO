// Cuenta de acceso a la plataforma (antes "Usuario" por instalación).
// Vive en la BD plataforma: el login es central y el token lleva la empresa
// a la que pertenece la cuenta. El email es único globalmente (el login no
// pide empresa).
import { Schema, model } from "mongoose";

const cuentaSchema = new Schema(
  {
    nombre: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true }, // scrypt "salt:hash"
    rol: { type: String, enum: ["admin", "usuario"], default: "usuario" },
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    activa: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default model("Cuenta", cuentaSchema);
