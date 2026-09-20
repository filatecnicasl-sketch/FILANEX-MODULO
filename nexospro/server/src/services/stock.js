// Movimientos de stock derivados de documentos de venta.
// Las líneas que enlazan con un artículo (campo `articulo`) mueven su stock;
// las de texto libre no.
import Articulo from "../models/Articulo.js";

// signo -1 = salida (venta/entrega), +1 = entrada (devolución/anulación).
export async function moverStock(lineas, signo) {
  const ops = (lineas ?? [])
    .filter((l) => l.articulo && Number(l.cantidad) > 0)
    .map((l) =>
      Articulo.findByIdAndUpdate(l.articulo, {
        $inc: { stock: signo * Number(l.cantidad) },
      }).catch(() => null)
    );
  await Promise.all(ops);
}
