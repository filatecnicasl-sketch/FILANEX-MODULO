export const ESTADOS_OT = [
  { clave: "recepcion", nombre: "Recepción", tono: "amber" },
  { clave: "en_curso", nombre: "En curso", tono: "cyan" },
  { clave: "finalizado", nombre: "Finalizado", tono: "green" },
  { clave: "entregado", nombre: "Entregado", tono: "slate" },
];

export const TRABAJOS_TALLER = ["Chapa", "Pintura", "Mecánica"];

export const ESTADOS_CITA = [
  { clave: "pendiente", nombre: "Pendiente", tono: "amber" },
  { clave: "confirmada", nombre: "Confirmada", tono: "cyan" },
  { clave: "realizada", nombre: "Realizada", tono: "green" },
  { clave: "cancelada", nombre: "Cancelada", tono: "slate" },
];

export const ESTADOS_VALORACION = [
  { clave: "pendiente", nombre: "Pendiente", tono: "amber" },
  { clave: "valorado", nombre: "Valorado", tono: "cyan" },
  { clave: "aprobado", nombre: "Aprobado", tono: "green" },
  { clave: "rechazado", nombre: "Rechazado", tono: "red" },
];

export const nombreEstadoValoracion = (clave) =>
  ESTADOS_VALORACION.find((e) => e.clave === clave)?.nombre ?? clave;

export const tonoEstadoValoracion = (clave) =>
  ESTADOS_VALORACION.find((e) => e.clave === clave)?.tono ?? "slate";

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
  ESTADOS_OT.find((e) => e.clave === clave)?.nombre ?? clave;

export const tonoEstado = (clave) =>
  ESTADOS_OT.find((e) => e.clave === clave)?.tono ?? "slate";
