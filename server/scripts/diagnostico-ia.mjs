import "dotenv/config";

// Diagnóstico de conectividad con la IA.
// Uso: node scripts/diagnostico-ia.mjs
// Muestra qué responde Google desde ESTE equipo, sin exponer la clave.

const clave = process.env.GEMINI_API_KEY ?? "";
console.log("Clave configurada:", clave ? `sí (${clave.length} caracteres, termina en ${clave.slice(-4)})` : "NO");
console.log("GEMINI_MODEL:", process.env.GEMINI_MODEL || "(sin definir)");

try {
  const geo = await (await fetch("https://ipinfo.io/json")).json();
  console.log("Salida a internet:", geo.ip, geo.country, geo.org);
} catch (e) {
  console.log("No se pudo consultar la IP de salida:", e.message);
}

async function probar(nombre, url, opciones) {
  try {
    const respuesta = await fetch(url, { ...opciones, signal: AbortSignal.timeout(20000) });
    const texto = await respuesta.text();
    console.log(`\n[${nombre}] HTTP ${respuesta.status}`);
    console.log(texto.slice(0, 500));
    return { status: respuesta.status, texto };
  } catch (e) {
    console.log(`\n[${nombre}] ERROR de red: ${e.message}`);
    return { status: 0, texto: e.message };
  }
}

await probar("listar modelos", `https://generativelanguage.googleapis.com/v1beta/models?key=${clave}&pageSize=200`);

await probar(
  "generar texto",
  `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || "gemini-3.5-flash"}:generateContent?key=${clave}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Responde solo con la palabra OK" }] }] }),
  }
);

const claveOpenAi = process.env.OPENAI_API_KEY ?? "";
console.log("\nOPENAI_API_KEY:", claveOpenAi ? `configurada (termina en ${claveOpenAi.slice(-4)})` : "NO configurada");
if (claveOpenAi) {
  await probar("OpenAI", `${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${claveOpenAi}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: "Responde solo con la palabra OK" }],
    }),
  });
}

if (process.env.VERTEX_PROJECT_ID) {
  console.log("\nVERTEX_PROJECT_ID:", process.env.VERTEX_PROJECT_ID);
  console.log("VERTEX_LOCATION:", process.env.VERTEX_LOCATION || "europe-west1");
  console.log("GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS ? "configurada" : "NO configurada");
  try {
    const { generarJsonGemini } = await import("../src/services/gemini.js");
    const resultado = await generarJsonGemini({
      contents: [{ text: "Responde en JSON con {\"prueba\": \"OK\"}" }],
      esquema: { type: "OBJECT", properties: { prueba: { type: "STRING" } } },
      etiqueta: "Vertex AI",
    });
    console.log("[Vertex AI] respuesta correcta:", resultado);
  } catch (e) {
    console.log("[Vertex AI] ERROR:", e.message);
  }
} else {
  console.log("\nVertex AI: NO configurado (falta VERTEX_PROJECT_ID)");
}

const { estadoIa } = await import("../src/services/gemini.js");
console.log("\nEstado que usará FILANEX:", estadoIa());

process.exit(0);
