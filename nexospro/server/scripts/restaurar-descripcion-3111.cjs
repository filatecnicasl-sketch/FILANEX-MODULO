// Restaura la descripción multilínea del presupuesto 3-111 (filanex_local),
// que se perdió al guardar con el campo de una sola línea.
const { MongoClient } = require("mongodb");

const TEXTO =
  "FILANEX FACTURACION\ndurante los primero meses tendreis la ayuda del agente IA nexo\nle podreis preguntar por los procesos del programa";

(async () => {
  const cli = new MongoClient(process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017");
  await cli.connect();
  const db = cli.db("filanex_local");
  const r = await db.collection("presupuestos").updateOne(
    { serieNumero: "3-111" },
    { $set: { "lineas.0.descripcion": TEXTO } }
  );
  console.log("modificado:", r.modifiedCount);
  const p = await db.collection("presupuestos").findOne({ serieNumero: "3-111" });
  console.log("descripcion ahora:", JSON.stringify(p.lineas[0].descripcion));
  await cli.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
