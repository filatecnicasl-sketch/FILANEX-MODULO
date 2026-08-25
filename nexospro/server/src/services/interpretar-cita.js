import { GoogleGenAI } from "@google/genai";

// Interpreta una cita dictada por voz (texto ya transcrito por el navegador)
// y devuelve los campos estructurados: fecha, hora, cliente, motivo, etc.

const MODELO = process.env.GEMINI_MODEL || "gemini-flash-latest";
const MODELOS_RESERVA = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

const ESQUEMA = {
  type: "object",
  properties: {
    fecha: { type: "string", description: "Fecha de la cita en formato AAAA-MM-DD" },
    hora: { type: "string", description: "Hora en formato HH:MM 24h" },
    duracion: { type: "number", description: "Duración en minutos si se menciona" },
    clienteNombre: { type: "string" },
    telefono: { type: "string", description: "Solo dígitos" },
    matricula: { type: "string", description: "Matrícula del vehículo en mayúsculas, sin espacios" },
    motivo: { type: "string", description: "Motivo o asunto de la cita" },
    notas: { type: "string", description: "Cualquier otro detalle mencionado" },
  },
};

function construirPrompt(texto, hoy) {
  return `Eres el asistente de agenda de un taller/SAT español. Hoy es ${hoy}.
El usuario dicta una cita en lenguaje natural. Extrae los campos.
Reglas:
- "mañana" = hoy + 1 día, "pasado mañana" = hoy + 2, "el lunes" = el próximo lunes, etc. Si no menciona fecha, no pongas ninguna.
- Si no menciona hora, no pongas ninguna.
- La hora en formato 24h: "las 5 de la tarde" = 17:00, "las 9" de mañana = 09:00.
- Teléfono: solo dígitos seguidos.
- Matrícula: mayúsculas sin espacios ni guiones.
- Motivo: breve y claro (revisión, cambio de aceite, ITV, reunión, entrega…).
- Lo que no encaje en ningún campo va a notas.
Texto dictado: "${texto}"`;
}

export async function interpretarCita(texto, hoy) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no configurada");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const modelos = [MODELO, ...MODELOS_RESERVA.filter((m) => m !== MODELO)];
  let ultimoError;
  for (const modelo of modelos) {
    for (let intento = 0; intento < 2; intento++) {
      try {
        const respuesta = await ai.models.generateContent({
          model: modelo,
          contents: [{ text: construirPrompt(texto, hoy) }],
          config: { responseMimeType: "application/json", responseSchema: ESQUEMA },
        });
        const datos = JSON.parse(respuesta.text);
        // Limpiar campos vacíos para no pisar lo que ya tenga el formulario.
        const limpio = {};
        for (const [k, v] of Object.entries(datos)) {
          if (v !== undefined && v !== null && v !== "") limpio[k] = v;
        }
        return limpio;
      } catch (err) {
        ultimoError = err;
        const msg = String(err?.message ?? "");
        const temporal = err?.status === 503 || err?.status === 429 || msg.includes("UNAVAILABLE") || msg.includes("high demand");
        if (!temporal) throw err;
        await new Promise((r) => setTimeout(r, 1200 * (intento + 1)));
      }
    }
  }
  throw new Error(`La IA está ocupada ahora mismo: ${ultimoError?.message ?? "inténtalo de nuevo"}`);
}
