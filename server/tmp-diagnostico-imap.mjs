// Prueba de control: mismo patrón que funcionó (últimos 30 mensajes).
import "dotenv/config";
import mongoose from "mongoose";
import { conexionImap } from "./src/services/energia-correo.js";
import { descifrar } from "./src/services/cifrado.js";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;
const empresa = await db.collection("empresas").findOne();
const conf = empresa?.correoEntrante;

const client = conexionImap(conf, descifrar(conf.passwordCifrada));
await client.connect();
console.log("CONEXION OK");
const lock = await client.getMailboxLock(conf.carpeta || "INBOX");
try {
  const uids = await client.search({ all: true }, { uid: true });
  console.log("Total UIDs:", uids.length);

  // Prueba A: últimos 30 (lo que funcionó antes)
  const ultimos = uids.slice(-30).reverse();
  let n = 0;
  for await (const msg of client.fetch(ultimos, { envelope: true, bodyStructure: true }, { uid: true })) n++;
  console.log("Prueba A (últimos 30): OK,", n, "mensajes");

  // Prueba B: los UID de correos de factura (from search)
  let uidsFac = [];
  for (const c of [{ from: "invoice+statements" }, { from: "notifications@link.com" }]) {
    uidsFac = uidsFac.concat(await client.search(c, { uid: true }));
  }
  uidsFac = [...new Set(uidsFac)].sort((a, b) => a - b);
  console.log("UIDs factura:", uidsFac.length, "| primero:", uidsFac[0], "| último:", uidsFac[uidsFac.length - 1]);

  // Prueba B1: los 10 MÁS VIEJOS de factura
  const viejos = uidsFac.slice(0, 10);
  n = 0;
  for await (const msg of client.fetch(viejos, { envelope: true, bodyStructure: true }, { uid: true })) n++;
  console.log("Prueba B1 (10 más viejos): OK,", n, "mensajes");

  // Prueba B2: todos los 57
  n = 0;
  for await (const msg of client.fetch(uidsFac, { envelope: true, bodyStructure: true }, { uid: true })) n++;
  console.log("Prueba B2 (todos): OK,", n, "mensajes");
} finally {
  try { lock.release(); await client.logout(); } catch { /* nada */ }
}
await mongoose.disconnect();
console.log("FIN");
process.exit(0);
