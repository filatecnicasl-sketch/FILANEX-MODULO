import { generarJsonGemini } from "./gemini.js";

// Interpreta una cita dictada por voz (texto ya transcrito por el navegador)
// y devuelve los campos estructurados: fecha, hora, cliente, motivo, etc.
// El modelo, los reintentos y el tiempo máximo los gestiona services/gemini.js.

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
  const datos = await generarJsonGemini({
    contents: [{ text: construirPrompt(texto, hoy) }],
    esquema: ESQUEMA,
    // El usuario está esperando delante de la pantalla: no tiene sentido
    // hacerle aguardar más de unos segundos por modelo.
    timeoutMs: 15000,
    etiqueta: "El dictado de citas",
  });
  // Limpiar campos vacíos para no pisar lo que ya tenga el formulario.
  const limpio = {};
  for (const [k, v] of Object.entries(datos)) {
    if (v !== undefined && v !== null && v !== "") limpio[k] = v;
  }
  return limpio;
}
