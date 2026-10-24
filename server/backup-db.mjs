// Volcado puntual de la base de datos a JSON (backup previo a cambios grandes).
import "dotenv/config";
import mongoose from "mongoose";
import { mkdirSync, writeFileSync } from "node:fs";

const destino = process.argv[2];
if (!destino) {
  console.error("Uso: node backup-db.mjs <carpeta-destino>");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
mkdirSync(destino, { recursive: true });

const colecciones = await mongoose.connection.db.listCollections().toArray();
let total = 0;
for (const c of colecciones) {
  const docs = await mongoose.connection.db.collection(c.name).find({}).toArray();
  writeFileSync(`${destino}/${c.name}.json`, JSON.stringify(docs, null, 1));
  total += docs.length;
  console.log(`${c.name}: ${docs.length} docs`);
}
console.log(`TOTAL: ${total} documentos en ${colecciones.length} colecciones`);
await mongoose.disconnect();
