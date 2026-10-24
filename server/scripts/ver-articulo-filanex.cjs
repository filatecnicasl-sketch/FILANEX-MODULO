// Busca el artículo FILANEX FACTURACION y muestra su ficha completa.
const { MongoClient } = require("mongodb");

(async () => {
  const cli = new MongoClient(process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017");
  await cli.connect();
  const db = cli.db("filanex_local");
  const arts = await db
    .collection("articulos")
    .find({ nombre: /filanex/i })
    .toArray();
  for (const a of arts) {
    console.log(JSON.stringify(a, null, 2));
  }
  await cli.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
