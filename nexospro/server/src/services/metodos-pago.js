// Catálogo de métodos de pago: la empresa lo edita en Sistema → Series.
// Un método con "plazos" (días) genera esos vencimientos en la factura
// a partes iguales (p.ej. [30, 60, 90] = tres tercios).

export const METODOS_PAGO_DEFECTO = [
  { nombre: "Transferencia", plazos: [], defecto: true },
  { nombre: "Efectivo", plazos: [] },
  { nombre: "Tarjeta", plazos: [] },
  { nombre: "Remesa", plazos: [] },
  { nombre: "30/60/90", plazos: [30, 60, 90] },
];

// Catálogo de la empresa, o el de defecto si aún no lo ha guardado.
export function catalogoMetodosPago(empresa) {
  return empresa?.metodosPago?.length ? empresa.metodosPago : METODOS_PAGO_DEFECTO;
}

// Busca un método por nombre (sin distinguir mayúsculas/minúsculas).
export function buscarMetodoPago(empresa, nombre) {
  const n = String(nombre ?? "").toLowerCase();
  return catalogoMetodosPago(empresa).find((m) => m.nombre.toLowerCase() === n);
}

// Nombre del método marcado por defecto (para preasignarlo en documentos).
export function metodoPagoDefecto(empresa) {
  const catalogo = catalogoMetodosPago(empresa);
  return (catalogo.find((m) => m.defecto) ?? catalogo[0]).nombre;
}
