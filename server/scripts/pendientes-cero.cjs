// Lista, por tenant, las facturas de venta que aparecen en "pendientes de
// cobro" con pendiente cero o negativo (para diagnosticar el caso del usuario).
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
      .find({ estado: "emitida" })
      .project({ serieNumero: 1, total: 1, cobros: 1, tipo: 1, fechaExpedicion: 1 })
      .toArray();
    for (const f of docs) {
      const cobrado = Math.round((f.cobros ?? []).reduce((s, c) => s + (c.importe ?? 0), 0) * 100) / 100;
      const pendiente = Math.round(((f.total ?? 0) - cobrado) * 100) / 100;
      if (pendiente <= 0.004) {
        console.log(
          `${name} | ${f.serieNumero} | tipo=${f.tipo} | total=${f.total} cobrado=${cobrado} pendiente=${pendiente} | fecha=${f.fechaExpedicion}`
        );
      }
    }
  }
  await cli.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
