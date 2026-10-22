// Muestra las facturas de compra ya registradas de esos proveedores para ver qué números tienen.
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;

const proveedores = await db.collection("proveedors").find({
  $or: [
    { nombre: { $regex: /emergent|novascent|moonshot|verdent|stripe/i } },
    { alias: { $regex: /emergent|novascent|moonshot|verdent|stripe/i } },
  ],
}).project({ nombre: 1, alias: 1 }).toArray();

const idsProv = proveedores.map((p) => p._id);
const facturas = await db.collection("facturacompras")
  .find({ proveedor: { $in: idsProv } })
  .sort({ fechaExpedicion: -1 })
  .project({ numeroFacturaProveedor: 1, total: 1, fechaExpedicion: 1, proveedor: 1, divisa: 1 })
  .toArray();

for (const p of proveedores) console.log("PROV:", p.nombre, p.alias ? `(${p.alias})` : "");
console.log(`\nTotal facturas: ${facturas.length}\n`);
for (const f of facturas) {
  console.log(
    f.numeroFacturaProveedor ?? "(sin nº)",
    "|", f.fechaExpedicion?.toISOString?.().slice(0, 10) ?? "?",
    "|", f.total.toFixed(2), f.divisa ?? "EUR"
  );
}
await mongoose.disconnect();
