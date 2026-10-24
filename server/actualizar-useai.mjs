// Actualiza el proveedor use.ai con los datos fiscales correctos y muestra conciliaciones.
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;

await db.collection("proveedors").updateOne(
  { $or: [{ nombre: { $regex: /use\.?ai/i } }, { nombreComercial: { $regex: /use\.?ai/i } }] },
  {
    $set: {
      nombre: "Use AI Inc.",
      nombreComercial: "use.ai",
      direccion: "69 Omega Dr, Suite 150, Newark, DE 19713, USA",
      pais: "Estados Unidos",
      email: "help@use.ai",
      notas: "Constituida en Delaware, Estados Unidos. Suscripción cancelada el 09/09/2026.",
    },
  }
);

const facturas = await db.collection("facturacompras")
  .find({ numeroFacturaProveedor: { $regex: /^USE-/ } })
  .sort({ fechaExpedicion: 1 })
  .toArray();

console.log("FACTURAS DE USE.AI Y SUS CONCILIACIONES:\n");
for (const f of facturas) {
  const proveedor = await db.collection("proveedors").findOne({ _id: f.proveedor });
  const pago = (f.pagos ?? [])[0];
  const mov = pago
    ? await db.collection("movimientobancarios").findOne({ _id: pago.movimientoId ?? f._id })
    : null;
  // Buscar movimiento por conciliadoCon.id
  const movConciliado = f._id
    ? await db.collection("movimientobancarios").findOne({ "conciliadoCon.id": f._id })
    : null;

  console.log(`Factura: ${f.numeroFacturaProveedor}`);
  console.log(`  Proveedor: ${proveedor?.nombre}`);
  console.log(`  Fecha: ${f.fechaExpedicion?.toISOString?.().slice(0, 10)}`);
  console.log(`  Total: ${f.total.toFixed(2)} €`);
  console.log(`  Estado pago: ${f.estadoPago ?? "pendiente"}`);
  console.log(`  Conciliada con movimiento: ${movConciliado ? "SÍ" : "NO"}`);
  if (movConciliado) {
    console.log(`    - Fecha cargo: ${movConciliado.fecha?.toISOString?.().slice(0, 10)}`);
    console.log(`    - Importe cargo: ${movConciliado.importe.toFixed(2)} €`);
    console.log(`    - Concepto: ${movConciliado.concepto}`);
  }
  console.log("");
}

await mongoose.disconnect();
