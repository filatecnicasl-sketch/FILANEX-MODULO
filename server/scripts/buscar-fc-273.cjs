// Busca en todas las bases filanex_* la factura de compra con base ~273.39
// y muestra sus líneas y totales guardados (para diagnosticar el céntimo).
const { MongoClient } = require("mongodb");

(async () => {
  const cli = new MongoClient(process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017");
  await cli.connect();
  const dbs = (await cli.db().admin().listDatabases()).databases
    .map((d) => d.name)
    .filter((n) => n.startsWith("filanex_"));
  for (const name of dbs) {
    const db = cli.db(name);
    const cols = await db.listCollections({ name: "facturacompras" }).toArray();
    if (!cols.length) continue;
    const docs = await db
      .collection("facturacompras")
      .find({ baseImponible: { $gte: 273.38, $lte: 273.4 } })
      .toArray();
    for (const f of docs) {
      console.log("=== DB:", name);
      console.log("numero:", f.numeroFacturaProveedor, "| fecha:", f.fechaExpedicion, "| estado:", f.estado, "| origen:", f.origen);
      console.log(
        "totales guardados: base=",
        f.baseImponible,
        "iva=",
        f.cuotaIva,
        "total=",
        f.total
      );
      console.log("lineas:");
      for (const l of f.lineas ?? []) {
        const bruto = (l.cantidad ?? 0) * (l.precioUnitario ?? 0);
        const base = bruto * (1 - (l.descuento ?? 0) / 100);
        console.log(
          `  - "${l.descripcion}" cant=${l.cantidad} pvp=${l.precioUnitario} dto=${l.descuento} iva=${l.iva} | baseLinea=${base} ivaLinea=${(base * (l.iva ?? 0)) / 100}`
        );
      }
    }
  }
  await cli.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
