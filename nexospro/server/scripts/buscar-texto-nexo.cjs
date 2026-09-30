// Busca el texto de la promo NEXO en facturas de venta, albaranes y
// presupuestos de todos los tenants.
const { MongoClient } = require("mongodb");

(async () => {
  const cli = new MongoClient(process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017");
  await cli.connect();
  const dbs = (await cli.db().admin().listDatabases()).databases
    .map((d) => d.name)
    .filter((n) => n.startsWith("filanex_"));
  for (const name of dbs) {
    const db = cli.db(name);
    for (const col of ["facturaventas", "albaranventas", "presupuestos"]) {
      const docs = await db
        .collection(col)
        .find({ "lineas.descripcion": /nexo|ayuda del agente/i })
        .toArray();
      for (const d of docs) {
        console.log("=== DB:", name, "| col:", col, "| numero:", d.serieNumero ?? d.numero);
        for (const l of d.lineas ?? []) {
          if (/nexo|ayuda del agente/i.test(l.descripcion ?? "")) {
            console.log("  descripcion:", JSON.stringify(l.descripcion));
          }
        }
        if (/nexo|ayuda del agente/i.test(d.notas ?? "")) {
          console.log("  notas:", JSON.stringify(d.notas));
        }
      }
    }
  }
  await cli.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
