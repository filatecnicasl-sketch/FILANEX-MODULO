// Festivos para el calendario: los nacionales de España se calculan solos
// (fijos + Jueves y Viernes Santo según la Pascua); los locales o regionales
// (día de la comunidad, ferias del pueblo…) los configura cada empresa en
// Ajustes → Configuración → Taller.

function domingoDePascua(anio) {
  // Algoritmo de Gauss para el calendario gregoriano.
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

const pad = (n) => String(n).padStart(2, "0");
const clave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Mapa "YYYY-MM-DD" → nombre de los festivos nacionales de un año.
export function festivosNacionales(anio) {
  const pascua = domingoDePascua(anio);
  const pascuaMas = (n) => clave(new Date(pascua.getFullYear(), pascua.getMonth(), pascua.getDate() + n));
  return new Map([
    [`${anio}-01-01`, "Año Nuevo"],
    [`${anio}-01-06`, "Epifanía (Reyes)"],
    [pascuaMas(-3), "Jueves Santo"],
    [pascuaMas(-2), "Viernes Santo"],
    [`${anio}-05-01`, "Día del Trabajo"],
    [`${anio}-08-15`, "Asunción"],
    [`${anio}-11-01`, "Todos los Santos"],
    [`${anio}-12-06`, "Constitución"],
    [`${anio}-12-08`, "Inmaculada"],
    [`${anio}-12-25`, "Navidad"],
  ]);
}

// Nombre del festivo de una fecha ("2026-12-25" o Date) o null si no es
// festivo. extras: [{ fecha: "YYYY-MM-DD", nombre }] de la empresa.
export function nombreFestivo(fecha, extras = []) {
  const txt = typeof fecha === "string" ? fecha : clave(fecha);
  const anio = Number(txt.slice(0, 4));
  if (!Number.isFinite(anio) || !/^\d{4}-\d{2}-\d{2}$/.test(txt)) return null;
  const nacional = festivosNacionales(anio).get(txt);
  if (nacional) return nacional;
  const extra = extras.find((f) => f?.fecha === txt);
  return extra ? (extra.nombre?.trim() || "Festivo local") : null;
}
