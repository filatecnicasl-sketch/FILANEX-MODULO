// Datos compartidos del módulo de asesoría (etiquetas y colores).

export const TIPOS_DOCUMENTO = [
  { clave: "emitida", nombre: "Factura emitida", tono: "violet" },
  { clave: "recibida", nombre: "Factura recibida", tono: "orange" },
  { clave: "gasto", nombre: "Ticket / gasto", tono: "rose" },
  { clave: "nomina", nombre: "Nómina", tono: "sky" },
  { clave: "otro", nombre: "Otro documento", tono: "slate" },
];

export const ESTADOS_DOCUMENTO = [
  { clave: "pendiente", nombre: "Pendiente", tono: "amber" },
  { clave: "revisado", nombre: "Revisado", tono: "emerald" },
  { clave: "contabilizado", nombre: "Contabilizado", tono: "violet" },
  { clave: "devuelto", nombre: "Devuelto al cliente", tono: "rose" },
];

export const FORMAS_JURIDICAS = [
  { clave: "autonomo", nombre: "Autónomo / persona física" },
  { clave: "sl", nombre: "Sociedad Limitada" },
  { clave: "slu", nombre: "Sociedad Limitada Unipersonal" },
  { clave: "sa", nombre: "Sociedad Anónima" },
  { clave: "cb", nombre: "Comunidad de bienes" },
  { clave: "cooperativa", nombre: "Cooperativa" },
  { clave: "asociacion", nombre: "Asociación" },
  { clave: "comunidad_bienes", nombre: "Comunidad de bienes" },
  { clave: "otra", nombre: "Otra" },
];

export const REGIMENES_IRPF = [
  { clave: "estimacion_directa_simplificada", nombre: "Estimación directa simplificada" },
  { clave: "estimacion_directa_normal", nombre: "Estimación directa normal" },
  { clave: "estimacion_objetiva", nombre: "Módulos (estimación objetiva)" },
  { clave: "agricultura_ganaderia", nombre: "Agricultura y ganadería" },
];

export const MODELOS_FISCALES = [
  { clave: "303", nombre: "303 · IVA trimestral" },
  { clave: "390", nombre: "390 · Resumen anual de IVA" },
  { clave: "130", nombre: "130 · Pago fraccionado IRPF" },
  { clave: "131", nombre: "131 · Módulos IRPF" },
  { clave: "100", nombre: "100 · Renta" },
  { clave: "111", nombre: "111 · Retenciones trabajo" },
  { clave: "190", nombre: "190 · Resumen anual retenciones" },
  { clave: "115", nombre: "115 · Retenciones alquileres" },
  { clave: "180", nombre: "180 · Resumen anual alquileres" },
  { clave: "123", nombre: "123 · Retenciones capital" },
  { clave: "349", nombre: "349 · Intracomunitarias" },
  { clave: "347", nombre: "347 · Operaciones con terceros" },
  { clave: "200", nombre: "200 · Impuesto de sociedades" },
  { clave: "202", nombre: "202 · Pago a cuenta sociedades" },
  { clave: "036", nombre: "036 · Censo" },
];

export const nombreTipo = (c) => TIPOS_DOCUMENTO.find((t) => t.clave === c)?.nombre ?? c;
export const tonoTipo = (c) => TIPOS_DOCUMENTO.find((t) => t.clave === c)?.tono ?? "slate";
export const nombreEstadoDoc = (c) => ESTADOS_DOCUMENTO.find((e) => e.clave === c)?.nombre ?? c;
export const tonoEstadoDoc = (c) => ESTADOS_DOCUMENTO.find((e) => e.clave === c)?.tono ?? "slate";
export const nombreForma = (c) => FORMAS_JURIDICAS.find((f) => f.clave === c)?.nombre ?? c;
export const nombreModelo = (c) => MODELOS_FISCALES.find((m) => m.clave === c)?.nombre ?? c;

export const fechaCorta = (f) =>
  f ? new Date(f).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
