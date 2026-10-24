// Enlaza los 22 PDFs de Verdent AI a sus facturas de compra: los copia a
// uploads/local/documentos/ (la misma carpeta que usa el OCR) y guarda la
// ruta en factura.ocr.ficheroUrl, que es de donde la lee la interfaz.
import fs from "fs";
import path from "path";

const env = Object.fromEntries(
  fs
    .readFileSync("/opt/filanex/server/.env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const { MongoClient } = await import("mongodb");
const c = new MongoClient(env.MONGODB_URI_BASE || "mongodb://localhost:27017");
await c.connect();
const db = c.db("filanex_local");

const ORIGEN = "/tmp/verdent-pdfs";
const DESTINO = "/opt/filanex/server/uploads/local/documentos";
fs.mkdirSync(DESTINO, { recursive: true });

const archivos = fs.readdirSync(ORIGEN).filter((f) => f.endsWith(".pdf"));
console.log(`PDFs a enlazar: ${archivos.length}`);

let ok = 0;
for (const archivo of archivos) {
  // verdent-LINKT-32544892.pdf → número de factura "LINKT 32544892"
  const numero = archivo.replace(/^verdent-/, "").replace(/\.pdf$/, "").replace("-", " ");
  const factura = await db.collection("facturacompras").findOne({ numeroFacturaProveedor: numero });
  if (!factura) {
    console.log(`${archivo}: SIN FACTURA (${numero})`);
    continue;
  }
  if (factura.ocr?.ficheroUrl) {
    console.log(`${archivo}: ya tenía PDF (${factura.ocr.ficheroUrl})`);
    continue;
  }
  fs.copyFileSync(path.join(ORIGEN, archivo), path.join(DESTINO, archivo));
  const url = `/uploads/local/documentos/${archivo}`;
  const r = await db
    .collection("facturacompras")
    .updateOne({ _id: factura._id }, { $set: { "ocr.ficheroUrl": url } });
  if (r.modifiedCount === 1) {
    console.log(`${numero}: PDF enlazado`);
    ok++;
  } else {
    console.log(`${numero}: fallo al actualizar`);
  }
}
console.log(`FIN: ${ok} enlazados de ${archivos.length}`);
await c.close();
