import mongoose from "mongoose";
import fs from "node:fs";
import { formatoToHtml } from "./src/services/formatoToHtml.js";
import { datosParaPdf } from "./src/services/documentoPdfData.js";
import { alsEmpresa, conexionTenant } from "./src/models/tenant.js";
import "./src/models/OrdenTrabajo.js";
import "./src/models/Cliente.js";
import "./src/models/Vehiculo.js";
import "./src/models/Aseguradora.js";
import "./src/models/Empresa.js";
import { chromium } from "playwright";

// Conexión plataforma + contexto de empresa (como hace middlewareEmpresa)
await mongoose.connect("mongodb://localhost:27017/filanex_plataforma");
const contexto = { conn: conexionTenant("filanex_montiel"), slug: "montiel", dbName: "filanex_montiel" };

const out = await alsEmpresa.run(contexto, async () => {
  const conn = mongoose.connection.useDb("filanex_montiel");
  const ot = await conn.db.collection("ordentrabajos").findOne({ numero: "OT-000058" });
  const f1 = await conn.db.collection("formatos").findOne({ tipoDocumento: "parte-taller", nombre: "Parte de trabajo (taller)" });
  const f2 = await conn.db.collection("formatos").findOne({ tipoDocumento: "parte-taller", nombre: "Trabajos a realizar" });
  // Datos reales del servidor (misma función que el endpoint de PDF)
  const { formData, logoUrl } = await datosParaPdf("parte-taller", ot._id.toString());
  return { ot, f1, f2, formData, logoUrl };
});

const { f1, f2, formData, logoUrl } = out;
const src = fs.readFileSync("./src/services/pdfRenderer.js", "utf8");
const script = src.match(/<script>([\s\S]*?)<\/script>/)[1];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });

for (const [plantilla, fichero] of [[f1, "/tmp/doc1-parte.png"], [f2, "/tmp/doc2-trabajos.png"]]) {
  const { html, css } = formatoToHtml(plantilla, formData, {}, { logoUrl });
  const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; color: #111; background: #fff; }
    ${css}
  </style></head><body>${html}<script>${script}</script></body></html>`;
  await page.setContent(fullHtml, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const u = document.querySelector("u");
    return {
      subrayado: u ? u.textContent : null,
      completo: document.body.textContent.includes("PINTAR ALERON EN NEGRO"),
    };
  });
  console.log(plantilla.nombre, "→", JSON.stringify(r));
  await page.screenshot({ path: fichero, fullPage: true });
}
await browser.close();
await mongoose.disconnect();
console.log("capturas guardadas");
