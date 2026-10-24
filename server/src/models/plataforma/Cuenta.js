import { Schema, model } from "mongoose";

const cuentaSchema = new Schema(
  {
    nombre: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true }, // scrypt "salt:hash"
    rol: { type: String, enum: ["admin", "usuario"], default: "usuario" },
    superadmin: { type: Boolean, default: false }, // solo la cuenta raíz de la plataforma
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    activa: { type: Boolean, default: true },
    ultimoAcceso: { type: Date },
    // Identificador de la sesión vigente: al entrar se renueva, así los tokens
    // anteriores (otros dispositivos/pestañas) quedan invalidados al momento.
    sesion: { type: String, default: "" },
  },
  { timestamps: true }
);

export default model("Cuenta", cuentaSchema);
