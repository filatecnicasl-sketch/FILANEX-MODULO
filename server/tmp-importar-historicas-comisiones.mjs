import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import Empresa from "./src/models/Empresa.js";
import Cliente from "./src/models/Cliente.js";
import FacturaVenta from "./src/models/FacturaVenta.js";
import { guardarArchivo, urlPublica, existeArchivo } from "./src/services/storage.js";

const staging = "/tmp/filanex-import-historicas-comisiones-20261024";
const rows = JSON.parse(fs.readFileSync(path.join(staging, "manifest.json"), "utf8"));
const aplicar = process.argv.includes("--apply");
const redondea = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const normalizaNif = (s) => String(s ?? "").toUpperCase().replace(/[\s.-]/g, "");
const normNumero = (s) => String(s ?? "").toUpperCase().replace(/[\s./_-]/g, "").replace(/O/g, "0").replace(/I/g, "1");

await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
try {
  const empresa = await Empresa.findOne();
  if (!empresa) throw new Error("No hay empresa configurada en filanex_local");
  const plan = [];
  for (const row of rows) {
    const pdfPath = path.join(staging, row.file);
    const pdf = fs.readFileSync(pdfPath);
    const sha256 = crypto.createHash("sha256").update(pdf).digest("hex");
    if (pdf.subarray(0, 5).toString() !== "%PDF-" || sha256 !== row.sha256) {
      throw new Error(`PDF ausente, inválido o alterado: ${row.file}`);
    }
    const sum = redondea(row.base + row.vat);
    if (sum !== redondea(row.total) || redondea(row.base * 0.21) !== redondea(row.vat)) {
      throw new Error(`Importes no cuadran: ${row.number}`);
    }
    let cliente = await Cliente.findOne({ nif: { $in: [row.nif, normalizaNif(row.nif)] } });
    const duplicadas = await FacturaVenta.find({}).select("_id serieNumero cliente fechaExpedicion baseImponible cuotaIva total estado verifactu.estadoEnvio documentoOriginal").lean();
    const byNum = duplicadas.filter((f) => normNumero(f.serieNumero) === normNumero(row.number));
    if (byNum.length > 1) throw new Error(`Hay más de una factura con número equivalente a ${row.number}`);
    const existente = byNum[0];
    if (existente) {
      if (existente.verifactu?.estadoEnvio !== "historica"
        || redondea(existente.baseImponible) !== redondea(row.base)
        || redondea(existente.cuotaIva) !== redondea(row.vat)
        || redondea(existente.total) !== redondea(row.total)) {
        throw new Error(`El número ${row.number} ya existe, pero no coincide con los datos de origen`);
      }
      if (cliente && String(existente.cliente) !== String(cliente._id)) {
        throw new Error(`El número ${row.number} existe ligado a otro cliente`);
      }
      plan.push({ number: row.number, action: existente.documentoOriginal ? "ya importada" : "completar PDF", client: row.client, total: row.total });
      continue;
    }
    plan.push({ number: row.number, action: "importar", client: cliente?.nombre ?? `crear ${row.client}`, total: row.total, sha256 });
  }
  console.log(JSON.stringify({ mode: aplicar ? "APPLY" : "DRY_RUN", count: rows.length, plan }, null, 2));
  if (!aplicar) process.exitCode = 0;
  else {
    for (const [index, row] of rows.entries()) {
      const existente = await FacturaVenta.findOne({ serieNumero: row.number });
      const cliente = await Cliente.findOne({ nif: { $in: [row.nif, normalizaNif(row.nif)] } })
        ?? await Cliente.create({ nombre: row.client, nif: normalizaNif(row.nif), notas: "Alta automática asociada a importación de facturas históricas de comisiones." });
      const remote = `uploads/local/documentos/historica-comisiones-${String(index + 1).padStart(2, "0")}.pdf`;
      if (existente) {
        if (!existente.documentoOriginal) {
          await guardarArchivo(remote, fs.readFileSync(path.join(staging, row.file)), "application/pdf");
          existente.documentoOriginal = urlPublica(remote);
          await existente.save();
        }
        continue;
      }
      await guardarArchivo(remote, fs.readFileSync(path.join(staging, row.file)), "application/pdf");
      const fecha = new Date(`${row.date}T12:00:00.000Z`);
      await FacturaVenta.create({
        empresa: empresa._id,
        serie: "HIST-2026",
        numero: index + 1,
        serieNumero: row.number,
        fechaExpedicion: fecha,
        cliente: cliente._id,
        descripcion: `Liquidación histórica de comisiones: ${row.client}`,
        lineas: [{ descripcion: row.description, cantidad: 1, precioUnitario: row.base, iva: 21 }],
        baseImponible: row.base,
        cuotaIva: row.vat,
        total: row.total,
        estado: "emitida",
        metodoPago: "Transferencia",
        cobros: [],
        documentoOriginal: urlPublica(remote),
        notaImportacion: row.note ?? "Importada como factura histórica desde el documento fuente; no se ha generado otro registro VeriFactu.",
        verifactu: { enviada: false, estadoEnvio: "historica" },
      });
    }
  }
  if (aplicar) {
    const verifica = [];
    for (const row of rows) {
      const factura = await FacturaVenta.findOne({ serieNumero: row.number }).lean();
      if (!factura) throw new Error(`No aparece tras la importación: ${row.number}`);
      if (factura.verifactu?.estadoEnvio !== "historica") throw new Error(`Estado inesperado: ${row.number}`);
      if (redondea(factura.baseImponible) !== redondea(row.base) || redondea(factura.cuotaIva) !== redondea(row.vat) || redondea(factura.total) !== redondea(row.total)) throw new Error(`Importes no coinciden en ${row.number}`);
      if ((factura.cobros ?? []).length !== 0) throw new Error(`Tiene cobros no autorizados: ${row.number}`);
      if (!factura.documentoOriginal || !(await existeArchivo(factura.documentoOriginal.slice(1)))) throw new Error(`Falta PDF guardado: ${row.number}`);
      const cliente = await Cliente.findById(factura.cliente).select("nombre nif").lean();
      verifica.push({ number: row.number, date: new Date(factura.fechaExpedicion).toISOString().slice(0, 10), base: factura.baseImponible, vat: factura.cuotaIva, total: factura.total, state: factura.estado, aeat: factura.verifactu.estadoEnvio, cobros: factura.cobros.length, pdf: true, client: cliente?.nombre });
    }
    console.log(JSON.stringify({ verified: verifica.length, results: verifica }, null, 2));
  }
} finally {
  await mongoose.disconnect();
}
