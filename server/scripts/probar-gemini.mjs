import "dotenv/config";

// Diagnóstico de la IA: qué modelos hay disponibles con la clave configurada
// y prueba real del dictado de citas de punta a punta.
// Uso: node scripts/probar-gemini.mjs
// Útil cuando Google retira modelos (el OCR o el dictado dejan de responder).

const clave = process.env.GEMINI_API_KEY;
console.log("GEMINI_MODEL en .env:", process.env.GEMINI_MODEL || "(sin definir)");

const ctrl0 = new AbortController();
setTimeout(() => ctrl0.abort(), 15000);
const rl = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${clave}&pageSize=200`, { signal: ctrl0.signal });
const lista = await rl.json();
const disponibles = (lista.models ?? [])
  .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
  .map((m) => m.name.replace("models/", ""))
  .filter((m) => m.includes("flash") && !m.includes("image") && !m.includes("tts"));
console.log("MODELOS FLASH DISPONIBLES:", disponibles.join(", "));
console.log("---");

// Prueba real del dictado de citas usando el servicio del backend.
const { interpretarCita } = await import("../src/services/interpretar-cita.js");
const hoy = new Date().toLocaleDateString("sv-SE");
const t0 = Date.now();
try {
  const r = await interpretarCita(
    "el jueves que viene a las once y media, Antonio Ruiz, telefono 611223344, revision de la instalacion",
    hoy
  );
  console.log(`interpretarCita OK en ${Date.now() - t0} ms (hoy ${hoy}):`);
  console.log(JSON.stringify(r, null, 2));
} catch (e) {
  console.log(`interpretarCita FALLÓ en ${Date.now() - t0} ms: ${e.message}`);
}

process.exit(0);
