import "dotenv/config";
import mongoose from "mongoose";
const base = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
const conn = await mongoose.createConnection(`${base}/filanex_plataforma`).asPromise();
const cols = (await conn.db.listCollections().toArray()).map((c) => c.name);
console.log("colecciones:", cols.join(", "));
for (const nombre of cols) {
  if (!/usuario|user|cuenta/i.test(nombre)) continue;
  const docs = await conn.db.collection(nombre).find({}).limit(20).toArray();
  console.log(`--- ${nombre} (${docs.length}) ---`);
  for (const d of docs) console.log(JSON.stringify({ _id: d._id, email: d.email, rol: d.rol, nombre: d.nombre }));
}
await conn.close();
