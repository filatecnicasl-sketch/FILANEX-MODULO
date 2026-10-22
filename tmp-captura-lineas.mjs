import mongoose from "mongoose";
import fs from "node:fs";
import { formatoToHtml } from "./src/services/formatoToHtml.js";
import { compactarRenglones } from "./src/services/documentoPdfData.js";
import { chromium } from "playwright";

const conn = await mongoose.createConnection("mongodb://localhost:27017/filanex_montiel").asPromise();
const plantilla = await conn.db.collection("formatos").findOne({ tipoDocumento: "parte-taller", porDefecto: true });
const ot = await conn.db.collection("ordentrabajos").findOne({ numero: "OT-000058" });
await conn.close();

// Exactamente lo que hace produccion: datosParaPdf compacta el motivo
const formData = {
  "trabajos.motivo": compactarRenglones(ot.motivo),
  "documento.numero": ot.numero,
  "cliente.nombre": ot.clienteNombre ?? "",
  "vehiculo.matricula": ot.matricula ?? "",
};
console.log("Motivo compactado:\n" + formData["trabajos.motivo"] + "\n");

const { html, css } = formatoToHtml(plantilla, formData, {}, {});
const src = fs.readFileSync("./src/services/pdfRenderer.js", "utf8");
const script = src.match(/<script>([\s\S]*?)<\/script>/)[1];

const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; color: #111; background: #fff; }
  ${css}
</style></head><body>${html}<script>${script}</script></body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(fullHtml, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const r = await page.evaluate(() => {
  const n = [...document.querySelectorAll("[data-fit]")].find((x) => x.textContent.includes("REPARAR PARAGOLPES"));
  return {
    cabeSinEncoger: n.style.fontSize === "" || n.style.fontSize === "12pt",
    fontSize: n.style.fontSize || "12pt (sin encoger)",
    lineasVisuales: Math.round(n.scrollHeight / (n.scrollHeight / n.getClientRects().length || 1)),
    textoCompleto: n.textContent.includes("PINTAR ALERON EN NEGRO"),
  };
});
console.log("Render:", JSON.stringify(r, null, 2));
await page.screenshot({ path: "/tmp/parte-ot58-lineas.png", fullPage: true });
await browser.close();
console.log("captura guardada");
