// Fusiona dos clientes duplicados: mueve las referencias del "malo" al "bueno"
// y borra el malo. Uso: node scripts/fusionar-cliente.mjs <db> <idBueno> <idMalo>
import mongoose from "mongoose";
import Cliente from "../src/models/Cliente.js";

const [db, idBueno, idMalo] = process.argv.slice(2);
if (!db || !idBueno || !idMalo) {
  console.error("Uso: node scripts/fusionar-cliente.mjs <db> <idBueno> <idMalo>");
  process.exit(1);
}
const uri = (process.env.MONGODB_URI_BASE || "mongodb://localhost:27017") + "/" + db;
await mongoose.connect(uri);

const bueno = await Cliente.findById(idBueno).lean();
const malo = await Cliente.findById(idMalo).lean();
if (!bueno || !malo) { console.error("Algún id no existe"); process.exit(1); }
console.log(`Bueno (se queda): ${bueno.codigo} · ${bueno.nombre} · ${bueno.nif}`);
console.log(`Malo (se borra):  ${malo.codigo} · ${malo.nombre} · ${malo.nif}`);

// Colecciones que referencian a Cliente.
const cols = [
  ["citas", "cliente"],
  ["ordentrabajos", "cliente"],
  ["valoracions", "cliente"],
  ["presupuestos", "cliente"],
  ["albarans", "cliente"],
  ["facturas", "cliente"],
  ["vehiculos", "cliente"],
];
const maloOid = new mongoose.Types.ObjectId(idMalo);
const buenoOid = new mongoose.Types.ObjectId(idBueno);
for (const [col, campo] of cols) {
  try {
    const r = await mongoose.connection.db.collection(col).updateMany(
      { [campo]: maloOid },
      { $set: { [campo]: buenoOid, clienteNombre: bueno.nombre } }
    );
    if (r.modifiedCount) console.log(`  ${col}: ${r.modifiedCount} movidos`);
  } catch (e) { /* colección inexistente */ }
}
await Cliente.deleteOne({ _id: idMalo });
console.log("Fusionado y duplicado borrado.");
await mongoose.disconnect();
