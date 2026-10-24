// Concilia los 3 cargos de use.ai con las facturas recién creadas.
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;

const relaciones = [
  { fecha: "2026-07-09", facturaNumero: "USE-09072026" },
  { fecha: "2026-08-06", facturaNumero: "USE-06082026" },
  { fecha: "2026-09-03", facturaNumero: "USE-03092026" },
];

for (const r of relaciones) {
  const factura = await db.collection("facturacompras").findOne({ numeroFacturaProveedor: r.facturaNumero });
  if (!factura) {
    console.log(`No se encontró factura ${r.facturaNumero}`);
    continue;
  }

  const mov = await db.collection("movimientobancarios").findOne({
    importe: { $lte: -29.94, $gte: -30.04 },
    concepto: { $regex: /use\.ai/i },
    fecha: new Date(r.fecha),
  });

  if (!mov) {
    console.log(`No se encontró movimiento para ${r.fecha}`);
    continue;
  }

  await db.collection("movimientobancarios").updateOne(
    { _id: mov._id },
    {
      $set: {
        conciliadoCon: {
          tipo: "factura_compra",
          id: factura._id,
          fecha: new Date(),
        },
      },
    }
  );

  // Marcar la factura como pagada
  await db.collection("facturacompras").updateOne(
    { _id: factura._id },
    {
      $set: { estadoPago: "pagada" },
      $push: {
        pagos: {
          fecha: mov.fecha,
          importe: Math.abs(mov.importe),
          medio: "tarjeta",
          notas: `Conciliado con extracto ${mov._id.toString().slice(-6)}`,
        },
      },
    }
  );

  console.log(`Conciliado ${r.facturaNumero} con movimiento ${mov._id.toString().slice(-6)}`);
}

await mongoose.disconnect();
console.log("FIN");
