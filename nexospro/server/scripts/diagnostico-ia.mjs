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

process.exit(0);
