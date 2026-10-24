// Da altura suficiente a las cajas de nombre y dirección de las plantillas de
// impresión, para que un nombre largo salga en dos líneas a tamaño normal en
// vez de encogerse. Nunca invade el elemento que tiene debajo.
//
// Uso: node scripts/ajustar-alturas-formatos.mjs [db1 db2 ...]
import mongoose from "mongoose";

const uriBase = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
const CAMPOS = ["cliente.nombre", "empresa.nombre", "cliente.direccion", "empresa.direccion", "proveedor.nombre", "proveedor.direccion"];

// Alto en mm que necesitan 2 líneas a un tamaño de fuente dado (pt), con el
// interlineado 1.25 que usa el renderizador, más un pequeño margen.
const altoDosLineas = (pt) => ((pt || 10) * 1.25 * 2) / 72 * 25.4 + 0.6;

function ajustar(elements) {
  let cambios = 0;
  for (const el of elements) {
    if (el.type !== "text" || !CAMPOS.some((c) => (el.text ?? "").includes(`{{${c}}}`))) continue;

    // Hueco libre hasta el siguiente elemento que esté debajo y solapado en X.
    const abajo = elements
      .filter((o) => o !== el && o.y > el.y && o.x < el.x + el.w && o.x + o.w > el.x)
      .reduce((min, o) => Math.min(min, o.y), Infinity);
    const hueco = abajo === Infinity ? el.h + 6 : abajo - el.y - 0.5;

    const deseado = altoDosLineas(el.fontSize);
    const nuevo = Math.round(Math.min(deseado, Math.max(el.h, hueco)) * 10) / 10;
    if (nuevo > el.h) {
      el.h = nuevo;
      cambios++;
    }
  }
  return cambios;
}

const dbs = process.argv.slice(2);
if (!dbs.length) {
  console.error("Indica al menos una base de datos.");
  process.exit(1);
}

for (const db of dbs) {
  const cx = await mongoose.createConnection(`${uriBase}/${db}`).asPromise();
  const col = cx.collection("formatos");
  let tocadas = 0;
  const todas = await col.find({}).toArray();
  for (const p of todas) {
    const elements = p.elements ?? [];
    const n = ajustar(elements);
    if (n) {
      await col.updateOne({ _id: p._id }, { $set: { elements } });
      console.log(`  ${db}: "${p.nombre}" (${p.tipoDocumento}) — ${n} caja(s)`);
      tocadas++;
    }
  }
  console.log(`${db}: ${tocadas} plantilla(s) ajustadas de ${todas.length}`);
  await cx.close();
}
