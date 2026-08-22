// Numeración de documentos por series (pantalla Sistema → Series).
// Formato emitido: `${nombre}-${n}` (ej. A-12). Si la empresa aún no
// tiene series nuevas, se migran sobre la marcha desde los campos
// antiguos (series / contadores) para no romper instalaciones en uso.

const CAMPOS = {
  presupuestoVenta: { lista: "seriesVenta", campo: "proxPresupuesto" },
  albaranVenta: { lista: "seriesVenta", campo: "proxAlbaran" },
  facturaVenta: { lista: "seriesVenta", campo: "proxFactura" },
  presupuestoCompra: { lista: "seriesCompra", campo: "proxPresupuesto" },
  pedidoCompra: { lista: "seriesCompra", campo: "proxPedido" },
  albaranCompra: { lista: "seriesCompra", campo: "proxAlbaran" },
};

// Rellena seriesVenta / seriesCompra a partir de los datos antiguos si
// están vacías. Funciona tanto sobre el documento Mongoose como sobre
// un objeto plano. Devuelve true si ha tocado algo.
export function asegurarSeries(empresa) {
  let tocado = false;
  const contadores = empresa.contadores ?? {};

  if (!Array.isArray(empresa.seriesVenta) || empresa.seriesVenta.length === 0) {
    const antiguas = Array.isArray(empresa.series) ? empresa.series : [];
    empresa.seriesVenta =
      antiguas.length > 0
        ? antiguas.map((s, i) => ({
            // El prefijo antiguo (ej. "A-") manda sobre el nombre ("General").
            nombre: (s.prefijo ? String(s.prefijo).replace(/-+$/, "") : "") || s.nombre,
            defecto: i === 0,
            proxPresupuesto: contadores.presupuesto ?? 1,
            proxAlbaran: contadores.albaranVenta ?? 1,
            proxFactura: s.siguienteNumero ?? 1,
          }))
        : [
            {
              nombre: "A",
              defecto: true,
              proxPresupuesto: contadores.presupuesto ?? 1,
              proxAlbaran: contadores.albaranVenta ?? 1,
              proxFactura: 1,
            },
          ];
    tocado = true;
  }

  if (!Array.isArray(empresa.seriesCompra) || empresa.seriesCompra.length === 0) {
    empresa.seriesCompra = [
      {
        nombre: "C",
        defecto: true,
        proxPresupuesto: contadores.presupuestoCompra ?? 1,
        proxPedido: contadores.pedidoCompra ?? 1,
        proxAlbaran: contadores.albaranCompra ?? 1,
      },
    ];
    tocado = true;
  }

  return tocado;
}

// Toma el siguiente número del tipo dado usando la serie por defecto e
// incrementa el contador en memoria. NO guarda: el llamador hace save().
// Devuelve { serie, numero, serieNumero } (ej. { serie: "A", numero: 12, serieNumero: "A-12" }).
export function tomarNumero(empresa, tipo) {
  const cfg = CAMPOS[tipo];
  if (!cfg) throw new Error(`Tipo de numeración desconocido: ${tipo}`);
  asegurarSeries(empresa);
  const lista = empresa[cfg.lista];
  const serie = lista.find((s) => s.defecto) ?? lista[0];
  const numero = serie[cfg.campo] ?? 1;
  serie[cfg.campo] = numero + 1;
  return { serie: serie.nombre, numero, serieNumero: `${serie.nombre}-${numero}` };
}
