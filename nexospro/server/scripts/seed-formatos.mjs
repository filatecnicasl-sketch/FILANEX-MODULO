import { BUILTIN_TEMPLATES } from "../../client/src/editor/builtinTemplates.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { conexionTenant } from "../src/models/tenant.js";

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);
const conn = conexionTenant("nexospro");
const Formato = conn.model("Formato", new mongoose.Schema({
  tipoDocumento: String,
  nombre: String,
  porDefecto: { type: Boolean, default: false },
  page: { size: String, orientation: String },
  elements: [mongoose.Schema.Types.Mixed],
  cssExtra: String,
}, { timestamps: true }));

const existentes = await Formato.countDocuments();
if (existentes === 0) {
  for (const builder of BUILTIN_TEMPLATES) {
    const t = builder();
    await Formato.create({
      tipoDocumento: t.tipoDocumento,
      nombre: t.name,
      porDefecto: true,
      page: t.page,
      elements: t.elements,
      cssExtra: t.cssExtra,
    });
  }
  console.log("Seedeado:", BUILTIN_TEMPLATES.length);
} else {
  console.log("Ya existen", existentes);
}
await mongoose.disconnect();
