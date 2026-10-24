// Migración única: vehículos importados de la app antigua usan "kilometros" y "cliente_id".
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/nexospro";
await mongoose.connect(uri);
const col = mongoose.connection.db.collection("vehiculos");

const r1 = await col.updateMany(
  { kilometros: { $exists: true }, km: { $exists: false } },
  [{ $set: { km: "$kilometros" } }]
);

// Los cliente_id antiguos no existen en esta instalación: se limpian para no mostrar refs rotas.
const r2 = await col.updateMany(
  { cliente_id: { $exists: true } },
  [{ $set: { clienteNombre: { $ifNull: ["$clienteNombre", ""] } } }]
);

console.log("km migrados:", r1.modifiedCount, "| docs con cliente_id legacy:", r2.matchedCount);
await mongoose.disconnect();
