export const ESTADOS_OS = [
  { clave: "recepcion", nombre: "Recepción", tono: "amber" },
  { clave: "en_curso", nombre: "En curso", tono: "cyan" },
  { clave: "finalizado", nombre: "Finalizado", tono: "green" },
  { clave: "entregado", nombre: "Entregado", tono: "slate" },
];

export const ESTADOS_CITA = [
  { clave: "pendiente", nombre: "Pendiente", tono: "amber" },
  { clave: "confirmada", nombre: "Confirmada", tono: "cyan" },
  { clave: "realizada", nombre: "Realizada", tono: "green" },
  { clave: "cancelada", nombre: "Cancelada", tono: "slate" },
];

// Tipos de aparato habituales en un SAT de informática/electrónica
// (mismas claves que el modelo Aparato del servidor).
export const TIPOS_APARATO = [
  { clave: "pc_sobremesa", nombre: "PC sobremesa" },
  { clave: "portatil", nombre: "Portátil" },
  { clave: "movil", nombre: "Móvil" },
  { clave: "tablet", nombre: "Tablet" },
  { clave: "monitor", nombre: "Monitor" },
  { clave: "impresora", nombre: "Impresora" },
  { clave: "otro", nombre: "Otro" },
];

export const nombreTipoAparato = (clave) =>
  TIPOS_APARATO.find((t) => t.clave === clave)?.nombre ?? clave;

export const nombreEstadoCita = (clave) =>
  ESTADOS_CITA.find((e) => e.clave === clave)?.nombre ?? clave;

export const tonoEstadoCita = (clave) =>
  ESTADOS_CITA.find((e) => e.clave === clave)?.tono ?? "slate";

// "2026-08-06" (fecha local, sin líos de zona horaria)
export const aFechaInput = (d) => {
  const f = d instanceof Date ? d : new Date(d);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};

export const nombreEstado = (clave) =>
  ESTADOS_OS.find((e) => e.clave === clave)?.nombre ?? clave;

export const tonoEstado = (clave) =>
  ESTADOS_OS.find((e) => e.clave === clave)?.tono ?? "slate";
