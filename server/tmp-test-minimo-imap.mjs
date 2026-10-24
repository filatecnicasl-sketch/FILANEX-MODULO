// Prueba mínima: ¿qué_commands funcionan ya contra el buzón?
// 1) search  2) fetch envelope de UN mensaje  3) fetch bodyStructure de UNO
import "dotenv/config";
import mongoose from "mongoose";
import { conexionImap } from "./src/services/imap-robusto.js";
import { descifrar } from "./src/services/cifrado.js";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;
const empresa = await db.collection("empresas").findOne();
const conf = empresa?.correoEntrante;
console.log("Estado buzón (fallosConsecutivos):", conf?.fallosConsecutivos ?? 0, "| ultimaPasada:", conf?.ultimaPasada ?? "-", "| ultimoError:", conf?.ultimoError?.slice(0, 80) ?? "-");

const client = conexionImap(conf, descifrar(conf.passwordCifrada));
await client.connect();
console.log("1. CONEXION OK");
const lock = await client.getMailboxLock(conf.carpeta || "INBOX");
try {
  const uids = await client.search({ from: "invoice+statements" }, { uid: true });
  console.log("2. SEARCH OK:", uids.length, "correos");

  // fetch de UN solo mensaje, solo envelope (lo más ligero posible)
  const t0 = Date.now();
  const uno = await client.fetchOne(uids[0], { envelope: true }, { uid: true });
  console.log(`3. FETCH 1 envelope OK (${Date.now() - t0}ms):`, uno?.envelope?.subject?.slice(0, 40));

  // fetch de UN mensaje con bodyStructure (lo que necesita el script)
  const t1 = Date.now();
  const dos = await client.fetchOne(uids[0], { envelope: true, bodyStructure: true }, { uid: true });
  console.log(`4. FETCH 1 envelope+bodyStructure OK (${Date.now() - t1}ms)`);

  // fetch de 5 con bodyStructure (el trozo del script)
  const t2 = Date.now();
  let n = 0;
  for await (const m of client.fetch(uids.slice(0, 5), { envelope: true, bodyStructure: true }, { uid: true })) n++;
  console.log(`5. FETCH 5 envelope+bodyStructure OK (${Date.now() - t2}ms):`, n, "mensajes");
} finally {
  lock.release();
  await client.logout();
}
await mongoose.disconnect();
process.exit(0);
