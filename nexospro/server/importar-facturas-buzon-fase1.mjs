// Importa facturas del buzón — Fase 1 con reconexión por lotes.
import mongoose from "mongoose";
import { conexionImap } from "./src/services/energia-correo.js";
import { descifrar } from "./src/services/cifrado.js";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import path from "path";

const TMP = "/tmp/importar-facturas-buzon";
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

async function conectar() {
  const client = conexionImap(conf, descifrar(conf.passwordCifrada));
  await client.connect();
  return client;
}

let client = await conectar();
let lock = await client.getMailboxLock(conf.carpeta || "INBOX");

const uidsLink = await client.search({ from: "notifications@link.com" }, { uid: true });
const uidsStripe = await client.search({ from: "stripe.com" }, { uid: true });
const uidsInvoice = await client.search({ header: { subject: "Your receipt from" } }, { uid: true });
const todos = [...new Set([...uidsLink, ...uidsStripe, ...uidsInvoice])].sort((a, b) => a - b);

console.log(`Correos de Stripe/Link encontrados: ${todos.length}`);
lock.release();
await client.logout();

const faltantes = [];
const yaDescargados = new Set();

// Descargar en lotes de 10, reconectando si falla.
const LOTES = 10;
for (let i = 0; i < todos.length; i += LOTES) {
  const lote = todos.slice(i, i + LOTES);
  let intentos = 0;
  while (intentos < 3) {
    try {
      client = await conectar();
      lock = await client.getMailboxLock(conf.carpeta || "INBOX");
      for await (const msg of client.fetch(lote, { envelope: true, bodyStructure: true }, { uid: true })) {
        const env = msg.envelope;
        const key = `${msg.uid}`;
        if (yaDescargados.has(key)) continue;

        const adjuntos = [];
        const recorrer = (nodo) => {
          if (nodo.disposition === "attachment" || nodo.dispositionParameters?.filename || nodo.parameters?.name) adjuntos.push(nodo);
          (nodo.childNodes ?? []).forEach(recorrer);
        };
        recorrer(msg.bodyStructure ?? {});
        const pdfs = adjuntos.filter((a) => /Invoice-.*\.pdf$/i.test(a.dispositionParameters?.filename ?? a.parameters?.name ?? ""));

        for (let j = 0; j < pdfs.length; j++) {
          const pdf = pdfs[j];
          const nombreArchivo = pdf.dispositionParameters?.filename ?? pdf.parameters?.name ?? `uid-${msg.uid}-${j}.pdf`;
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
        yaDescargados.add(key);
      }
      lock.release();
      await client.logout();
      console.log(`Lote ${i / LOTES + 1}/${Math.ceil(todos.length / LOTES)} descargado`);
      break;
    } catch (e) {
      intentos++;
      console.error(`Error lote ${i / LOTES + 1}, intento ${intentos}: ${e.message}`);
      try { await client?.logout(); } catch {}
      if (intentos >= 3) {
        console.error(`Lote fallido: ${lote.join(",")}`);
        break;
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

await mongoose.disconnect();

writeFileSync(path.join(TMP, "faltantes.json"), JSON.stringify(faltantes, null, 2));
console.log(`\nDescargadas ${faltantes.length} facturas faltantes:`);
for (const f of faltantes) console.log(`- ${f.numero} | ${f.fechaCorreo}`);
