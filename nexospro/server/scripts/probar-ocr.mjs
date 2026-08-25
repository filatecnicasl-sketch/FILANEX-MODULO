import "dotenv/config";
import { chromium } from "playwright";
import sharp from "sharp";
import { extraerTicket, extraerDocumentoCompra } from "../src/services/ocr-gemini.js";

// Banco de pruebas del OCR: genera documentos de dificultad creciente y
// comprueba que se leen bien y en cuánto tiempo.
// Uso: node scripts/probar-ocr.mjs
//
// Sirve para validar cambios en el OCR y para detectar cuándo Google retira
// un modelo (los fallos de la IA son silenciosos: se queda colgada).

const navegador = await chromium.launch();

async function aPdf(html, formato = "A5") {
  const p = await navegador.newPage();
  await p.setContent(html);
  const b = await p.pdf({ format: formato, printBackground: true });
  await p.close();
  return b;
}

async function aImagen(html, ancho, opciones = {}) {
  const p = await navegador.newPage({ viewport: { width: ancho, height: 900 } });
  await p.setContent(html);
  let b = await p.screenshot({ fullPage: true });
  await p.close();
  let img = sharp(b);
  if (opciones.rotar) img = img.rotate(opciones.rotar);
  if (opciones.gris) img = img.grayscale().modulate({ brightness: opciones.brillo ?? 1 });
  if (opciones.borroso) img = img.blur(opciones.borroso);
  return img.jpeg({ quality: opciones.calidad ?? 90 }).toBuffer();
}

// Ojo: los CIF de estos documentos son válidos (letra de control correcta) y
// los importes cuadran. Si no, el OCR los rechazaría con razón y las pruebas
// medirían mal.
const TICKET = `<body style="font-family:monospace;width:300px;padding:20px">
<h3 style="text-align:center">TALLERES EL PINAR SL</h3>
<p style="text-align:center">CIF: B12345674<br>Avda. de la Constitucion 45<br>28901 Getafe (Madrid)</p><hr>
<p>FECHA: 24/08/2026 &nbsp; HORA: 11:42</p><p>TICKET: 004587</p><hr>
<p>2 x FILTRO DE ACEITE ..... 24,00<br>1 x ACEITE 5W30 5L ....... 41,50<br>1 x MANO DE OBRA ......... 35,00</p><hr>
<p>BASE IMPONIBLE ......... 83,06<br>IVA 21% ................ 17,44<br><b>TOTAL ............... 100,50 EUR</b></p></body>`;

// Ticket de restaurante con IVA al 10 % y sin desglose de base.
const TICKET_BAR = `<body style="font-family:monospace;width:280px;padding:16px">
<p style="text-align:center"><b>BAR LA PARADA</b><br>NIF: 12345678Z<br>C/ Mayor 3 - 28901 GETAFE</p><hr>
<p>02/08/2026 14:35 &nbsp; MESA 7</p><hr>
<p>2 MENU DEL DIA ....... 25,00<br>1 CAFE ................ 1,40<br>1 AGUA 50CL .......... 1,60</p><hr>
<p>IVA INCLUIDO 10%<br><b>TOTAL: 28,00 EUR</b></p><p>TARJETA</p></body>`;

const FACTURA = `<body style="font-family:Arial;padding:28px;font-size:12px">
<table style="width:100%"><tr><td><b style="font-size:17px">SUMINISTROS ENEA DIGITAL SL</b><br>
CIF B87654323<br>Pol. Ind. Las Monjas, nave 12<br>28850 Torrejon de Ardoz (Madrid)</td>
<td style="text-align:right">FACTURA<br><b>N.o 2026/A-1187</b><br>Fecha: 18/08/2026<br>Vencimiento: 17/09/2026</td></tr></table>
<p><b>CLIENTE:</b> FILA TECNICA SL &nbsp; CIF: B75418350</p>
<table border="1" cellspacing="0" cellpadding="5" style="width:100%;border-collapse:collapse">
<tr style="background:#eee"><th>Ref.</th><th>Descripcion</th><th>Cant.</th><th>Precio</th><th>Dto.</th><th>Importe</th></tr>
<tr><td>RT-450</td><td>Router industrial 4G</td><td>3</td><td>145,00</td><td>10%</td><td>391,50</td></tr>
<tr><td>CB-12</td><td>Cable RJ45 cat.6 (25 m)</td><td>10</td><td>12,30</td><td>0%</td><td>123,00</td></tr>
<tr><td>SW-8P</td><td>Switch gestionable 8 puertos</td><td>2</td><td>210,00</td><td>5%</td><td>399,00</td></tr>
</table>
<table style="width:100%;margin-top:14px"><tr><td></td><td style="text-align:right">
Base imponible: 913,50 EUR<br>IVA 21%: 191,84 EUR<br><b>TOTAL FACTURA: 1.105,34 EUR</b></td></tr></table>
<p style="font-size:11px">Forma de pago: transferencia. IBAN ES91 2100 0418 4502 0005 1332</p></body>`;

const CASOS = [
  { nombre: "Ticket taller (PDF limpio)", tipo: "ticket", buffer: () => aPdf(TICKET), esperado: { total: 100.5, tipoIva: 21, nifComercio: "B12345674" } },
  { nombre: "Ticket bar 10% IVA incluido", tipo: "ticket", buffer: () => aPdf(TICKET_BAR, "A6"), esperado: { total: 28, tipoIva: 10 } },
  { nombre: "Ticket foto girada 90°", tipo: "ticket", buffer: () => aImagen(TICKET, 340, { rotar: 90 }), esperado: { total: 100.5 } },
  { nombre: "Ticket termico descolorido", tipo: "ticket", buffer: () => aImagen(TICKET, 340, { gris: true, brillo: 1.45, borroso: 1.1, calidad: 55 }), esperado: { total: 100.5 } },
  { nombre: "Factura compra con descuentos", tipo: "compra", buffer: () => aPdf(FACTURA, "A4"), esperado: { total: 1105.34, lineas: 3 } },
  { nombre: "Factura compra foto torcida", tipo: "compra", buffer: () => aImagen(FACTURA, 780, { rotar: 4, calidad: 70 }), esperado: { total: 1105.34, lineas: 3 } },
];

let aciertos = 0;
const tiempos = [];

for (const caso of CASOS) {
  const buffer = await caso.buffer();
  const mimetype = buffer.slice(0, 4).toString() === "%PDF" ? "application/pdf" : "image/jpeg";
  const t0 = Date.now();
  try {
    const r = caso.tipo === "ticket"
      ? await extraerTicket({ buffer, mimetype })
      : await extraerDocumentoCompra({ buffer, mimetype });
    const ms = Date.now() - t0;
    tiempos.push(ms);

    const fallos = [];
    const e = caso.esperado;
    if (e.total !== undefined && Math.abs(Number(r.total ?? 0) - e.total) > 0.02) fallos.push(`total ${r.total} ≠ ${e.total}`);
    if (e.tipoIva !== undefined && Number(r.tipoIva) !== e.tipoIva) fallos.push(`IVA ${r.tipoIva} ≠ ${e.tipoIva}`);
    if (e.nifComercio && String(r.nifComercio ?? "").toUpperCase() !== e.nifComercio) fallos.push(`NIF ${r.nifComercio} ≠ ${e.nifComercio}`);
    if (e.lineas !== undefined && (r.lineas?.length ?? 0) !== e.lineas) fallos.push(`${r.lineas?.length ?? 0} líneas ≠ ${e.lineas}`);

    const nivel = r._ocr?.nivel ?? "?";
    const kb = Math.round(buffer.length / 1024);
    if (fallos.length === 0) {
      aciertos++;
      console.log(`OK   ${caso.nombre} — ${ms} ms (${nivel}, ${kb} KB)`);
    } else {
      console.log(`FALLA ${caso.nombre} — ${ms} ms (${nivel}, ${kb} KB): ${fallos.join(", ")}`);
    }
    if (r._ocr?.avisos?.length) console.log(`      avisos: ${r._ocr.avisos.join("; ")}`);
  } catch (err) {
    console.log(`ERROR ${caso.nombre} — ${Date.now() - t0} ms: ${err.message}`);
  }
}

await navegador.close();
const media = tiempos.length ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;
console.log(`\nResultado: ${aciertos}/${CASOS.length} correctos. Tiempo medio ${media} ms.`);
process.exit(aciertos === CASOS.length ? 0 : 1);
