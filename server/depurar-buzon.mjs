// Conecta al buzón y lista carpetas para depurar
import mongoose from "mongoose";
import { conexionImap } from "./src/services/energia-correo.js";
import { descifrar } from "./src/services/cifrado.js";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;
const empresa = await db.collection("empresas").findOne();
const conf = empresa?.correoEntrante;
console.log("conf:", JSON.stringify({ ...conf, passwordCifrada: "***" }, null, 2));

const client = conexionImap(conf, descifrar(conf.passwordCifrada));
await client.connect();
console.log("conectado");

try {
  const lock = await client.getMailboxLock("INBOX");
  console.log("INBOX ok");
  lock.release();
} catch (e) {
  console.log("INBOX error:", e.message);
}

await client.logout();
await mongoose.disconnect();
