import mongoose from "mongoose";
import fs from "node:fs";
import { formatoToHtml } from "./src/services/formatoToHtml.js";
import { chromium } from "playwright";

// 1) Plantilla real (ya actualizada) y motivo real de la OT-000058
const conn = await mongoose.createConnection("mongodb://localhost:27017/filanex_montiel").asPromise();
const plantilla = await conn.db.collection("formatos").findOne({ tipoDocumento: "parte-taller", porDefecto: true });
const ot = await conn.db.collection("ordentrabajos").findOne({ numero: "OT-000058" });
await conn.close();
if (!plantilla || !ot) throw new Error("Falta plantilla u OT");

// 2) HTML igual que lo genera el servidor para el PDF
const formData = { "trabajos.motivo": ot.motivo };
const { html, css } = formatoToHtml(plantilla, formData, {}, {});

// 3) El <script> de auto-ajuste se extrae del propio pdfRenderer desplegado,
//    para probar exactamente el código que se ejecuta en producción.
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

async function medir(htmlPrueba, etiqueta, marca = "REPARAR PARAGOLPES", ultimaLinea = "PINTAR ALERON EN NEGRO") {
  await page.setContent(htmlPrueba, { waitUntil: "networkidle" });
  // Espera a que el script de auto-ajuste termine
  await page.waitForTimeout(300);
  const r = await page.evaluate(
    ({ marca, ultimaLinea }) => {
      const nodos = [...document.querySelectorAll("[data-fit]")];
      const n = nodos.find((x) => x.textContent.includes(marca));
      if (!n) return { error: "nodo no encontrado" };
      return {
        cabe: n.scrollHeight <= n.clientHeight + 1,
        scrollHeight: n.scrollHeight,
        clientHeight: n.clientHeight,
        fontSize: n.style.fontSize || getComputedStyle(n).fontSize,
        overflow: n.style.overflow || getComputedStyle(n).overflow,
        textoCompleto: n.textContent.includes(ultimaLinea),
      };
    },
    { marca, ultimaLinea }
  );
  console.log(etiqueta, JSON.stringify(r, null, 2));
  return r;
}

// Caso real: motivo de 8 líneas de la OT-000058
const real = await medir(fullHtml, "OT-000058 (8 líneas reales):");

// Caso extremo: 16 líneas, para probar el crecimiento de la caja
const largo = Array.from({ length: 16 }, (_, i) => `TRABAJO NUMERO ${i + 1} DE PRUEBA LARGA`).join("\n");
const { html: html2 } = formatoToHtml(plantilla, { "trabajos.motivo": largo }, {}, {});
const full2 = fullHtml.replace(html, html2);
const extremo = await medir(full2, "Extremo (16 líneas):", "TRABAJO NUMERO 1 ", "TRABAJO NUMERO 16");

await browser.close();

const ok = real.cabe && real.textoCompleto && extremo.textoCompleto;
console.log(ok ? "\nRESULTADO: OK — el motivo se imprime completo" : "\nRESULTADO: FALLO");
process.exit(ok ? 0 : 1);
