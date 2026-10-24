// Fase 1: descarga las facturas (Invoice-*.pdf) que faltan y guarda un JSON.
import mongoose from "mongoose";
import { conexionImap } from "./src/services/energia-correo.js";
import { descifrar } from "./src/services/cifrado.js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import path from "path";

const TMP = "/tmp/facturas-faltantes";
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;

const proveedores = await db.collection("proveedors").find({
  $or: [
    { nombre: { $regex: /emergent|novascent|moonshot|verdent/i } },
    { alias: { $regex: /emergent|novascent|moonshot|verdent/i } },
  ],
}).project({ nombre: 1 }).toArray();
const idsProv = proveedores.map((p) => p._id);
const facturas = await db.collection("facturacompras")
  .find({ proveedor: { $in: idsProv } })
  .project({ numeroFacturaProveedor: 1 })
  .toArray();
const numerosRegistrados = new Set(facturas.map((f) => f.numeroFacturaProveedor?.toUpperCase?.() ?? ""));

const empresa = await db.collection("empresas").findOne();
const conf = empresa?.correoEntrante;
if (!conf?.passwordCifrada) throw new Error("No hay contraseña");

const client = conexionImap(conf, descifrar(conf.passwordCifrada));
await client.connect();
const lock = await client.getMailboxLock(conf.carpeta || "INBOX");

const todos = await client.search({ all: true }, { uid: true });
const faltantes = [];

for await (const msg of client.fetch(todos, { envelope: true, bodyStructure: true }, { uid: true })) {
  const env = msg.envelope;
  const asunto = env.subject ?? "";
  const de = env.from?.map((f) => f.address).join(" ") ?? "";
  const esRecibo = /invoice\+statements/.test(de) || /notifications@link\.com/.test(de) || /Your receipt from|Tu recibo de/i.test(asunto);
  if (!esRecibo) continue;

  const adjuntos = [];
  const recorrer = (nodo) => {
    if (nodo.disposition === "attachment" || nodo.dispositionParameters?.filename || nodo.parameters?.name) adjuntos.push(nodo);
    (nodo.childNodes ?? []).forEach(recorrer);
  };
  recorrer(msg.bodyStructure ?? {});
  const pdfs = adjuntos.filter((a) => /Invoice-.*\.pdf$/i.test(a.dispositionParameters?.filename ?? a.parameters?.name ?? ""));

  for (let i = 0; i < pdfs.length; i++) {
    const pdf = pdfs[i];
    const nombreArchivo = pdf.dispositionParameters?.filename ?? pdf.parameters?.name ?? `uid-${msg.uid}-${i}.pdf`;
    const numeroFacturaPdf = nombreArchivo.match(/Invoice-([A-Z0-9]+-\d{4})/i)?.[1]?.toUpperCase() ?? null;
    if (!numeroFacturaPdf || numerosRegistrados.has(numeroFacturaPdf)) continue;

    const { content } = await client.download(msg.uid, pdf.part || String(adjuntos.indexOf(pdf) + 1), { uid: true });
    const chunks = [];
    for await (const chunk of content) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    const out = path.join(TMP, nombreArchivo);
    writeFileSync(out, buf);

    faltantes.push({
      uid: msg.uid,
      fechaCorreo: env.date ? new Date(env.date).toISOString().slice(0, 10) : null,
      archivo: out,
      numero: numeroFacturaPdf,
    });
  }
}

lock.release();
await client.logout();
await mongoose.disconnect();

writeFileSync(path.join(TMP, "faltantes.json"), JSON.stringify(faltantes, null, 2));
console.log(`Descargadas ${faltantes.length} facturas pendientes a ${TMP}`);
console.log("Lista:");
for (const f of faltantes) console.log(`- ${f.numero} | ${f.fechaCorreo} | ${path.basename(f.archivo)}`);
