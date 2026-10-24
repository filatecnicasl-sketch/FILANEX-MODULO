import mongoose from "mongoose";
import "dotenv/config";
import { conexionTenant, conContexto } from "../src/models/tenant.js";
import { uriBase, nombreBdPlataforma } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";
import OrdenTrabajo from "../src/models/OrdenTrabajo.js";
import Presupuesto from "../src/models/Presupuesto.js";
import FacturaVenta from "../src/models/FacturaVenta.js";

function firmaLinea(linea) {
  return [
    String(linea.descripcion ?? "").trim().toLowerCase(),
    Number(linea.cantidad ?? 0),
    Number(linea.precioUnitario ?? 0),
    Number(linea.descuento ?? 0),
    Number(linea.iva ?? 0),
  ].join("|");
}

async function main() {
  const slug = process.argv[2] || "demofilanex";
  const aplicar = process.argv.includes("--aplicar");
  await mongoose.connect(`${uriBase()}/${nombreBdPlataforma()}`);
  const tenant = await Tenant.findOne({ slug }).lean();
  if (!tenant) throw new Error(`No existe el tenant ${slug}`);

  await conContexto(
    { conn: conexionTenant(tenant.dbName), slug: tenant.slug, dbName: tenant.dbName },
    async () => {
      const orden = await OrdenTrabajo.findOne({ numero: "OT-000016", matricula: "2507 PSX" });
      const presupuestos = await Presupuesto.find({ serieNumero: { $in: ["A-10", "A-15"] } });
      const factura = orden?.factura ? await FacturaVenta.findById(orden.factura) : null;
      if (!orden || presupuestos.length !== 2 || !factura) {
        throw new Error("No coinciden la orden, los dos presupuestos y la factura esperados");
      }
      if (Math.abs(Number(factura.total) - 635.89) > 0.01) {
        throw new Error(`La factura vinculada no suma 635,89 € sino ${factura.total}`);
      }
      const lineasOrden = new Set(orden.lineas.map(firmaLinea));
      const lineasFactura = new Set(factura.lineas.map(firmaLinea));
      for (const presupuesto of presupuestos) {
        for (const linea of presupuesto.lineas) {
          const firma = firmaLinea(linea);
          if (!lineasOrden.has(firma) || !lineasFactura.has(firma)) {
            throw new Error(`La línea "${linea.descripcion}" de ${presupuesto.serieNumero} no coincide en OT y factura`);
          }
        }
      }

      const ids = presupuestos.map((p) => p._id);
      console.log(JSON.stringify({
        modo: aplicar ? "aplicar" : "diagnostico",
        orden: orden.numero,
        presupuestos: presupuestos.map((p) => `${p.serieNumero}:${p.estado}`),
        factura: `${factura._id}:${factura.total}`,
      }, null, 2));
      if (!aplicar) return;

      orden.presupuesto = ids[0];
      orden.presupuestoNumero = presupuestos[0].serieNumero;
      orden.presupuestos = ids;
      orden.presupuestosNumeros = presupuestos.map((p) => p.serieNumero);
      await orden.save();

      factura.origen.presupuesto = ids[0];
      factura.origen.presupuestos = ids;
      factura.origen.ordenTrabajo = orden._id;
      await factura.save();

      await Presupuesto.updateMany(
        { _id: { $in: ids } },
        { estado: "facturado", facturaVenta: factura._id }
      );
      console.log("REPARACION_OK");
    }
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});