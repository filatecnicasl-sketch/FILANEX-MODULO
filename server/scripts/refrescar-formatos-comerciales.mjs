/**
 * Regenera desde los builtins SOLO las plantillas de documentos comerciales.
 * Las hojas de recepción de taller y de SAT no se tocan: son el formato
 * oficial que el usuario ya tiene ajustado.
 */
import { BUILTIN_TEMPLATES } from "../../client/src/editor/builtinTemplates.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { conexionTenant } from "../src/models/tenant.js";

dotenv.config();

const COMERCIALES = [
  "factura-venta",
  "presupuesto-venta",
  "albaran-venta",
  "pedido-cliente",
  "parte-taller",
  "parte-sat",
];

await mongoose.connect(process.env.MONGODB_URI);
const conn = conexionTenant(process.argv[2] || "nexospro");
const Formato = conn.model(
  "Formato",
  new mongoose.Schema(
    {
      tipoDocumento: String,
      nombre: String,
      porDefecto: { type: Boolean, default: false },
      page: { size: String, orientation: String },
      elements: [mongoose.Schema.Types.Mixed],
      cssExtra: String,
    },
    { timestamps: true },
  ),
);

let actualizadas = 0;
for (const builder of BUILTIN_TEMPLATES) {
  const t = builder();
  if (!COMERCIALES.includes(t.tipoDocumento)) continue;
  const r = await Formato.updateOne(
    { tipoDocumento: t.tipoDocumento },
    { $set: { page: t.page, elements: t.elements, cssExtra: t.cssExtra } },
  );
  if (r.matchedCount) actualizadas++;
  else {
    await Formato.create({
      tipoDocumento: t.tipoDocumento,
      nombre: t.name,
      porDefecto: true,
      page: t.page,
      elements: t.elements,
      cssExtra: t.cssExtra,
    });
    actualizadas++;
  }
}
console.log("Plantillas comerciales actualizadas:", actualizadas);
await mongoose.disconnect();
