/* Prueba E2E del OCR de estudios (Energía → Estudios → Leer factura IA):
   genera una factura de luz en PDF, la sube a /api/energia/estudios/ocr y
   comprueba que el prefill llega bien (CUPS, suministro enlazado, coste anual
   anualizado), que el estudio se puede guardar con ese prefill y que el
   ahorro sale positivo con una propuesta más barata. Al final borra el
   estudio y la cuenta temporal.
   Uso: node scripts/prueba-energia-estudio-ocr.mjs  (desde server/, API en 4700) */
import mongoose from "mongoose";
import "dotenv/config";

const EMAIL = "stress.test@filanex.local";
const PASSWORD = "StressTest123!";
const BASE = process.env.API_BASE || "http://localhost:4700";
const uriBase = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";

// --- Factura de luz de ejemplo en PDF (texto plano, Helvetica) ---
function pdfFactura(lineas) {
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  let texto = "BT\n/F1 11 Tf\n16 TL\n50 800 Td\n";
  for (const l of lineas) texto += `(${esc(l)}) Tj T*\n`;
  texto += "ET";
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(texto, "latin1")} >>\nstream\n${texto}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

const FACTURA = pdfFactura([
  "IBERDROLA CLIENTES, S.A. - Avda. de la Energia 1, 48003 Bilbao",
  "FACTURA DE ELECTRICIDAD      N. de factura: AG-2026-08-123456",
  "Titular: TALLERES VEGA SL",
  "NIF: B12345678Z",
  "Direccion del suministro: CALLE MAYOR 1, 46001 Valencia",
  "CUPS: ES0021000000000001AB",
  "Tarifa de acceso: 2.0TD",
  "Potencia contratada (punta): 15,00 kW",
  "Potencia contratada (valle): 15,00 kW",
  "Periodo de facturacion: del 01/08/2026 al 31/08/2026 (31 dias)",
  "Consumo del periodo: 500 kWh",
  "Consumo anual estimado: 6000 kWh",
  "Importe energia: 60,00 EUR",
  "Importe potencia: 25,50 EUR",
  "Impuestos electricos e IVA: 10,00 EUR",
  "IMPORTE TOTAL: 95,50 EUR",
]);

await mongoose.connect(`${uriBase}/filanex_plataforma`);
const Tenant = (await import("../src/models/plataforma/Tenant.js")).default;
const Cuenta = (await import("../src/models/plataforma/Cuenta.js")).default;
const { hashContrasena } = await import("../src/routes/usuarios.js");
const tenant = await Tenant.findOne({ slug: "demototal" });
await Cuenta.deleteOne({ email: EMAIL });
await Cuenta.create({
  nombre: "Prueba OCR estudios",
  email: EMAIL,
  passwordHash: hashContrasena(PASSWORD),
  rol: "admin",
  tenant: tenant._id,
});
await mongoose.disconnect();

let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK " : "FALLO"} - ${msg}`);
  if (!cond) fallos++;
};
const entre = (n, a, b) => Number(n ?? NaN) >= a && Number(n ?? NaN) <= b;

let idEstudio = null;
try {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  const H = { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` };

  // Sin fichero → 400.
  const sinFichero = await fetch(`${BASE}/api/energia/estudios/ocr`, {
    method: "POST",
    headers: { Authorization: `Bearer ${login.token}` },
  });
  ok(sinFichero.status === 400, "sin fichero responde 400");

  // OCR de la factura de ejemplo.
  const fd = new FormData();
  fd.append("documento", new Blob([FACTURA], { type: "application/pdf" }), "factura.pdf");
  const rOcr = await fetch(`${BASE}/api/energia/estudios/ocr`, {
    method: "POST",
    headers: { Authorization: `Bearer ${login.token}` },
    body: fd,
  });
  const ocr = await rOcr.json();
  ok(rOcr.status === 200, `el endpoint responde 200 (${rOcr.status})`);
  const p = ocr.prefill ?? {};
  ok(p.cups === "ES0021000000000001AB", `CUPS leído y normalizado (${p.cups})`);
  ok(!!p.suministro, `suministro de la cartera enlazado (${p.suministro})`);
  ok(p.tipo === "luz", `tipo deducido (${p.tipo})`);
  ok(!!p.cliente, "cliente vinculado (el del suministro)");
  ok(String(p.comercializadoraActual ?? "").toLowerCase().includes("ib"), `comercializadora actual (${p.comercializadoraActual})`);
  ok(String(p.tarifaActual ?? "").includes("2.0"), `tarifa leída (${p.tarifaActual})`);
  ok(entre(p.consumoAnual, 5500, 6500), `consumo anual (${p.consumoAnual} ≈ 6000)`);
  ok(entre(p.potenciaPunta, 10, 20), `potencia punta (${p.potenciaPunta} ≈ 15)`);
  ok(entre(p.costeAnualActual, 1000, 1250), `coste anual anualizado (${p.costeAnualActual} ≈ 95,50 × 365/31 = 1124)`);
  ok(Array.isArray(ocr.avisos), "devuelve la lista de avisos");

  // Guardar el estudio con el prefill + una propuesta más barata.
  const coms = await fetch(`${BASE}/api/energia/comercializadoras`, { headers: H }).then((r) => r.json());
  ok(Array.isArray(coms) && coms.length > 0, "hay comercializadoras para la propuesta");
  const rGuardar = await fetch(`${BASE}/api/energia/estudios`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      suministro: p.suministro,
      tipo: p.tipo,
      cliente: p.cliente,
      comercializadoraActual: p.comercializadoraActual,
      tarifaActual: p.tarifaActual,
      consumoAnual: p.consumoAnual,
      potenciaPunta: p.potenciaPunta,
      potenciaValle: p.potenciaValle,
      costeAnualActual: p.costeAnualActual,
      comercializadora: coms[0]._id,
      tarifaPropuesta: "2.0TD",
      precioEnergiaPropuesta: 0.12,
    }),
  });
  const estudio = await rGuardar.json();
  ok(rGuardar.status === 201, `estudio guardado con el prefill (${rGuardar.status})`);
  idEstudio = estudio._id ?? null;
  ok(entre(estudio.costeAnualActual, 1000, 1250), `coste actual persistido (${estudio.costeAnualActual})`);
  ok(estudio.ahorroAnual > 0, `ahorro positivo con la propuesta (${estudio.ahorroAnual} €/año)`);

  // El coste manual (el de la factura) se respeta: no lo pisa el cálculo.
  ok(estudio.costeAnualActual === p.costeAnualActual, "el coste anual de la factura no se recalcula");
} finally {
  if (idEstudio) {
    const r = await fetch(`${BASE}/api/energia/estudios/${idEstudio}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${(await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })).json()).token}` },
    });
    console.log(r.ok ? "limpieza: estudio de prueba eliminado" : "aviso: no se pudo borrar el estudio de prueba");
  }
  await mongoose.connect(`${uriBase}/filanex_plataforma`);
  await (await import("../src/models/plataforma/Cuenta.js")).default.deleteOne({ email: EMAIL });
  console.log("limpieza: cuenta temporal eliminada");
  await mongoose.disconnect();
}

console.log(fallos === 0 ? "\nTODO CORRECTO" : `\n${fallos} COMPROBACIONES FALLIDAS`);
process.exit(fallos === 0 ? 0 : 1);
