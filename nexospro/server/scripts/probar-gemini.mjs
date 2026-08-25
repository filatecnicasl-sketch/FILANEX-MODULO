import "dotenv/config";

// Diagnóstico: qué modelos hay disponibles con la clave configurada y cuáles
// responden de verdad a generateContent (con tiempos). Timeout corto.

const clave = process.env.GEMINI_API_KEY;

const ctrl0 = new AbortController();
setTimeout(() => ctrl0.abort(), 15000);
const rl = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${clave}&pageSize=200`, { signal: ctrl0.signal });
const lista = await rl.json();
const disponibles = (lista.models ?? [])
  .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
  .map((m) => m.name.replace("models/", ""));
console.log("MODELOS DISPONIBLES:");
console.log(disponibles.join("\n"));
console.log("---");

const CANDIDATOS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest"];

for (const modelo of CANDIDATOS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  const t0 = Date.now();
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${clave}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Responde solo: hola" }] }] }),
        signal: ctrl.signal,
      }
    );
    const cuerpo = await r.text();
    console.log(`${modelo}: HTTP ${r.status} en ${Date.now() - t0} ms → ${cuerpo.slice(0, 200).replace(/\s+/g, " ")}`);
  } catch (e) {
    console.log(`${modelo}: FALLO en ${Date.now() - t0} ms → ${e.name}: ${e.message}`);
  } finally {
    clearTimeout(t);
  }
}

process.exit(0);
