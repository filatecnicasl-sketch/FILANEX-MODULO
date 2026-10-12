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

// Error de validación de líneas: mensaje para el usuario + estado HTTP 400.
export class LineasInvalidasError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = "LineasInvalidasError";
    this.status = 400;
  }
}

// Quita las líneas vacías (sin descripción) que llegan del formulario y
// valida que los datos sean contablemente coherentes ANTES de calcular
// totales o firmar nada en VeriFactu. Devuelve null si no queda ninguna
// línea válida; lanza LineasInvalidasError si alguna línea es absurda
// (descuento >100%, IVA negativo, cantidades o precios imposibles...).
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
      // Enlace con el catálogo (si la línea salió de un artículo): sirve
      // para mover el stock de almacén al validar el documento.
      ...(l.articulo ? { articulo: l.articulo } : {}),
    }));

  for (const [i, l] of validas.entries()) {
    const donde = `línea ${i + 1} (${l.descripcion.slice(0, 40)})`;
    if (!(l.cantidad > 0)) {
      throw new LineasInvalidasError(`La cantidad de la ${donde} debe ser mayor que cero.`);
    }
    if (!(l.precioUnitario >= 0)) {
      throw new LineasInvalidasError(`El precio de la ${donde} no puede ser negativo (usa una factura rectificativa para devoluciones).`);
    }
    if (!(l.descuento >= 0 && l.descuento <= 100)) {
      throw new LineasInvalidasError(`El descuento de la ${donde} debe estar entre 0 y 100 %.`);
    }
    if (!(l.iva >= 0 && l.iva <= 100)) {
      throw new LineasInvalidasError(`El IVA de la ${donde} debe estar entre 0 y 100 %.`);
    }
  }

  return validas.length > 0 ? validas : null;
}
