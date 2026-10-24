// Descarga los recibos con PDF de Stripe para ver su contenido real.
import mongoose from "mongoose";
import { conexionImap } from "./src/services/energia-correo.js";
import { descifrar } from "./src/services/cifrado.js";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;

const empresa = await db.collection("empresas").findOne();
const conf = empresa?.correoEntrante;
if (!conf?.passwordCifrada) throw new Error("No hay contraseña");

const client = conexionImap(conf, descifrar(conf.passwordCifrada));
await client.connect();
const lock = await client.getMailboxLock(conf.carpeta || "INBOX");

const uids = [16, 122, 348, 538, 696]; // Emergent, Moonshot, Novascent
mkdirSync("/tmp/recibos-stripe", { recursive: true });

for (const uid of uids) {
  const estructura = await client.fetchOne(uid, { bodyStructure: true }, { uid: true });
  const adjuntos = [];
  const recorrer = (nodo) => {
    if (nodo.disposition === "attachment" || nodo.dispositionParameters?.filename || nodo.parameters?.name) {
      adjuntos.push(nodo);
    }
    (nodo.childNodes ?? []).forEach(recorrer);
  };
  recorrer(estructura?.bodyStructure ?? {});
  const pdf = adjuntos.find((a) => /\.pdf$/i.test(a.dispositionParameters?.filename ?? a.parameters?.name ?? ""));
  if (!pdf) continue;

  const { content } = await client.download(uid, pdf.part || String(adjuntos.indexOf(pdf) + 1), { uid: true });
  const chunks = [];
  for await (const chunk of content) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  const nombre = pdf.dispositionParameters?.filename ?? pdf.parameters?.name ?? `uid-${uid}.pdf`;
  const out = path.join("/tmp/recibos-stripe", nombre);
  writeFileSync(out, buf);
  console.log(`Guardado ${out} (${buf.length} bytes)`);
}

lock.release();
await client.logout();
await mongoose.disconnect();
console.log("FIN");
