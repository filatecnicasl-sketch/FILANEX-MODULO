import { generarJsonGemini, MODELOS_RAPIDOS } from "./gemini.js";

const ESQUEMA_EVENTO = {
  type: "object",
  properties: {
    fecha: { type: "string", description: "Fecha del evento en formato AAAA-MM-DD" },
    hora: { type: "string", description: "Hora en formato HH:MM 24h" },
    duracion: { type: "number", description: "Duración en minutos si se menciona" },
    tipo: { type: "string", enum: ["reunion", "llamada", "tarea", "recordatorio", "otro"] },
    titulo: { type: "string", description: "Asunto breve y claro del evento" },
    clienteNombre: { type: "string" },
    telefono: { type: "string", description: "Solo dígitos" },
    lugar: { type: "string", description: "Lugar o dirección del evento" },
    notas: { type: "string", description: "Cualquier otro detalle mencionado" },
  },
};

function construirPromptEvento(texto, hoy) {
  const diaSemana = new Date(`${hoy}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long" });
  return `Eres el asistente de la agenda profesional de una empresa española. Hoy es ${hoy} (${diaSemana}).
El usuario dicta un evento, reunión, llamada, tarea o recordatorio. Extrae los campos.
Reglas:
- "mañana" = hoy + 1 día, "pasado mañana" = hoy + 2. Si no menciona fecha, no pongas ninguna.
- Los días de la semana indican el primer día posterior a hoy; si dice "de la semana que viene", usa la semana siguiente.
- Si no menciona hora, no pongas ninguna. Usa formato 24h.
- Clasifica el tipo como reunion, llamada, tarea, recordatorio u otro.
- El título debe ser breve, claro y profesional.
- Lo que no encaje en ningún campo va a notas.
Texto dictado: "${texto}"`;
}

function limpiar(datos) {
  const limpio = {};
  for (const [clave, valor] of Object.entries(datos)) {
    if (valor !== undefined && valor !== null && valor !== "") limpio[clave] = valor;
  }
  return limpio;
}

export async function interpretarEvento(texto, hoy) {
  const datos = await generarJsonGemini({
    contents: [{ text: construirPromptEvento(texto, hoy) }],
    esquema: ESQUEMA_EVENTO,
    modelos: MODELOS_RAPIDOS,
    timeoutMs: 12000,
    etiqueta: "El dictado de eventos de agenda",
  });
  return limpiar(datos);
}