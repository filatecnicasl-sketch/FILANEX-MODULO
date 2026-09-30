// Verificación 2 del módulo Energía: índice único de CUPS con datos
// correctos (22 caracteres) y limpieza del residuo de la prueba anterior.
import mongoose from "mongoose";

const BASE = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";

await mongoose.connect(BASE + "/filanex_local");
const { default: Suministro } = await import("../src/models/Suministro.js");

// 1. Limpieza del residuo anterior
const borrados = await Suministro.deleteMany({
  cups: { $in: ["ES002100000000000AB", "ES0021000000000000AB"] },
});
console.log("residuos borrados:", borrados.deletedCount);

// 2. Índice único: mismo CUPS dos veces
const datos = {
  cups: "ES0021000000000000AB",
  tipo: "luz",
  clienteNombre: "PRUEBA",
};
await Suministro.create(datos);
try {
  await Suministro.create(datos);
  console.log("ERROR: el índice único NO funciona");
} catch (e) {
  console.log("duplicado rechazado:", e.code === 11000 ? "OK (índice único)" : "código " + e.code);
}

// 3. Limpieza final
await Suministro.deleteMany({ cups: "ES0021000000000000AB" });
console.log("limpieza final OK. Suministros en filanex_local:", await Suministro.countDocuments());
await mongoose.disconnect();
process.exit(0);
