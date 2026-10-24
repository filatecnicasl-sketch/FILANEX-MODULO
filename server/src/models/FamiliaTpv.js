import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

const familiaTpvSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    orden: { type: Number, default: 0 },
    imagen: { type: String, default: "" },
    color: { type: String, default: "" },
  },
  { timestamps: true }
);

familiaTpvSchema.index({ nombre: 1 }, { unique: true });

export default modeloTenant("FamiliaTpv", familiaTpvSchema);
