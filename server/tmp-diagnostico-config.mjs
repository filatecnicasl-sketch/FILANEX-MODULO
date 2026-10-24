// Diagnóstico de configuración: ¿qué tenemos guardado y qué encuentra Gmail?
// 1) Config real del buzón (sin secreto)
// 2) STATUS de la carpeta: total y SIN LEER (hipótesis: si hay cientos sin
//    leer, el sondeo viejo los re-descargaba ENTEROS cada 15 min = abuso)
// 3) Latencia de comandos triviales (NOOP) vs fetch (¿los 10 s son globales?)
import "dotenv/config";
import mongoose from "mongoose";
import { ImapFlow } from "imapflow";
import { descifrar } from "./src/services/cifrado.js";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;
const empresa = await db.collection("empresas").findOne();
const conf = empresa?.correoEntrante;
console.log("CONFIG GUARDADA:");
console.log(JSON.stringify({
  tipo: conf?.tipo,
  usuario: conf?.usuario,
  host: conf?.host,
  puerto: conf?.puerto,
  carpeta: conf?.carpeta,
  activo: conf?.activo,
  remitentes: conf?.remitentes,
  intervaloMin: conf?.intervaloMin,
  fallosConsecutivos: conf?.fallosConsecutivos,
  ultimaPasada: conf?.ultimaPasada,
  ultimoError: conf?.ultimoError,
  procesadosGuardados: conf?.procesados?.length,
}, null, 2));

const password = descifrar(conf.passwordCifrada);
const client = new ImapFlow({
  host: conf.host,
  port: Number(conf.puerto) || 993,
  secure: true,
  auth: { user: conf.usuario, pass: password },
  logger: false,
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 300000,
});
client.on("error", (e) => console.warn("[imap] (controlado):", e?.message));
await client.connect();
console.log("\nCONEXION OK a", conf.host + ":" + (conf.puerto || 993));

// Latencia de NOOP (comando trivial)
for (let i = 1; i <= 3; i++) {
  const t = Date.now();
  await client.noop();
  console.log(`NOOP ${i}: ${Date.now() - t}ms`);
}

// STATUS de la carpeta configurada
const carpeta = conf.carpeta || "INBOX";
const t1 = Date.now();
let st;
const lock = await client.getMailboxLock(carpeta);
try {
  st = client.mailbox;
  console.log(`\nSELECT ${carpeta} (${Date.now() - t1}ms):`);
  console.log("  exists (total):", st?.exists, "| uidNext:", st?.uidNext);

  // Cuántos SIN LEER (búsqueda barata)
  const t2 = Date.now();
  const noLeidos = await client.search({ seen: false }, { uid: true });
  console.log(`  SIN LEER: ${noLeidos.length} (${Date.now() - t2}ms)`);
  if (noLeidos.length > 0) {
    console.log("  uids sin leer (primeros 20):", noLeidos.slice(0, 20).join(", "));
  }

  // ¿Y en Todas/[Gmail]/All Mail? (por si la carpeta configurada no es INBOX)
  try {
    const todas = await client.status("[Gmail]/All Mail", { messages: 0, unseen: 0 });
    console.log("\n[Gmail]/All Mail → total:", todas?.messages, "| sin leer:", todas?.unseen);
  } catch (e) { console.log("\n(All Mail no accesible:", e.message, ")"); }
} finally {
  lock.release();
}
await client.logout();
await mongoose.disconnect();
process.exit(0);
