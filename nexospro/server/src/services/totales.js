// Cálculo de totales compartido por todos los documentos con líneas.
// El descuento de la línea es un porcentaje sobre cantidad × precio.
export function calcularTotales(lineas) {
  let baseImponible = 0;
  let cuotaIva = 0;
  for (const l of lineas) {
    const bruto = (l.cantidad ?? 0) * (l.precioUnitario ?? 0);
    const base = bruto * (1 - (l.descuento ?? 0) / 100);
    baseImponible += base;
    cuotaIva += (base * (l.iva ?? 0)) / 100;
  }
  baseImponible = Math.round(baseImponible * 100) / 100;
  cuotaIva = Math.round(cuotaIva * 100) / 100;
  return { baseImponible, cuotaIva, total: Math.round((baseImponible + cuotaIva) * 100) / 100 };
}

// Quita las líneas vacías (sin descripción) que llegan del formulario.
// Devuelve null si no queda ninguna línea válida.
export function limpiarLineas(lineas) {
  const validas = (Array.isArray(lineas) ? lineas : [])
    .filter((l) => String(l?.descripcion ?? "").trim() !== "")
    .map((l) => ({
      descripcion: String(l.descripcion).trim(),
      ...(String(l.detalle ?? "").trim() !== "" ? { detalle: String(l.detalle).trim() } : {}),
      cantidad: Number(l.cantidad) || 0,
      precioUnitario: Number(l.precioUnitario) || 0,
      descuento: Number(l.descuento) || 0,
      iva: Number(l.iva) || 0,
    }));
  return validas.length > 0 ? validas : null;
}
