// Descarga las facturas que faltan y les hace OCR para generar un informe.
// VERSIÓN PACIENTE para buzones castigados por Gmail (15/10/2026):
// - Un SOLO mensaje por comando (fetchOne), nunca lotes.
// - socketTimeout de 10 minutos: si Gmail tarda en responder, se espera.
// - Pausa entre mensajes; si un mensaje falla, espera 2 min y reconecta.
// - Reanudable: cada PDF descargado queda en disco y en estado.json.
// - Aborta si el primer mensaje agota los reintentos (buzón aún bloqueado).
import "dotenv/config";
import mongoose from "mongoose";
import { ImapFlow } from "imapflow";
import { descifrar } from "./src/services/cifrado.js";
import { extraerDocumentoCompra } from "./src/services/ocr-gemini.js";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import path from "path";

const TMP = "/tmp/facturas-faltantes";
mkdirSync(TMP, { recursive: true });
const ESTADO = path.join(TMP, "estado.json");

let faltantes = [];
if (existsSync(ESTADO)) {
  try { faltantes = JSON.parse(readFileSync(ESTADO, "utf8")); } catch { /* reinicia */ }
}
const guardarEstado = () => writeFileSync(ESTADO, JSON.stringify(faltantes, null, 2));
const yaDescargadas = new Set(faltantes.map((f) => f.numero));

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;

const proveedores = await db.collection("proveedors").find({
  $or: [
    { nombre: { $regex: /emergent|novascent|moonshot|verdent|link/i } },
    { alias: { $regex: /emergent|novascent|moonshot|verdent|link/i } },
  ],
}).project({ nombre: 1 }).toArray();
const idsProv = proveedores.map((p) => p._id);
const facturas = await db.collection("facturacompras")
  .find({ proveedor: { $in: idsProv } })
  .project({ numeroFacturaProveedor: 1 })
  .toArray();
const numerosRegistrados = new Set(facturas.map((f) => f.numeroFacturaProveedor?.toUpperCase?.() ?? ""));
console.log(`Facturas ya registradas de esos proveedores: ${numerosRegistrados.size}`);

const empresa = await db.collection("empresas").findOne();
const conf = empresa?.correoEntrante;
if (!conf?.passwordCifrada) throw new Error("No hay contraseña");
const password = descifrar(conf.passwordCifrada);
const carpeta = conf.carpeta || "INBOX";

let client = null;
let lock = null;
const conectar = async () => {
  client = new ImapFlow({
    host: conf.host,
    port: Number(conf.puerto) || 993,
    secure: true,
    auth: { user: conf.usuario, pass: password },
    logger: false,
    connectionTimeout: 60000,
    greetingTimeout: 60000,
    socketTimeout: 600000, // 10 min: el buzón castigado responde MUY lento
  });
  client.on("error", (e) => console.warn("[imap] (controlado):", e?.message));
  await client.connect();
  lock = await client.getMailboxLock(carpeta);
};
const desconectar = async () => {
  try { lock?.release(); } catch { /* nada */ }
  try { await client?.logout(); } catch { /* nada */ }
  try { client?.close?.(); } catch { /* nada */ }
  lock = null; client = null;
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

await conectar();

// FASE 1: UIDs de correos de factura (búsquedas por remitente, nada más)
let uidsFacturas = [];
for (const criterio of [{ from: "invoice+statements" }, { from: "notifications@link.com" }]) {
  uidsFacturas = uidsFacturas.concat(await client.search(criterio, { uid: true }));
}
uidsFacturas = [...new Set(uidsFacturas)].sort((a, b) => a - b);
console.log(`Correos de factura en el buzón: ${uidsFacturas.length}`);
await desconectar();
await esperar(10000); // dejar respirar tras las búsquedas
await conectar(); // reconectar para la fase de mensajes

// FASE 2: mensaje a mensaje, con paciencia infinita
let procesados = 0;
let abortar = false;
for (const uid of uidsFacturas) {
  if (abortar) break;

  let msg = null;
  let logrado = false;
  for (let intento = 1; intento <= 5 && !logrado; intento++) {
    try {
      msg = await client.fetchOne(uid, { envelope: true, bodyStructure: true }, { uid: true });
      logrado = true;
    } catch (e) {
      console.warn(`uid ${uid} fallo (intento ${intento}): ${e?.message}`);
      if (intento < 5) {
        await desconectar();
        await esperar(120000); // 2 min: no reconectar en caliente
        await conectar();
      }
    }
  }
  if (!logrado) {
    if (procesados === 0 && faltantes.length === 0) {
      console.error("El primer mensaje agotó los reintentos: buzón aún bloqueado. ABORTO.");
      abortar = true;
      break;
    }
    console.error(`uid ${uid} se queda sin procesar; continúo con el siguiente.`);
    continue;
  }
  procesados++;

  const env = msg.envelope;
  const adjuntos = [];
  const recorrer = (nodo) => {
    if (nodo.disposition === "attachment" || nodo.dispositionParameters?.filename || nodo.parameters?.name) adjuntos.push(nodo);
    (nodo.childNodes ?? []).forEach(recorrer);
  };
  recorrer(msg.bodyStructure ?? {});
  const pdfs = adjuntos.filter((a) => /Invoice-.*\.pdf$/i.test(a.dispositionParameters?.filename ?? a.parameters?.name ?? ""));

  for (const pdf of pdfs) {
    const nombreArchivo = pdf.dispositionParameters?.filename ?? pdf.parameters?.name ?? `uid-${uid}.pdf`;
    const numeroFacturaPdf = nombreArchivo.match(/Invoice-([A-Z0-9]+-\d{4})/i)?.[1]?.toUpperCase() ?? null;
    if (!numeroFacturaPdf || numerosRegistrados.has(numeroFacturaPdf) || yaDescargadas.has(numeroFacturaPdf)) continue;

    let buf = null;
    for (let intento = 1; intento <= 5 && !buf; intento++) {
      try {
        const parte = pdf.part || String(adjuntos.indexOf(pdf) + 1);
        const descarga = await client.download(uid, parte, { uid: true });
        const chunks = [];
        for await (const chunk of descarga.content) chunks.push(chunk);
        buf = Buffer.concat(chunks);
      } catch (e) {
        console.warn(`descarga ${numeroFacturaPdf} fallo (intento ${intento}): ${e?.message}`);
        if (intento < 5) {
          await desconectar();
          await esperar(120000);
          await conectar();
        }
      }
    }
    if (!buf) { console.error(`No se pudo descargar ${numeroFacturaPdf}; sigo.`); continue; }

    const out = path.join(TMP, nombreArchivo);
    writeFileSync(out, buf);
    faltantes.push({ uid, fecha: env.date ? new Date(env.date).toISOString().slice(0, 10) : null, archivo: out, numero: numeroFacturaPdf });
    guardarEstado();
    console.log(`  descargada: ${numeroFacturaPdf} (${env.date?.toISOString?.()?.slice(0, 10) ?? "?"})`);
  }

  await esperar(3000); // aire entre mensajes
}
await desconectar();

console.log(`\nFacturas pendientes de dar de alta: ${faltantes.length}\n`);

// FASE 3: OCR de cada una para el informe (extraerDocumentoCompra espera
// un objeto tipo upload: { buffer, mimetype, originalname }).
for (const f of faltantes) {
  if (f.ocr && !f.ocr.error) continue;
  try {
    const datos = await extraerDocumentoCompra({
      buffer: readFileSync(f.archivo),
      mimetype: "application/pdf",
      originalname: path.basename(f.archivo),
    });
    f.ocr = { proveedor: datos.proveedor ?? null, total: datos.total ?? null, divisa: datos.divisa ?? null, confianza: datos.confianza ?? null };
    console.log(`- ${f.numero} | ${f.fecha} | ${f.ocr.proveedor} | ${f.ocr.total} ${f.ocr.divisa} | conf: ${f.ocr.confianza}`);
  } catch (e) {
    f.ocr = { error: e.message };
    console.log(`- ${f.numero} | ${f.fecha} | ERROR OCR: ${e.message}`);
  }
  guardarEstado();
}

await mongoose.disconnect();
console.log("\nFIN (PDFs en " + TMP + ")");
process.exit(0);
