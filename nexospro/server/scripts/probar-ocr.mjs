import "dotenv/config";
import { chromium } from "playwright";
import { generarJsonGemini, MODELOS_CALIDAD, MODELOS_RAPIDOS } from "../src/services/gemini.js";
import { extraerTicket } from "../src/services/ocr-gemini.js";

// Comprobación de que el OCR de tickets responde de verdad (Google retira
// modelos sin avisar y el fallo es silencioso: la petición se queda colgada).
// Genera un ticket de prueba en PDF y lo pasa por el mismo servicio que usa
// la aplicación. Uso: node scripts/probar-ocr.mjs

const HTML = `<html><body style="font-family:monospace;width:300px;padding:20px">
<h3 style="text-align:center">TALLERES EL PINAR SL</h3>
<p style="text-align:center">CIF: B12345678<br>Avda. de la Constitucion 45<br>28901 Getafe (Madrid)</p>
<hr>
<p>FECHA: 24/08/2026&nbsp;&nbsp;HORA: 11:42</p>
<p>TICKET: 004587</p>
<hr>
<p>2 x FILTRO DE ACEITE ..... 24,00<br>
1 x ACEITE 5W30 5L ....... 41,50<br>
1 x MANO DE OBRA ......... 35,00</p>
<hr>
<p>BASE IMPONIBLE ......... 82,64<br>
IVA 21% ................ 17,36<br>
<b>TOTAL ............... 100,50 EUR</b></p>
<p style="text-align:center">Gracias por su visita</p>
</body></html>`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.setContent(HTML);
const buffer = await pagina.pdf({ format: "A5", printBackground: true });
await navegador.close();

const t0 = Date.now();
try {
  const datos = await extraerTicket({ mimetype: "application/pdf", buffer });
  console.log(`OCR OK en ${Date.now() - t0} ms:`);
  console.log(JSON.stringify(datos, null, 2));
} catch (e) {
  console.log(`OCR FALLÓ en ${Date.now() - t0} ms: ${e.message}`);
}

// Comparativa de perfiles sobre el mismo documento, para decidir si compensa
// la espera del modelo de calidad frente al rápido.
const ESQUEMA = {
  type: "object",
  properties: {
    comercio: { type: "string" },
    nifComercio: { type: "string" },
    fecha: { type: "string" },
    base: { type: "number" },
    tipoIva: { type: "number" },
    cuotaIva: { type: "number" },
    total: { type: "number" },
    concepto: { type: "string" },
    categoria: { type: "string" },
  },
};
const PROMPT = "Extrae los datos del ticket de gasto: comercio, NIF, fecha (AAAA-MM-DD), base imponible, tipo de IVA, cuota de IVA, total, concepto y categoría.";

for (const [nombre, modelos] of [["CALIDAD", MODELOS_CALIDAD], ["RAPIDOS", MODELOS_RAPIDOS]]) {
  const t = Date.now();
  try {
    const r = await generarJsonGemini({
      contents: [
        { inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } },
        { text: PROMPT },
      ],
      esquema: ESQUEMA,
      modelos,
      timeoutMs: 90000,
    });
    console.log(
      `${nombre} (${modelos[0]}): ${Date.now() - t} ms → total ${r.total}, base ${r.base}, IVA ${r.tipoIva}/${r.cuotaIva}, fecha ${r.fecha}, NIF ${r.nifComercio}, comercio ${r.comercio}`
    );
  } catch (e) {
    console.log(`${nombre}: FALLÓ ${Date.now() - t} ms → ${e.message}`);
  }
}

process.exit(0);
