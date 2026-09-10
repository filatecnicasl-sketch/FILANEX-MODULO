// Normaliza las matrículas existentes (quita espacios, puntos y guiones,
// mayúsculas) en vehículos, citas, valoraciones, préstamos de cortesía y
// órdenes de trabajo. Uso: node scripts/normalizar-matriculas.mjs <db>
import mongoose from "mongoose";

const db = process.argv[2];
if (!db) { console.error("Uso: node scripts/normalizar-matriculas.mjs <db>"); process.exit(1); }
const uri = (process.env.MONGODB_URI_BASE || "mongodb://localhost:27017") + "/" + db;
await mongoose.connect(uri);

const norm = (v) => String(v ?? "").toUpperCase().replace(/[\s.\-]/g, "");
const cols = ["vehiculos", "citas", "valoracions", "prestamocortesias", "ordentrabajos"];

for (const col of cols) {
  const c = mongoose.connection.db.collection(col);
  const docs = await c.find({ matricula: { $type: "string" } }).project({ matricula: 1 }).toArray();
  let cambiados = 0;
  for (const d of docs) {
    const nueva = norm(d.matricula);
    if (nueva && nueva !== d.matricula) {
      // Evita chocar con el índice único de vehículos.
      if (col === "vehiculos") {
        const choque = await c.findOne({ matricula: nueva, _id: { $ne: d._id } });
        if (choque) { console.log(`  ! vehículo ${d.matricula} → ${nueva} ya existe (${choque._id}), se deja`); continue; }
      }
      await c.updateOne({ _id: d._id }, { $set: { matricula: nueva } });
      cambiados++;
    }
  }
  console.log(`${col}: ${cambiados} normalizadas de ${docs.length}`);
}
await mongoose.disconnect();
console.log("Hecho.");
