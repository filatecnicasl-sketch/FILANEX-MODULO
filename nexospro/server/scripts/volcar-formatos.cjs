// Vuelca las plantillas de formatos de filanex_local (resumen de elementos
// de texto) para localizar dónde está el texto fijo de la promo NEXO.
const { MongoClient } = require("mongodb");

(async () => {
  const cli = new MongoClient(process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017");
  await cli.connect();
  const db = cli.db("filanex_local");
  const colNames = (await db.listCollections().toArray()).map((c) => c.name);
  console.log("colecciones:", colNames.join(", "));
  for (const col of colNames.filter((n) => /formato/i.test(n))) {
    const docs = await db.collection(col).find({}).toArray();
    for (const d of docs) {
      console.log("\n=== doc", d._id?.toString(), "| claves:", Object.keys(d).join(","));
      console.log("nombre:", d.nombre, "| tipo:", d.tipo, "| documento:", d.documento);
      const elems = d.elementos ?? d.elements ?? [];
      console.log("nº elementos:", elems.length);
      for (const el of elems) {
        if (el.type === "text" || el.type === "texto" || el.text || el.contenido) {
          console.log(
            `  [${el.type}] x=${el.x} y=${el.y} fieldKey=${el.fieldKey ?? "-"} texto=${JSON.stringify(el.text ?? el.contenido ?? "").slice(0, 120)}`
          );
        }
      }
    }
  }
  await cli.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
