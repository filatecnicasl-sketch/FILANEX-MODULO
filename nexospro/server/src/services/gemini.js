import { GoogleGenAI } from "@google/genai";

// Punto único de acceso a Gemini para todo el backend (OCR de compras,
// tickets, valoraciones y dictado de citas).
//
// Por qué existe este módulo: Google retira modelos sin avisar. Los `2.x`
// devuelven ahora 404 («no longer available to new users») y el alias
// `gemini-flash-latest` se quedó aceptando la conexión sin responder nunca,
// lo que dejaba la petición colgada para siempre. Aquí se centraliza:
//   1. La lista de modelos verificados, con reserva.
//   2. Un tiempo máximo por intento: si un modelo no responde, se pasa al
//      siguiente en vez de bloquear al usuario.

// Modelos que Google ya ha retirado («no longer available to new users») o que
// se quedan aceptando la conexión sin responder. Se descartan incluso si
// vienen en GEMINI_MODEL, para que un .env antiguo (instalaciones locales que
// no se actualizan) no deje el OCR ni el dictado colgados.
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
    `GEMINI_MODEL=${preferido} ya no está operativo: se usará gemini-3.6-flash. Actualiza server/.env.`
  );
}

const MODELOS = [
  RETIRADOS.has(preferido) ? null : preferido,
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
].filter((m, i, l) => m && l.indexOf(m) === i);

const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 40000;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Errores que merecen reintento o cambio de modelo (saturación, modelo
// retirado, o el modelo que no contesta).
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

/**
 * Pide a Gemini una respuesta en JSON con esquema garantizado.
 * @param {object} opciones
 * @param {Array} opciones.contents Partes del mensaje (texto y/o inlineData).
 * @param {object} opciones.esquema responseSchema de Gemini.
 * @param {number} [opciones.timeoutMs] Tiempo máximo por intento.
 * @param {string} [opciones.etiqueta] Nombre para los mensajes de error.
 */
export async function generarJsonGemini({ contents, esquema, timeoutMs = TIMEOUT_MS, etiqueta = "El servicio de IA" }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no configurada en server/.env");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let ultimoError;

  for (const modelo of MODELOS) {
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
        // Red de seguridad: aunque el SDK ignore la señal, no se espera más
        // del tiempo máximo.
        const corte = new Promise((_, rechazar) =>
          setTimeout(() => rechazar(new Error(`El modelo ${modelo} tardó demasiado`)), timeoutMs + 500)
        );
        const respuesta = await Promise.race([peticion, corte]);
        return JSON.parse(respuesta.text);
      } catch (err) {
        ultimoError = err;
        if (!esRecuperable(err)) throw err;
        // Si el modelo está retirado no tiene sentido reintentarlo.
        if (err?.status === 404 || String(err?.message).includes("no longer available")) break;
        await esperar(1200 * (intento + 1));
      } finally {
        clearTimeout(reloj);
      }
    }
  }

  console.error("Gemini agotado:", ultimoError?.message);
  throw new Error(`${etiqueta} no está disponible ahora mismo: inténtalo de nuevo en unos minutos.`);
}
