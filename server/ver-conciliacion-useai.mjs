// Muestra con qué están conciliados los 3 cargos de use.ai.
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;

const movs = await db.collection("movimientobancarios").find({
  importe: { $lte: -29.94, $gte: -30.04 },
  concepto: { $regex: /use\.ai/i }
}).toArray();
for (const m of movs) {
  console.log(m._id.toString().slice(-6), m.fecha?.toISOString?.().slice(0, 10), m.importe.toFixed(2), JSON.stringify(m.conciliadoCon));
}
await mongoose.disconnect();
