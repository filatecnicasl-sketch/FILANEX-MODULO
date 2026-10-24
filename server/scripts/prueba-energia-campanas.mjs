/* Prueba E2E de las campañas de precios (Energía → Campañas):
   genera un PDF de campaña con los términos de una tarifa, lo sube a
   /api/energia/campanas/ocr y comprueba que el prefill llega bien
   (comercializadora enlazada, precios, conversión €/kW·día → €/kW·año),
   que la campaña se guarda pendiente, se publica y que luego aparece en
   el listado de publicadas (las que ven los estudios). Al final borra la
   campaña y la cuenta temporal.
   Uso: node scripts/prueba-energia-campanas.mjs  (desde server/, API en 4700) */
import mongoose from "mongoose";
import "dotenv/config";

const EMAIL = "stress.test@filanex.local";
const PASSWORD = "StressTest123!";
const BASE = process.env.API_BASE || "http://localhost:4700";
const uriBase = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";

// --- Campaña de precios de ejemplo en PDF (texto plano, Helvetica) ---
function pdfCampana(lineas) {
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

const CAMPANA = pdfCampana([
  "ENERGIA DEL MEDITERRANEO, S.L. (ENERMED) - C/ Industria 25, 46020 Valencia",
  "CAMPANA DE PRECIOS PARA AGENTES COLABORADORES",
  "Nombre de la oferta: Tarifa Estable Otono 2026",
  "Tarifa de acceso: 2.0TD   Vigencia: del 01/10/2026 al 31/12/2026",
  "",
  "TERMINOS DE ENERGIA (euros/kWh):",
  "  Punta (P1): 0,1684",
  "  Valle (P2): 0,0921",
  "",
  "TERMINO DE POTENCIA (euros/kW y dia):",
  "  Punta: 0,0955",
  "  Valle: 0,0621",
  "",
  "Cuota de mantenimiento: 0,00 EUR/mes (sin cuota)",
  "Promocion: 15% de descuento en el termino de energia durante 3 meses",
]);

await mongoose.connect(`${uriBase}/filanex_plataforma`);
const Tenant = (await import("../src/models/plataforma/Tenant.js")).default;
const Cuenta = (await import("../src/models/plataforma/Cuenta.js")).default;
const { hashContrasena } = await import("../src/routes/usuarios.js");
const tenant = await Tenant.findOne({ slug: "demototal" });
await Cuenta.deleteOne({ email: EMAIL });
await Cuenta.create({
  nombre: "Prueba campanas energia",
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

let idCampana = null;
try {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  const H = { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` };

  // Sin fichero → 400.
  const sinFichero = await fetch(`${BASE}/api/energia/campanas/ocr`, {
    method: "POST",
    headers: { Authorization: `Bearer ${login.token}` },
  });
  ok(sinFichero.status === 400, "sin fichero responde 400");

  // OCR de la campaña de ejemplo.
  const fd = new FormData();
  fd.append("documento", new Blob([CAMPANA], { type: "application/pdf" }), "campana.pdf");
  const rOcr = await fetch(`${BASE}/api/energia/campanas/ocr`, {
    method: "POST",
    headers: { Authorization: `Bearer ${login.token}` },
    body: fd,
  });
  const ocr = await rOcr.json();
  ok(rOcr.status === 200, `el endpoint responde 200 (${rOcr.status})`);
  const p = ocr.prefill ?? {};
  ok(p.tipo === "luz", `tipo deducido (${p.tipo})`);
  ok(String(p.tarifa ?? "").includes("2.0TD"), `tarifa leída (${p.tarifa})`);
  ok(String(p.nombre ?? "").toLowerCase().includes("estable"), `nombre de la campaña (${p.nombre})`);
  ok(entre(p.precioEnergia, 0.12, 0.14), `precio de energía (media punta/valle ≈ 0,13: ${p.precioEnergia})`);
  ok(entre(p.precioEnergiaPunta, 0.15, 0.18), `energía punta (${p.precioEnergiaPunta} ≈ 0,1684)`);
  ok(entre(p.precioEnergiaValle, 0.08, 0.10), `energía valle (${p.precioEnergiaValle} ≈ 0,0921)`);
  // 0,0955 €/kW·día × 365 ≈ 34,86 €/kW·año
  ok(entre(p.precioPotenciaPunta, 32, 38), `potencia punta convertida a €/kW·año (${p.precioPotenciaPunta} ≈ 34,86)`);
  ok(entre(p.precioPotenciaValle, 20, 25), `potencia valle convertida (${p.precioPotenciaValle} ≈ 22,67)`);
  ok(ocr.detalle?.unidadLeida === "€/kW·día", `unidad de potencia leída (${ocr.detalle?.unidadLeida})`);
  ok(String(p.descuento ?? "").includes("15"), `descuento leído (${p.descuento})`);
  ok(Array.isArray(ocr.avisos), "devuelve la lista de avisos");

  // La comercializadora del documento no existe → aviso y sin enlace.
  if (!p.comercializadora) {
    ok(Array.isArray(ocr.avisos) && ocr.avisos.length > 0, "avisa de que la comercializadora no está dada de alta");
  }

  // Crear la comercializadora de prueba y guardar la campaña con el prefill.
  const rCom = await fetch(`${BASE}/api/energia/comercializadoras`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ nombre: "Enermed Prueba Campanas", nif: "B12345678Z" }),
  });
  const com = await rCom.json();
  const idCom = rCom.status === 201 ? com._id : (await fetch(`${BASE}/api/energia/comercializadoras`, { headers: H }).then((r) => r.json())).find((c) => c.nombre === "Enermed Prueba Campanas")?._id;
  ok(!!idCom, "comercializadora de prueba lista");

  const rGuardar = await fetch(`${BASE}/api/energia/campanas`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      comercializadora: idCom,
      tipo: p.tipo,
      nombre: p.nombre,
      tarifa: p.tarifa,
      vigenciaDesde: p.vigenciaDesde,
      vigenciaHasta: p.vigenciaHasta,
      precioEnergia: p.precioEnergia,
      precioEnergiaPunta: p.precioEnergiaPunta,
      precioEnergiaValle: p.precioEnergiaValle,
      precioPotenciaPunta: p.precioPotenciaPunta,
      precioPotenciaValle: p.precioPotenciaValle,
      descuento: p.descuento,
      origen: "ocr",
      estado: "pendiente",
    }),
  });
  const campana = await rGuardar.json();
  ok(rGuardar.status === 201, `campaña guardada (${rGuardar.status})`);
  idCampana = campana._id ?? null;
  ok(campana.estado === "pendiente", "la campaña nace pendiente de revisión");
  ok(campana.origen === "ocr", "marca el origen ocr");
  ok(campana.comercializadoraNombre === "Enermed Prueba Campanas", `comercializadora denormalizada (${campana.comercializadoraNombre})`);

  // Publicarla y comprobar que aparece en el listado de publicadas.
  const rPublicar = await fetch(`${BASE}/api/energia/campanas/${idCampana}/estado`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ estado: "publicada" }),
  });
  ok(rPublicar.status === 200, "campaña publicada");
  const publicadas = await fetch(`${BASE}/api/energia/campanas?estado=publicada`, { headers: H }).then((r) => r.json());
  ok(Array.isArray(publicadas) && publicadas.some((c) => c._id === idCampana), "la campaña aparece en el listado de publicadas (lo que ven los estudios)");

  // Estado no válido → 400.
  const rMalo = await fetch(`${BASE}/api/energia/campanas/${idCampana}/estado`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ estado: "cualquier cosa" }),
  });
  ok(rMalo.status === 400, "estado no válido responde 400");

  // Sin comercializadora → 400.
  const rSinCom = await fetch(`${BASE}/api/energia/campanas`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ tipo: "luz", precioEnergia: 0.1 }),
  });
  ok(rSinCom.status === 400, "guardar sin comercializadora responde 400");
} finally {
  const relogin = async () =>
    (await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    }).then((r) => r.json())).token;

  if (idCampana) {
    const token = await relogin();
    const r = await fetch(`${BASE}/api/energia/campanas/${idCampana}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(r.ok ? "limpieza: campaña de prueba eliminada" : "aviso: no se pudo borrar la campaña de prueba");
    const rCom = await fetch(`${BASE}/api/energia/comercializadoras`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    const com = (Array.isArray(rCom) ? rCom : []).find((c) => c.nombre === "Enermed Prueba Campanas");
    if (com) {
      const rB = await fetch(`${BASE}/api/energia/comercializadoras/${com._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(rB.ok ? "limpieza: comercializadora de prueba eliminada" : "aviso: no se pudo borrar la comercializadora de prueba");
    }
  }
  await mongoose.connect(`${uriBase}/filanex_plataforma`);
  const Cuenta2 = (await import("../src/models/plataforma/Cuenta.js")).default;
  await Cuenta2.deleteOne({ email: EMAIL });
  console.log("limpieza: cuenta temporal eliminada");
  await mongoose.disconnect();
}

console.log(fallos === 0 ? "\nTODO CORRECTO" : `\n${fallos} COMPROBACIONES FALLIDAS`);
process.exit(fallos === 0 ? 0 : 1);
