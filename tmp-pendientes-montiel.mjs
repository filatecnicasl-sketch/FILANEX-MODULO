import mongoose from "mongoose";

const conn = await mongoose.createConnection("mongodb://localhost:27017/filanex_montiel").asPromise();
const pendientes = await conn.db
  .collection("propuestas")
  .find({ estado: "pendiente" })
  .sort({ createdAt: 1 })
  .toArray();
console.log("PENDIENTES:", pendientes.length);
for (const p of pendientes) {
  console.log("----", p._id.toString(), "|", p.createdAt?.toISOString?.(), "|", p.usuarioNombre || "?", "| adjuntos:", (p.adjuntos || []).length);
  console.log(String(p.texto).slice(0, 1200));
  for (const a of p.adjuntos || []) console.log("   [adjunto]", a.url);
}
await conn.close();
