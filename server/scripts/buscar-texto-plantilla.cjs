// Busca en las plantillas de formatos el texto de la promo NEXO, que parece
// incrustado como texto fijo en el impreso de presupuestos de filanex_local.
const { MongoClient } = require("mongodb");

(async () => {
  const cli = new MongoClient(process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017");
  await cli.connect();
  const dbs = (await cli.db().admin().listDatabases()).databases
    .map((d) => d.name)
    .filter((n) => n.startsWith("filanex_"));
  for (const name of dbs) {
    const db = cli.db(name);
    const colNames = (await db.listCollections().toArray()).map((c) => c.name);
    const col = colNames.find((n) => /formato/i.test(n));
    if (!col) continue;
    const docs = await db.collection(col).find({}).toArray();
    for (const d of docs) {
      const txt = JSON.stringify(d);
      if (/nexo|primeros meses|primero meses/i.test(txt)) {
        console.log("=== DB:", name, "| coleccion:", col, "| doc:", d._id?.toString(), "| tipo:", d.tipo ?? d.documento ?? d.clave);
        for (const el of d.elementos ?? d.elements ?? []) {
          const t = JSON.stringify(el);
          if (/nexo|primeros meses|primero meses/i.test(t)) {
            console.log("  elemento:", t.slice(0, 500));
          }
        }
      }
    }
  }
  await cli.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
