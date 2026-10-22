import mongoose from "mongoose";

const conn = await mongoose.createConnection("mongodb://localhost:27017/filanex_montiel").asPromise();
const props = await conn.db
  .collection("propuestas")
  .find({ estado: "pendiente" })
  .sort({ createdAt: -1 })
  .limit(15)
  .toArray();
for (const p of props) {
  console.log("----", p._id, "|", p.createdAt?.toISOString?.().slice(0, 16), "|", p.usuarioNombre);
  console.log(String(p.texto).slice(0, 200));
}
await conn.close();
