// Crea el proveedor Use AI Inc. correcto y traslada las 3 facturas de use.ai.
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;

// 1. Crear proveedor Use AI Inc. si no existe
let useAi = await db.collection("proveedors").findOne({ nombre: "Use AI Inc." });
if (!useAi) {
  const res = await db.collection("proveedors").insertOne({
    nombre: "Use AI Inc.",
    nombreComercial: "use.ai",
    nif: "",
    direccion: "69 Omega Dr, Suite 150, Newark, DE 19713, USA",
    pais: "Estados Unidos",
    email: "help@use.ai",
    alias: ["use.ai"],
    notas: "Constituida en Delaware, Estados Unidos. Suscripción cancelada el 09/09/2026.",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  useAi = { _id: res.insertedId };
  console.log("Creado proveedor Use AI Inc.:", useAi._id.toString());
} else {
  console.log("Proveedor Use AI Inc. ya existe:", useAi._id.toString());
}

// 2. Trasladar las facturas
const r = await db.collection("facturacompras").updateMany(
  { numeroFacturaProveedor: { $regex: /^USE-/ } },
  { $set: { proveedor: useAi._id } }
);
console.log(`Facturas trasladadas: ${r.modifiedCount}`);

// 3. Restaurar AZABACHE (por si el update anterior lo había tocado)
await db.collection("proveedors").updateOne(
  { _id: new mongoose.Types.ObjectId("6ab44cfb56bfafe3054e67c2") },
  { $set: { nombre: "AZABACHE", nombreComercial: "", alias: ["AZABACHE"] } }
);
console.log("Restaurado proveedor AZABACHE");

// 4. Mostrar conciliaciones una a una
const facturas = await db.collection("facturacompras")
  .find({ numeroFacturaProveedor: { $regex: /^USE-/ } })
  .sort({ fechaExpedicion: 1 })
  .toArray();

console.log("\nCONCILIACIONES USE.AI:\n");
for (const f of facturas) {
  const mov = await db.collection("movimientobancarios").findOne({ "conciliadoCon.id": f._id });
  console.log(`Factura ${f.numeroFacturaProveedor}`);
  console.log(`  Fecha factura: ${f.fechaExpedicion?.toISOString?.().slice(0, 10)}`);
  console.log(`  Importe: ${f.total.toFixed(2)} € (sin IVA)`);
  console.log(`  Estado: ${f.estadoPago}`);
  if (mov) {
    console.log(`  Cargo bancario:`);
    console.log(`    - Fecha: ${mov.fecha?.toISOString?.().slice(0, 10)}`);
    console.log(`    - Importe: ${mov.importe.toFixed(2)} €`);
    console.log(`    - Concepto: ${mov.concepto}`);
    console.log(`    - Conciliación OK: ${Math.abs(Math.abs(mov.importe) - f.total) < 0.01 ? "SÍ" : "NO"}`);
  } else {
    console.log(`  Sin cargo bancario conciliado`);
  }
  console.log("");
}

await mongoose.disconnect();
