// Busca cobros registrados con importe cero o negativo en facturas de venta.
const { MongoClient } = require("mongodb");

(async () => {
  const cli = new MongoClient(process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017");
  await cli.connect();
  const dbs = (await cli.db().admin().listDatabases()).databases
    .map((d) => d.name)
    .filter((n) => n.startsWith("filanex_"));
  for (const name of dbs) {
    const db = cli.db(name);
    const cols = await db.listCollections({ name: "facturaventas" }).toArray();
    if (!cols.length) continue;
    const docs = await db
      .collection("facturaventas")
      .find({ "cobros.importe": { $lte: 0.004 } })
      .project({ serieNumero: 1, cobros: 1 })
      .toArray();
    for (const f of docs) {
      for (const c of f.cobros ?? []) {
        if ((c.importe ?? 0) <= 0.004) {
          console.log(`${name} | ${f.serieNumero} | cobro importe=${c.importe} fecha=${c.fecha} metodo=${c.metodo}`);
        }
      }
    }
  }
  await cli.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
