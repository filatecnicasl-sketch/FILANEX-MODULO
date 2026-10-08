import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Canal de distribución (distribuidor / intermediario). Un canal puede vender
// varias comercializadoras, por eso se guarda un array de referencias.
const canalDistribucionSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    comercializadoras: [{ type: Schema.Types.ObjectId, ref: "Comercializadora" }],
    comercializadoraNombres: [String], // desnormalizado para listados rápidos
    nif: { type: String, uppercase: true, trim: true },
    telefono: String,
    email: { type: String, lowercase: true, trim: true },
    contacto: String,
    notas: String,
  },
  { timestamps: true }
);

canalDistribucionSchema.index({ comercializadoras: 1 });
canalDistribucionSchema.index({ nombre: 1 });

export default modeloTenant("CanalDistribucion", canalDistribucionSchema);
