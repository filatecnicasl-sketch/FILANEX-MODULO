// Busca en TODO el buzón correos que mencionen invoice/factura/receipt,
// no solo de use.ai, por si las facturas vienen de otro dominio.
import mongoose from "mongoose";
import { conexionImap } from "./src/services/energia-correo.js";
import { descifrar } from "./src/services/cifrado.js";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;
const empresa = await db.collection("empresas").findOne();
const conf = empresa?.correoEntrante;
if (!conf?.passwordCifrada) throw new Error("No hay contraseña");

const client = conexionImap(conf, descifrar(conf.passwordCifrada));
await client.connect();
const lock = await client.getMailboxLock(conf.carpeta || "INBOX");

// Traemos los últimos 1000 mensajes y filtramos por asunto/cuerpo.
const todos = await client.search({ all: true }, { uid: true });
const ultimos = todos.slice(-1000);
console.log(`Analizando ${ultimos.length} mensajes...`);

let encontrados = 0;
for await (const msg of client.fetch(ultimos, { envelope: true, source: true }, { uid: true })) {
  const env = msg.envelope;
  const asunto = env.subject ?? "";
  const src = msg.source?.toString?.() ?? "";
  const de = env.from?.map((f) => f.address).join(" ") ?? "";
  const texto = `${asunto} ${de} ${src}`.toLowerCase();
  if (/(invoice|factura|recibo|receipt|billing|comprobante)/.test(texto)) {
    encontrados++;
    console.log(`\nUID ${msg.uid} | ${env.date} | ${asunto}`);
    console.log("De:", de);
    // Indica si tiene adjuntos
    const tieneAdjunto = /content-disposition: attachment/i.test(src);
    console.log("Adjunto:", tieneAdjunto ? "SÍ" : "no");
  }
}
console.log(`\nTotal correos con factura/recibo: ${encontrados}`);
lock.release();
await client.logout();
await mongoose.disconnect();
