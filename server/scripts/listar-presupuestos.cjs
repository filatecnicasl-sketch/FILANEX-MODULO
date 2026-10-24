// Lista todos los presupuestos de filanex_local con sus líneas y fechas.
const { MongoClient } = require("mongodb");

(async () => {
  const cli = new MongoClient(process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017");
  await cli.connect();
  const db = cli.db("filanex_local");
  const docs = await db.collection("presupuestos").find({}).sort({ createdAt: -1 }).toArray();
  for (const p of docs) {
    console.log("===", p.serieNumero, "| estado:", p.estado, "| creado:", p.createdAt, "| modificado:", p.updatedAt);
    for (const l of p.lineas ?? []) {
      console.log("  -", JSON.stringify(l.descripcion), "| cant:", l.cantidad, "| pvp:", l.precioUnitario);
    }
    if (p.notas) console.log("  notas:", JSON.stringify(p.notas).slice(0, 200));
  }
  await cli.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
