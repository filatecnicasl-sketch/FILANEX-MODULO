// Busca presupuestos cuyas líneas mencionen FILANEX o NEXO y muestra cómo
// están guardadas las descripciones (para ver por qué no se pueden editar).
const { MongoClient } = require("mongodb");

(async () => {
  const cli = new MongoClient(process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017");
  await cli.connect();
  const dbs = (await cli.db().admin().listDatabases()).databases
    .map((d) => d.name)
    .filter((n) => n.startsWith("filanex_"));
  for (const name of dbs) {
    const db = cli.db(name);
    const cols = await db.listCollections({ name: "presupuestos" }).toArray();
    if (!cols.length) continue;
    const docs = await db
      .collection("presupuestos")
      .find({ "lineas.descripcion": /filanex|nexo/i })
      .toArray();
    for (const p of docs) {
      console.log("=== DB:", name, "| presupuesto:", p.serieNumero, "| estado:", p.estado, "| albaran:", !!p.albaranVenta, "| factura:", !!p.facturaVenta);
      for (const l of p.lineas ?? []) {
        console.log("  linea:", JSON.stringify(l, null, 2).slice(0, 600));
      }
      console.log("  notas:", JSON.stringify(p.notas)?.slice(0, 300));
    }
  }
  await cli.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
