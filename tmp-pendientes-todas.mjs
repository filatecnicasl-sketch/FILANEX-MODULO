import mongoose from "mongoose";

const BASE = "mongodb://localhost:27017";
const PLATAFORMA = await mongoose.createConnection(`${BASE}/filanex_plataforma`).asPromise();
const tenants = await PLATAFORMA.db.collection("tenants").find({}, { slug: 1 }).toArray();
await PLATAFORMA.close();

for (const t of tenants) {
  const conn = await mongoose.createConnection(`${BASE}/filanex_${t.slug}`).asPromise();
  const pendientes = await conn.db
    .collection("propuestas")
    .find({ estado: "pendiente" })
    .sort({ createdAt: 1 })
    .toArray();
  if (pendientes.length) {
    console.log(`\n===== ${t.slug} (${pendientes.length} pendientes) =====`);
    for (const p of pendientes) {
      console.log("----", p._id.toString(), "|", p.createdAt?.toISOString?.(), "|", p.usuarioNombre || "?", "| adjuntos:", (p.adjuntos || []).length);
      console.log(String(p.texto).slice(0, 900));
      for (const a of p.adjuntos || []) console.log("   [adjunto]", a.url);
    }
  }
  await conn.close();
}
console.log("\n(fin)");
