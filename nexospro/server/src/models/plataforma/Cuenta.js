import { Schema, model } from "mongoose";

const cuentaSchema = new Schema(
  {
    nombre: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true }, // scrypt "salt:hash"
    rol: { type: String, enum: ["admin", "usuario"], default: "usuario" },
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    activa: { type: Boolean, default: true },
    ultimoAcceso: { type: Date },
  },
  { timestamps: true }
);

export default model("Cuenta", cuentaSchema);
