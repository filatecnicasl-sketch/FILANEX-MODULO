import mongoose from "mongoose";
import fs from "node:fs";
import { formatoToHtml } from "./src/services/formatoToHtml.js";
import { chromium } from "playwright";

// ---- Datos reales de la OT-000058 ----
const conn = await mongoose.createConnection("mongodb://localhost:27017/filanex_montiel").asPromise();
const ot = await conn.db.collection("ordentrabajos").findOne({ numero: "OT-000058" });
const empresa = await conn.db.collection("empresas").findOne({});
await conn.close();

let logoUrl = empresa?.logoUrl ?? "";
if (logoUrl.startsWith("/")) logoUrl = "http://localhost:4700" + logoUrl;

const fechaEs = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "");

const formData = {
  "documento.numero": ot.numero,
  "vehiculo.entrada": fechaEs(ot.fechaEntrada),
  "cliente.nombre": ot.cliente?.nombre ?? ot.clienteNombre ?? "",
  "cliente.nif": ot.cliente?.nif ?? "",
  "cliente.telefono": ot.cliente?.telefono ?? ot.telefono ?? "",
  "vehiculo.matricula": ot.matricula ?? "",
  "vehiculo.marca": ot.vehiculo?.marca ?? "",
  "vehiculo.modelo": ot.vehiculo?.modelo ?? "",
  "vehiculo.km": ot.km != null ? Number(ot.km).toLocaleString("es-ES") : "",
  // Lista vertical: el motivo original, un trabajo por renglón
  "trabajos.motivoLista": ot.motivo ?? "",
};

// ---- Documento 2: TRABAJOS A REALIZAR ----
let n = 0;
const id = () => `el${++n}`;
const tx = (text, x, y, w, h, fontSize = 8, bold = false, align = "left", color = "#000000") => ({
  id: id(), type: "text", x, y, w, h, text, fontSize, bold, align, color,
});
const box = (x, y, w, h, color = "#e5e7eb") => ({
  id: id(), type: "rect", x, y: y + h, w, h: 0.3, borderWidth: 0, borderColor: "", background: color,
});

const plantilla = {
  id: "doc2",
  tipoDocumento: "parte-taller",
  nombre: "Trabajos a realizar",
  page: { size: "A4", orientation: "portrait" },
  elements: [
    { id: id(), type: "image", x: 20, y: 14, w: 40, h: 18, src: "{{empresa.logo}}" },
    tx("TRABAJOS A REALIZAR", 100, 16, 90, 10, 16, true, "right", "#111827"),
    tx("{{documento.numero}}", 100, 27, 90, 6, 11, false, "right", "#4b5563"),
    tx("Fecha entrada: {{vehiculo.entrada}}", 100, 34, 90, 5, 9, false, "right", "#6b7280"),

    box(20, 38, 80, 26),
    tx("CLIENTE", 23, 41, 74, 5, 7, true, "left", "#6b7280"),
    tx("{{cliente.nombre}}", 23, 47, 74, 6, 10, true),
    tx("{{cliente.nif}}", 23, 54, 74, 5, 8, false, "left", "#374151"),
    tx("{{cliente.telefono}}", 23, 59, 74, 5, 8, false, "left", "#374151"),

    // Vehículo SIN datos del seguro
    box(110, 38, 80, 26),
    tx("VEHÍCULO", 113, 41, 74, 5, 7, true, "left", "#6b7280"),
    tx("{{vehiculo.matricula}}", 113, 47, 74, 6, 10, true),
    tx("{{vehiculo.marca}} {{vehiculo.modelo}}", 113, 54, 74, 5, 8, false, "left", "#374151"),
    tx("{{vehiculo.km}} km", 113, 59, 74, 5, 8, false, "left", "#374151"),

    // Lista de trabajos: un renglón por trabajo, letra grande, toda la página
    tx("Trabajos a realizar", 20, 74, 170, 5, 8, true, "left", "#6b7280"),
    box(20, 80, 170, 200),
    tx("{{trabajos.motivoLista}}", 23, 84, 164, 192, 12, true, "left", "#111827"),
  ],
};

const { html, css } = formatoToHtml(plantilla, formData, {}, { logoUrl });
const src = fs.readFileSync("./src/services/pdfRenderer.js", "utf8");
const script = src.match(/<script>([\s\S]*?)<\/script>/)[1];

const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; color: #111; background: #fff; }
  ${css}
</style></head><body>${html}<script>${script}</script></body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await page.setContent(fullHtml, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/doc2-trabajos.png", fullPage: true });
await browser.close();
console.log("captura guardada");
