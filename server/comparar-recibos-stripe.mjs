// Descarga TODOS los recibos con PDF del buzón, extrae el nombre de la factura
// del PDF adjunto y lo compara con facturas de compra registradas.
import mongoose from "mongoose";
import { conexionImap } from "./src/services/energia-correo.js";
import { descifrar } from "./src/services/cifrado.js";
import { writeFileSync, mkdirSync, readdirSync, rmSync } from "fs";
import path from "path";

const TMP = "/tmp/recibos-stripe-todos";
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;

// Facturas registradas de proveedores Stripe/Link
const proveedores = await db.collection("proveedors").find({
  $or: [
    { nombre: { $regex: /emergent|novascent|moonshot|verdent/i } },
    { alias: { $regex: /emergent|novascent|moonshot|verdent/i } },
  ],
}).project({ nombre: 1 }).toArray();
const idsProv = proveedores.map((p) => p._id);
const facturas = await db.collection("facturacompras")
  .find({ proveedor: { $in: idsProv } })
  .project({ numeroFacturaProveedor: 1, total: 1, fechaExpedicion: 1 })
  .toArray();
const numerosRegistrados = new Set(facturas.map((f) => f.numeroFacturaProveedor?.toUpperCase?.() ?? ""));

console.log(`Facturas registradas de Emergent/Novascent/Verdent: ${facturas.length}`);

// Buzón
const empresa = await db.collection("empresas").findOne();
const conf = empresa?.correoEntrante;
if (!conf?.passwordCifrada) throw new Error("No hay contraseña");

const client = conexionImap(conf, descifrar(conf.passwordCifrada));
await client.connect();
const lock = await client.getMailboxLock(conf.carpeta || "INBOX");

const todos = await client.search({ all: true }, { uid: true });
const resultados = [];

for await (const msg of client.fetch(todos, { envelope: true, bodyStructure: true }, { uid: true })) {
  const env = msg.envelope;
  const asunto = env.subject ?? "";
  const de = env.from?.map((f) => f.address).join(" ") ?? "";

  const esReciboStripe = /invoice\+statements/.test(de) || /notifications@link\.com/.test(de);
  const esRecibo = esReciboStripe || /Your receipt from|Tu recibo de/i.test(asunto);
  if (!esRecibo) continue;

  const adjuntos = [];
  const recorrer = (nodo) => {
    if (nodo.disposition === "attachment" || nodo.dispositionParameters?.filename || nodo.parameters?.name) {
      adjuntos.push(nodo);
    }
    (nodo.childNodes ?? []).forEach(recorrer);
  };
  recorrer(msg.bodyStructure ?? {});
  const pdfs = adjuntos.filter((a) => /\.pdf$/i.test(a.dispositionParameters?.filename ?? a.parameters?.name ?? ""));

  for (let i = 0; i < pdfs.length; i++) {
    const pdf = pdfs[i];
    const nombreArchivo = pdf.dispositionParameters?.filename ?? pdf.parameters?.name ?? `uid-${msg.uid}-${i}.pdf`;
    const numeroFacturaPdf = nombreArchivo.match(/Invoice-([A-Z0-9]+-\d{4})/i)?.[1]?.toUpperCase() ?? null;

    resultados.push({
      uid: msg.uid,
      fecha: env.date ? new Date(env.date).toISOString().slice(0, 10) : null,
      asunto,
      archivo: nombreArchivo,
      numeroFacturaPdf,
      registrado: numeroFacturaPdf ? numerosRegistrados.has(numeroFacturaPdf) : null,
    });
  }
}

lock.release();
await client.logout();
await mongoose.disconnect();

const faltan = resultados.filter((r) => !r.registrado);
const yaEstan = resultados.filter((r) => r.registrado);

console.log(`\n=== PDFs de facturas encontrados en el buzón: ${resultados.length} ===`);
console.log(`Ya registradas: ${yaEstan.length} | Faltan: ${faltan.length}\n`);

console.log("YA REGISTRADAS:");
for (const r of yaEstan) {
  const f = facturas.find((x) => x.numeroFacturaProveedor?.toUpperCase() === r.numeroFacturaPdf);
  console.log(`- ${r.archivo} | ${r.fecha} | → ${f?.numeroFacturaProveedor} (${f?.total.toFixed(2)} €)`);
}

console.log("\nFALTAN POR DAR DE ALTA:");
for (const r of faltan) {
  console.log(`- UID ${r.uid} | ${r.fecha} | ${r.archivo}`);
}
