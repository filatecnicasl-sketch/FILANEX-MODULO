import mongoose from "mongoose";
import fs from "node:fs";
import { formatoToHtml } from "./src/services/formatoToHtml.js";
import { chromium } from "playwright";

const conn = await mongoose.createConnection("mongodb://localhost:27017/filanex_montiel").asPromise();
const plantilla = await conn.db.collection("formatos").findOne({ tipoDocumento: "parte-taller", porDefecto: true });
const ot = await conn.db.collection("ordentrabajos").findOne({ numero: "OT-000058" });
await conn.close();

const formData = {
  "trabajos.motivo": ot.motivo,
  "documento.numero": ot.numero,
  "cliente.nombre": ot.clienteNombre ?? "",
  "vehiculo.matricula": ot.matricula ?? "",
};
const { html, css } = formatoToHtml(plantilla, formData, {}, {});
const src = fs.readFileSync("./src/services/pdfRenderer.js", "utf8");
const script = src.match(/<script>([\s\S]*?)<\/script>/)[1];

const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; color: #111; background: #fff; }
  ${css}
</style></head><body>${html}<script>${script}</script></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(fullHtml, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/parte-ot58.png", fullPage: true });
await browser.close();
console.log("captura guardada");
