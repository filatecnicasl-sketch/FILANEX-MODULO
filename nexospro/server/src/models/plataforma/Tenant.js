// Empresa cliente de la plataforma (tenant). Vive en la BD plataforma, no
// en las BD de negocio: es el registro maestro que relaciona cuentas con su
// base de datos.
import { Schema, model } from "mongoose";

const tenantSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true }, // p.ej. "local", "taller-perez"
    nombre: { type: String, required: true },
    dbName: { type: String, required: true, unique: true }, // BD de negocio de la empresa
    activa: { type: Boolean, default: true },
    plan: { type: String, default: "basico" },
    limiteUsuarios: { type: Number, default: 5 },
    notas: { type: String },
  },
  { timestamps: true }
);

export default model("Tenant", tenantSchema);
