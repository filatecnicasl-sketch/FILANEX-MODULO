import { GoogleGenAI } from "@google/genai";

// Punto único de acceso a la IA para todo el backend (OCR de compras,
// tickets, valoraciones y dictado de la agenda).
//
// Por qué existe este módulo:
//   1. Google retira modelos sin avisar y algunos alias se quedan colgados
//      sin responder, así que hay lista de modelos verificados y reserva.
//   2. Google bloquea por ubicación las claves de AI Studio usadas desde
//      centros de datos ("User location is not supported for the API use"),
//      aunque la misma clave funcione desde una conexión doméstica. Por eso
//      el backend admite un proveedor alternativo (OpenAI) y un proxy propio,
//      y conmuta solo cuando detecta ese bloqueo.
//
// Configuración en server/.env:
//   IA_PROVEEDOR=auto | gemini | openai   (auto: Gemini y, si está bloqueado, OpenAI)
//   GEMINI_API_KEY=...                    clave de Google AI Studio
//   GEMINI_BASE_URL=...                   opcional: proxy propio en región permitida
//   OPENAI_API_KEY=...                    clave de OpenAI
//   OPENAI_MODEL=gpt-4o-mini              modelo con visión
//   OPENAI_BASE_URL=...                   opcional: Azure u otro compatible

const RETIRADOS = new Set([
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
]);

const preferido = process.env.GEMINI_MODEL;
if (preferido && RETIRADOS.has(preferido)) {
  console.warn(
    `GEMINI_MODEL=${preferido} ya no está operativo: se ignora y se usan los modelos vigentes. Actualiza server/.env.`
  );
}
const elegido = preferido && !RETIRADOS.has(preferido) ? preferido : null;

const sinRepetir = (l) => l.filter((m, i, a) => m && a.indexOf(m) === i);

export const MODELOS_CALIDAD = sinRepetir([
  elegido,
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
]);

export const MODELOS_RAPIDOS = sinRepetir([
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
]);

const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 40000;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function esRecuperable(err) {
  const msg = String(err?.message ?? "");
  return (
    err?.name === "AbortError" ||
    err?.status === 503 ||
    err?.status === 429 ||
    err?.status === 404 ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("no longer available") ||
    msg.includes("tardó demasiado")
  );
}

// Google devuelve este error cuando la IP de salida es de un centro de datos
// o de un país no admitido. Reintentar no sirve de nada: hay que cambiar de
// proveedor o salir por un proxy permitido.
export function esBloqueoUbicacion(err) {
  const msg = String(err?.message ?? "");
  return msg.includes("User location is not supported") || msg.includes("FAILED_PRECONDITION");
}

// Se recuerda el bloqueo para no perder tiempo intentando Google en cada
// petición: el usuario está esperando delante de la pantalla.
let geminiBloqueado = false;

function proveedorConfigurado() {
  const elegidoEnv = (process.env.IA_PROVEEDOR || "auto").toLowerCase();
  if (elegidoEnv === "openai") return "openai";
  if (elegidoEnv === "gemini") return "gemini";
  return "auto";
}

const hayOpenAi = () => Boolean(process.env.OPENAI_API_KEY);

// --- Google Gemini ---

// Ejecuta la petición contra un cliente ya construido (AI Studio o Vertex AI).
async function generarConCliente({ ai, contents, esquema, modelos, timeoutMs, motor }) {
  let ultimoError;

  for (const modelo of modelos) {
    for (let intento = 0; intento < 2; intento++) {
      const ctrl = new AbortController();
      const reloj = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const peticion = ai.models.generateContent({
          model: modelo,
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: esquema,
            abortSignal: ctrl.signal,
          },
        });
        const corte = new Promise((_, rechazar) =>
          setTimeout(() => rechazar(new Error(`El modelo ${modelo} tardó demasiado`)), timeoutMs + 500)
        );
        const respuesta = await Promise.race([peticion, corte]);
        return JSON.parse(respuesta.text);
      } catch (err) {
        ultimoError = err;
        if (esBloqueoUbicacion(err)) throw err;
        console.warn(`${motor} ${modelo} (intento ${intento + 1}): ${String(err?.message).slice(0, 160)}`);
        if (!esRecuperable(err)) throw err;
        if (err?.status === 404 || String(err?.message).includes("no longer available")) break;
        await esperar(1200 * (intento + 1));
      } finally {
        clearTimeout(reloj);
      }
    }
  }
  throw ultimoError ?? new Error(`${motor} no devolvió respuesta`);
}

async function generarConGemini({ contents, esquema, modelos, timeoutMs }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no configurada en server/.env");
  }
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    ...(process.env.GEMINI_BASE_URL ? { httpOptions: { baseUrl: process.env.GEMINI_BASE_URL } } : {}),
  });
  return generarConCliente({ ai, contents, esquema, modelos, timeoutMs, motor: "Gemini" });
}

// --- Vertex AI (Google Cloud) ---
//
// Es la vía oficial para servidores: autentica con la cuenta de servicio del
// proyecto (GOOGLE_APPLICATION_CREDENTIALS) en lugar de validar la ubicación
// de la IP, por lo que no puede aparecer el error "User location is not
// supported". La llamada es directa de FILANEX a Google, sin intermediarios.
async function generarConVertex({ contents, esquema, timeoutMs }) {
  const proyecto = process.env.VERTEX_PROJECT_ID;
  if (!proyecto) throw new Error("VERTEX_PROJECT_ID no configurado en server/.env");
  const ai = new GoogleGenAI({
    vertexai: true,
    project: proyecto,
    location: process.env.VERTEX_LOCATION || "europe-west1",
  });
  const modelos = sinRepetir([
    process.env.VERTEX_MODEL,
    "gemini-2.5-flash",
  ]);
  return generarConCliente({ ai, contents, esquema, modelos, timeoutMs, motor: "Vertex AI" });
}

// --- OpenAI (y compatibles: Azure OpenAI, pasarelas propias) ---

// Traduce las partes al formato de OpenAI. Se usa el mismo `contents` que
// Gemini para no tocar el resto del backend.
function partesParaOpenAi(contents) {
  const partes = [];
  for (const bloque of contents) {
    if (bloque?.text) partes.push({ type: "text", text: bloque.text });
    if (bloque?.inlineData) {
      partes.push({
        type: "image_url",
        image_url: { url: `data:${bloque.inlineData.mimeType};base64,${bloque.inlineData.data}` },
      });
    }
  }
  return partes;
}

// El esquema de Gemini usa tipos en mayúsculas; OpenAI espera JSON Schema.
function esquemaParaOpenAi(nodo) {
  if (!nodo || typeof nodo !== "object") return nodo;
  if (Array.isArray(nodo)) return nodo.map(esquemaParaOpenAi);
  const salida = {};
  for (const [clave, valor] of Object.entries(nodo)) {
    if (clave === "type" && typeof valor === "string") salida.type = valor.toLowerCase();
    else if (clave === "properties") {
      salida.properties = Object.fromEntries(
        Object.entries(valor).map(([k, v]) => [k, esquemaParaOpenAi(v)])
      );
    } else if (clave === "items") salida.items = esquemaParaOpenAi(valor);
    else salida[clave] = valor;
  }
  if (salida.type === "object") {
    salida.properties = salida.properties ?? {};
    // OpenAI exige que todas las propiedades estén en `required` cuando el
    // esquema es estricto; se relaja desactivando el modo estricto.
    salida.additionalProperties = false;
  }
  return salida;
}

async function generarConOpenAi({ contents, esquema, timeoutMs }) {
  const clave = process.env.OPENAI_API_KEY;
  if (!clave) throw new Error("OPENAI_API_KEY no configurada en server/.env");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const modelo = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const respuesta = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${clave}` },
    body: JSON.stringify({
      model: modelo,
      messages: [
        {
          role: "system",
          content: "Devuelve únicamente un JSON válido que cumpla el esquema indicado. No añadas texto ni Markdown.",
        },
        { role: "user", content: partesParaOpenAi(contents) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "resultado", schema: esquemaParaOpenAi(esquema), strict: false },
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const texto = await respuesta.text();
  if (!respuesta.ok) {
    let detalle = texto.slice(0, 200);
    try {
      detalle = JSON.parse(texto)?.error?.message ?? detalle;
    } catch {
      /* se deja el texto crudo */
    }
    throw new Error(`OpenAI ${respuesta.status}: ${detalle}`);
  }
  const datos = JSON.parse(texto);
  const contenido = datos?.choices?.[0]?.message?.content;
  if (!contenido) throw new Error("OpenAI no devolvió contenido");
  return JSON.parse(contenido);
}

/**
 * Pide a la IA una respuesta en JSON con esquema garantizado.
 * Mantiene el nombre histórico para no tocar el resto del backend.
 */
export async function generarJsonGemini({
  contents,
  esquema,
  modelos = MODELOS_CALIDAD,
  timeoutMs = TIMEOUT_MS,
  etiqueta = "El servicio de IA",
}) {
  const proveedor = proveedorConfigurado();
  const hayVertex = Boolean(process.env.VERTEX_PROJECT_ID);
  const usarOpenAiPrimero = proveedor === "openai" || (proveedor === "auto" && geminiBloqueado && hayOpenAi());

  // Prioridad: Vertex AI si está configurado (motor directo y estable);
  // después AI Studio; y OpenAI como reserva si Google bloquea el servidor.
  if (!usarOpenAiPrimero && hayVertex && (proveedor === "auto" || proveedor === "vertex" || proveedor === "gemini")) {
    try {
      return await generarConVertex({ contents, esquema, timeoutMs });
    } catch (err) {
      console.error("Vertex AI:", err?.message);
      if (proveedor === "vertex" || !hayOpenAi()) {
        throw new Error(`${etiqueta} no está disponible ahora mismo: inténtalo de nuevo en unos minutos.`);
      }
    }
  }

  if (!usarOpenAiPrimero) {
    try {
      return await generarConGemini({ contents, esquema, modelos, timeoutMs });
    } catch (err) {
      if (esBloqueoUbicacion(err)) {
        geminiBloqueado = true;
        console.error(
          "Google rechaza la clave desde la IP de este servidor (User location is not supported). Se intenta con el proveedor alternativo."
        );
        if (!hayOpenAi() && !hayVertex) {
          throw new Error(
            `${etiqueta} no está disponible: Google bloquea este servidor por ubicación. Configura Vertex AI (VERTEX_PROJECT_ID y GOOGLE_APPLICATION_CREDENTIALS) en server/.env.`
          );
        }
      } else if (proveedor === "gemini" || (!hayOpenAi() && !hayVertex)) {
        console.error("IA agotada:", err?.message);
        throw new Error(`${etiqueta} no está disponible ahora mismo: inténtalo de nuevo en unos minutos.`);
      } else {
        console.warn("Gemini falló, se prueba la alternativa:", String(err?.message).slice(0, 160));
      }
    }
  }

  if (hayVertex) {
    try {
      return await generarConVertex({ contents, esquema, timeoutMs });
    } catch (err) {
      console.error("Vertex AI:", err?.message);
      if (!hayOpenAi()) throw new Error(`${etiqueta} no está disponible ahora mismo: inténtalo de nuevo en unos minutos.`);
    }
  }

  try {
    return await generarConOpenAi({ contents, esquema, timeoutMs });
  } catch (err) {
    console.error("IA agotada:", err?.message);
    throw new Error(`${etiqueta} no está disponible ahora mismo: ${err.message}`);
  }
}

// Estado para el diagnóstico administrativo.
export function estadoIa() {
  return {
    proveedor: proveedorConfigurado(),
    vertexConfigurado: Boolean(process.env.VERTEX_PROJECT_ID),
    vertexRegion: process.env.VERTEX_LOCATION || "europe-west1",
    credencialVertex: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    geminiConfigurado: Boolean(process.env.GEMINI_API_KEY),
    geminiBloqueadoPorUbicacion: geminiBloqueado,
    openaiConfigurado: hayOpenAi(),
    proxyGemini: Boolean(process.env.GEMINI_BASE_URL),
  };
}
