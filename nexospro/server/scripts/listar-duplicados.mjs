// Lista los clientes duplicados por nombre/NIF parecido en una BD.
import mongoose from "mongoose";
import Cliente from "../src/models/Cliente.js";

const db = process.argv[2];
const patron = process.argv[3] || "FRANCISCO";
if (!db) { console.error("Uso: node scripts/listar-duplicados.mjs <db> [patron]"); process.exit(1); }
const uri = (process.env.MONGODB_URI_BASE || "mongodb://localhost:27017") + "/" + db;
await mongoose.connect(uri);
const lista = await Cliente.find({ nombre: new RegExp(patron, "i") }).lean();
console.log(JSON.stringify(lista.map((x) => ({
  _id: x._id, codigo: x.codigo, nombre: x.nombre, nif: x.nif, telefono: x.telefono, email: x.email,
})), null, 2));
await mongoose.disconnect();
