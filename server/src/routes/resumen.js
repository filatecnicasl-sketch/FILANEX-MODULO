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

    // Dinero realmente cobrado hoy y este mes (facturas y tickets TPV).
    // Los cobros se leen de cada documento: en el TPV se registran al cobrar
    // y las devoluciones (R5) llevan importe negativo, así que restan solas.
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const vacio = () => ({ total: 0, efectivo: 0, tarjeta: 0, otros: 0, tpv: 0 });
    const cobradoHoy = vacio();
    const cobradoMes = vacio();
    let ticketsHoy = 0;
    for (const f of emitidas) {
      const esTpv = f.tipoFactura === "F2";
      for (const c of f.cobros ?? []) {
        const fecha = c.fecha ? new Date(c.fecha) : null;
        if (!fecha || !(c.importe ?? 0)) continue;
        const destinos = [];
        if (fecha >= inicioHoy) destinos.push(cobradoHoy);
        if (fecha >= inicioMes) destinos.push(cobradoMes);
        for (const d of destinos) {
          d.total = redondear(d.total + c.importe);
          if (c.metodo === "efectivo") d.efectivo = redondear(d.efectivo + c.importe);
          else if (c.metodo === "tarjeta") d.tarjeta = redondear(d.tarjeta + c.importe);
          else d.otros = redondear(d.otros + c.importe);
          if (esTpv) d.tpv = redondear(d.tpv + c.importe);
        }
        if (esTpv && fecha >= inicioHoy && c.importe > 0) ticketsHoy += 1;
      }
    }

    res.json({
      facturado: { total: redondear(facturado), count: emitidas.length },
      pendienteCobro: redondear(pendienteCobro),
      gastos: { total: redondear(gastos), count: compras.length },
      pendientePago: redondear(pendientePago),
      cobradoHoy,
      cobradoMes,
      ticketsHoy,
      contadores: { clientes, proveedores, articulos, pedidos, albaranes },
      mensual: meses,
      ultimasFacturas,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
