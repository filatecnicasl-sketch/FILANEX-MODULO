import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Canal de distribución (distribuidor) de una comercializadora: la empresa
// intermediaria que gestiona el alta o el traspaso del suministro. Una
// comercializadora (p. ej. Iberdrola) puede tener varios canales/distribuidores.
const canalDistribucionSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    comercializadora: { type: Schema.Types.ObjectId, ref: "Comercializadora", required: true },
    comercializadoraNombre: String, // desnormalizado para listados rápidos
    nif: { type: String, uppercase: true, trim: true },
    telefono: String,
    email: { type: String, lowercase: true, trim: true },
    contacto: String,
    notas: String,
  },
  { timestamps: true }
);

canalDistribucionSchema.index({ comercializadora: 1 });
canalDistribucionSchema.index({ nombre: 1 });

export default modeloTenant("CanalDistribucion", canalDistribucionSchema);
