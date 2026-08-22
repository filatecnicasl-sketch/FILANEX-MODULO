import { Router } from "express";
import FacturaVenta from "../models/FacturaVenta.js";
import FacturaCompra from "../models/FacturaCompra.js";
import Cliente from "../models/Cliente.js";
import Proveedor from "../models/Proveedor.js";
import Articulo from "../models/Articulo.js";
import PedidoCompra from "../models/PedidoCompra.js";
import AlbaranVenta from "../models/AlbaranVenta.js";

const router = Router();

const redondear = (n) => Math.round(n * 100) / 100;

// Panel global (se abre desde el logo): dinero, contadores,
// facturación mensual y últimas facturas emitidas.
router.get("/", async (req, res, next) => {
  try {
    const [emitidas, compras, clientes, proveedores, articulos, pedidos, albaranes] =
      await Promise.all([
        FacturaVenta.find({ estado: "emitida" }).populate("cliente", "nombre"),
        FacturaCompra.find({ estado: "validada" }),
        Cliente.countDocuments(),
        Proveedor.countDocuments(),
        Articulo.countDocuments(),
        PedidoCompra.countDocuments(),
        AlbaranVenta.countDocuments(),
      ]);

    const facturado = emitidas.reduce((s, f) => s + (f.total ?? 0), 0);
    const pendienteCobro = emitidas.reduce(
      (s, f) => s + Math.max(0, (f.total ?? 0) - f.cobrado()),
      0
    );
    const gastos = compras.reduce((s, f) => s + (f.total ?? 0), 0);
    const pendientePago = compras.reduce(
      (s, f) => s + Math.max(0, (f.total ?? 0) - f.pagado()),
      0
    );

    // Facturación de los últimos 6 meses (incluido el actual).
    const meses = [];
    const ahora = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      meses.push({
        clave: `${d.getFullYear()}-${d.getMonth()}`,
        etiqueta: d.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
        total: 0,
      });
    }
    for (const f of emitidas) {
      const fecha = f.fechaExpedicion ?? f.createdAt;
      if (!fecha) continue;
      const d = new Date(fecha);
      const mes = meses.find((m) => m.clave === `${d.getFullYear()}-${d.getMonth()}`);
      if (mes) mes.total += f.total ?? 0;
    }
    for (const m of meses) m.total = redondear(m.total);

    const ultimasFacturas = [...emitidas]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((f) => ({
        numero: f.numero,
        cliente: f.cliente?.nombre ?? "—",
        total: f.total ?? 0,
        estadoCobro: f.estadoCobro(),
      }));

    res.json({
      facturado: { total: redondear(facturado), count: emitidas.length },
      pendienteCobro: redondear(pendienteCobro),
      gastos: { total: redondear(gastos), count: compras.length },
      pendientePago: redondear(pendientePago),
      contadores: { clientes, proveedores, articulos, pedidos, albaranes },
      mensual: meses,
      ultimasFacturas,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
