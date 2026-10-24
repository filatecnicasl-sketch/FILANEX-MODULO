// Comprueba la config de correo de filanex_local y busca facturas de use.ai
// (o cualquier correo de ellos) en el buzón IMAP configurado.
import mongoose from "mongoose";
import { ImapFlow } from "imapflow";
import { descifrar } from "/opt/filanex/server/src/services/cifrado.js";

await mongoose.connect("mongodb://127.0.0.1:27017/filanex_local");
const empresa = await mongoose.connection.db.collection("empresas").findOne({});
await mongoose.disconnect();

const conf = empresa?.correoEntrante;
console.log("correo configurado:", conf ? `${conf.usuario} @ ${conf.host} (activo=${conf.activo})` : "NO CONFIGURADO");
if (!conf?.usuario || !conf?.passwordCifrada) {
  console.log("Sin credenciales: no puedo leer el correo.");
  process.exit(0);
}

const client = new ImapFlow({
  host: conf.host || "imap.gmail.com",
  port: 993,
  secure: true,
  auth: { user: conf.usuario, pass: descifrar(conf.passwordCifrada) },
  logger: false,
});
await client.connect();
console.log("conectado al buzón");

// Buscar en TODAS las carpetas correos de use.ai.
for await (const carpeta of client.list()) {
  if (carpeta.flags?.includes("\\Trash")) continue;
  const lock = await client.getMailboxLock(carpeta.path);
  try {
    if (!client.mailbox?.exists) continue;
    const resultados = await client.search({ header: { from: "use.ai" } }, { uid: true });
    const resultadosAsunto = await client.search({ header: { subject: "use.ai" } }, { uid: true });
    const uids = [...new Set([...(resultados ?? []), ...(resultadosAsunto ?? [])])];
    if (!uids.length) continue;
    console.log(`\n=== ${carpeta.path}: ${uids.length} correos de use.ai ===`);
    for (const uid of uids.slice(-20)) {
      const msg = await client.fetchOne(uid, { envelope: true, bodyStructure: true });
      const env = msg.envelope;
      console.log(`- ${env.date?.toISOString().slice(0, 16) ?? "?"} | de: ${env.from?.[0]?.address ?? "?"} | asunto: ${env.subject ?? "(sin asunto)"}`);
      if (msg.bodyStructure?.childNodes) {
        const adjuntos = [];
        const recorrer = (nodo) => {
          if (nodo.disposition === "attachment" || nodo.dispositionParameters?.filename) {
            adjuntos.push(nodo.dispositionParameters?.filename ?? nodo.parameters?.name ?? "(adjunto)");
          }
          (nodo.childNodes ?? []).forEach(recorrer);
        };
        msg.bodyStructure.childNodes.forEach(recorrer);
        if (adjuntos.length) console.log(`  adjuntos: ${adjuntos.join(", ")}`);
      }
    }
  } finally {
    lock.release();
  }
}
await client.logout();
console.log("\nFIN");
