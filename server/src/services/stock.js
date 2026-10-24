// Movimientos de stock derivados de documentos de venta.
// Las líneas que enlazan con un artículo (campo `articulo`) mueven su stock;
// las de texto libre no.
import Articulo from "../models/Articulo.js";

// signo -1 = salida (venta/entrega), +1 = entrada (devolución/anulación).
// Los servicios no son mercancía: nunca mueven stock.
export async function moverStock(lineas, signo) {
  const ids = [...new Set(
    (lineas ?? [])
      .filter((l) => l.articulo && Number(l.cantidad) > 0)
      .map((l) => String(l.articulo))
  )];
  if (!ids.length) return;
  const catalogo = await Articulo.find({ _id: { $in: ids } }).select("tipo").lean();
  const esMercancia = new Set(
    catalogo.filter((a) => a.tipo !== "servicio").map((a) => String(a._id))
  );
  await Promise.all(
    (lineas ?? [])
      .filter((l) => l.articulo && esMercancia.has(String(l.articulo)) && Number(l.cantidad) > 0)
      .map((l) =>
        Articulo.findByIdAndUpdate(l.articulo, {
          $inc: { stock: signo * Number(l.cantidad) },
        }).catch(() => null)
      )
  );
}
