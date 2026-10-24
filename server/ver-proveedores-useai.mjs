// Muestra todos los proveedores relacionados con use.ai
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;
const provs = await db.collection("proveedors").find({
  $or: [
    { nombre: { $regex: /use\.?ai|azabache/i } },
    { nombreComercial: { $regex: /use\.?ai|azabache/i } },
    { alias: { $regex: /use\.?ai|azabache/i } },
  ],
}).toArray();
console.log("Proveedores encontrados:", provs.length);
for (const p of provs) {
  console.log(p._id.toString(), "|", p.nombre, "|", p.nombreComercial ?? "", "|", p.alias ?? "", "|", p.email ?? "");
}
await mongoose.disconnect();
