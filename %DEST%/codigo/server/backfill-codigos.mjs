// Asigna código ART-XXXXXX a los artículos que no tienen (creados por OCR antes del código automático).
import mongoose from "mongoose";

await mongoose.connect("mongodb://localhost:27017/nexospro");
const db = mongoose.connection.db;

const empresa = await db.collection("empresas").findOne({});
let contador = empresa?.contadores?.articulo ?? 1;

const sinCodigo = await db
  .collection("articulos")
  .find({ $or: [{ codigo: { $exists: false } }, { codigo: null }, { codigo: "" }] })
  .sort({ createdAt: 1 })
  .toArray();

for (const a of sinCodigo) {
  const codigo = `ART-${String(contador).padStart(6, "0")}`;
  await db.collection("articulos").updateOne({ _id: a._id }, { $set: { codigo } });
  console.log(`${codigo} → ${a.descripcion}`);
  contador++;
}

if (sinCodigo.length > 0) {
  await db.collection("empresas").updateOne({}, { $set: { "contadores.articulo": contador } });
}
console.log(`\nHecho: ${sinCodigo.length} artículos actualizados. Siguiente código: ART-${String(contador).padStart(6, "0")}`);
await mongoose.disconnect();
