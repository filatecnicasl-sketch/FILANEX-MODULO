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

const MESES = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const DIAS = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

function normalizar(texto) {
  return String(texto)
    .toLocaleLowerCase("es-ES")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function aFechaTexto(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function sumarDias(fecha, dias) {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

function extraerFecha(texto, hoy) {
  const base = new Date(`${hoy}T12:00:00`);
  if (texto.includes("pasado manana")) return aFechaTexto(sumarDias(base, 2));
  if (texto.includes("manana")) return aFechaTexto(sumarDias(base, 1));
  if (/\bhoy\b/.test(texto)) return hoy;

  const numerica = texto.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numerica) {
    let anio = numerica[3] ? Number(numerica[3]) : base.getFullYear();
    if (anio < 100) anio += 2000;
    const fecha = new Date(anio, Number(numerica[2]) - 1, Number(numerica[1]), 12);
    if (!numerica[3] && fecha < base) fecha.setFullYear(fecha.getFullYear() + 1);
    return aFechaTexto(fecha);
  }

  const escrita = texto.match(new RegExp(`\\b(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${Object.keys(MESES).join("|")})(?:\\s+de\\s+(\\d{4}))?\\b`));
  if (escrita) {
    const fecha = new Date(Number(escrita[3]) || base.getFullYear(), MESES[escrita[2]], Number(escrita[1]), 12);
    if (!escrita[3] && fecha < base) fecha.setFullYear(fecha.getFullYear() + 1);
    return aFechaTexto(fecha);
  }

  const diaSemana = Object.keys(DIAS).find((dia) => new RegExp(`\\b${dia}\\b`).test(texto));
  if (diaSemana) {
    let diferencia = (DIAS[diaSemana] - base.getDay() + 7) % 7;
    if (diferencia === 0) diferencia = 7;
    if (/semana (?:que viene|proxima)/.test(texto) && diferencia < 7) diferencia += 7;
    return aFechaTexto(sumarDias(base, diferencia));
  }
  return undefined;
}

function horaValida(horas, minutos) {
  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) return undefined;
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

function extraerHora(texto) {
  if (texto.includes("mediodia")) return "12:00";
  if (texto.includes("medianoche")) return "00:00";
  const coincidencia = texto.match(/\b(?:a\s+las?|desde\s+las?|de\s+las?)\s*(\d{1,2})(?::(\d{2}))?(?:\s*(?:h|horas?))?(?:\s*(y\s+media|y\s+cuarto|menos\s+cuarto))?\b/)
    || texto.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!coincidencia) return undefined;
  let horas = Number(coincidencia[1]);
  let minutos = Number(coincidencia[2] || 0);
  const fraccion = coincidencia[3] || "";
  if (fraccion.includes("media")) minutos = 30;
  if (fraccion.includes("y cuarto")) minutos = 15;
  if (fraccion.includes("menos cuarto")) {
    horas -= 1;
    minutos = 45;
  }
  if (/\b(?:de la tarde|por la tarde|de la noche|por la noche)\b/.test(texto) && horas < 12) horas += 12;
  return horaValida(horas, minutos);
}

function extraerDuracion(texto) {
  if (/\b(?:media hora|30 minutos?)\b/.test(texto)) return 30;
  if (/\b(?:un cuarto de hora|15 minutos?)\b/.test(texto)) return 15;
  if (/\b(?:una hora y media|hora y media)\b/.test(texto)) return 90;
  const horas = texto.match(/\b(?:durante\s+)?(\d+(?:[.,]\d+)?)\s*horas?\b/);
  if (horas) return Math.round(Number(horas[1].replace(",", ".")) * 60);
  if (/\b(?:durante\s+)?(?:una|1)\s+hora\b/.test(texto)) return 60;
  const minutos = texto.match(/\b(?:durante\s+)?(\d+)\s*minutos?\b/);
  return minutos ? Number(minutos[1]) : undefined;
}

function extraerTipo(texto) {
  if (/\b(llamar|llamada|telefono|telefonica)\b/.test(texto)) return "llamada";
  if (/\b(recordar|recordatorio|avisar)\b/.test(texto)) return "recordatorio";
  if (/\b(tarea|hacer|preparar|enviar|revisar)\b/.test(texto)) return "tarea";
  if (/\b(reunion|reunirme|visita|cita)\b/.test(texto)) return "reunion";
  return "otro";
}

function capitalizar(texto) {
  return texto
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|\s)\p{L}/gu, (letra) => letra.toLocaleUpperCase("es-ES"));
}

function extraerCliente(textoOriginal) {
  const coincidencia = textoOriginal.match(/\b(?:con|llamar a|llamada a)\s+([\p{L}][\p{L}\s.'-]*?)(?=\s+(?:hoy|mañana|pasado mañana|el\s+\d|a\s+las?|durante|en\s+(?:la|el|calle|avenida)|tel[eé]fono|por\s+la)|[,.;]|$)/iu);
  return coincidencia ? capitalizar(coincidencia[1]) : undefined;
}

function extraerLugar(textoOriginal) {
  const coincidencia = textoOriginal.match(/\b(?:en|lugar)\s+(la\s+oficina|el\s+taller|calle\s+[^,.;]+|avenida\s+[^,.;]+|plaza\s+[^,.;]+|[^,.;]+?)(?=\s+(?:durante|tel[eé]fono|a\s+las?)|[,.;]|$)/iu);
  return coincidencia ? capitalizar(coincidencia[1]) : undefined;
}

function extraerTelefono(textoOriginal) {
  const coincidencia = textoOriginal.match(/\b(?:tel[eé]fono|tel|m[oó]vil)\s*:?\s*((?:\+34\s*)?[6789](?:[\s.-]*\d){8})\b/iu)
    || textoOriginal.match(/\b((?:\+34\s*)?[6789](?:[\s.-]*\d){8})\b/u);
  return coincidencia?.[1]?.replace(/\D/g, "").replace(/^34(?=\d{9}$)/, "");
}

function crearTitulo(textoOriginal, tipo, clienteNombre) {
  if (clienteNombre) {
    const prefijos = {
      llamada: "Llamada",
      reunion: "Reunión",
      tarea: "Tarea",
      recordatorio: "Recordatorio",
      otro: "Evento",
    };
    return `${prefijos[tipo]} con ${clienteNombre}`;
  }
  const limpio = textoOriginal
    .replace(/\b(?:hoy|mañana|pasado mañana)\b/giu, "")
    .replace(/\b(?:lunes|martes|miércoles|jueves|viernes|sábado|domingo)(?:\s+de\s+la\s+semana\s+(?:que viene|próxima))?\b/giu, "")
    .replace(/\b(?:el\s+)?\d{1,2}(?:[/-]\d{1,2}(?:[/-]\d{2,4})?|\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+\d{4})?)\b/giu, "")
    .replace(/\b(?:a\s+las?|desde\s+las?)\s*\d{1,2}(?::\d{2})?(?:\s*(?:horas?|h))?(?:\s+de\s+la\s+(?:mañana|tarde|noche))?/giu, "")
    .replace(/\b(?:durante\s+)?(?:una\s+hora\s+y\s+media|hora\s+y\s+media|media\s+hora|un\s+cuarto\s+de\s+hora|(?:una|\d+(?:[.,]\d+)?)\s+(?:horas?|minutos?))\b/giu, "")
    .replace(/\b(?:tel[eé]fono|tel|m[oó]vil)\s*:?\s*(?:\+34\s*)?[6789](?:[\s.-]*\d){8}\b/giu, "")
    .replace(/\s+/g, " ")
    .replace(/^[,.;:\s]+|[,.;:\s]+$/g, "");
  return capitalizar(limpio || "Evento de agenda").slice(0, 120);
}

export function interpretarEventoLocal(texto, hoy) {
  const textoNormalizado = normalizar(texto);
  const tipo = extraerTipo(textoNormalizado);
  const clienteNombre = extraerCliente(texto);
  const telefono = extraerTelefono(texto);
  return limpiar({
    fecha: extraerFecha(textoNormalizado, hoy),
    hora: extraerHora(textoNormalizado),
    duracion: extraerDuracion(textoNormalizado),
    tipo,
    titulo: crearTitulo(texto, tipo, clienteNombre),
    clienteNombre,
    telefono,
    lugar: extraerLugar(texto),
  });
}

export async function interpretarEvento(texto, hoy) {
  try {
    const datos = await generarJsonGemini({
      contents: [{ text: construirPromptEvento(texto, hoy) }],
      esquema: ESQUEMA_EVENTO,
      modelos: MODELOS_RAPIDOS,
      timeoutMs: 12000,
      etiqueta: "El dictado de eventos de agenda",
    });
    return limpiar(datos);
  } catch (error) {
    console.warn(`Dictado de agenda procesado localmente: ${String(error?.message).slice(0, 160)}`);
    return interpretarEventoLocal(texto, hoy);
  }
}
