// Busca cargos de 29,99 € en movimientobancarios.
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;

const movs = await db.collection("movimientobancarios")
  .find({ importe: { $lte: -29.94, $gte: -30.04 } })
  .toArray();
console.log(`Cargos de ~29,99 € encontrados: ${movs.length}`);
for (const m of movs) {
  console.log(
    m._id.toString().slice(-6),
    "|", m.fecha?.toISOString?.().slice(0, 10) ?? m.fecha,
    "|", m.importe.toFixed(2),
    "|", m.concepto?.slice(0, 60) ?? "",
    "| conciliado:", m.conciliadoCon ? "SÍ" : "no"
  );
}
await mongoose.disconnect();
