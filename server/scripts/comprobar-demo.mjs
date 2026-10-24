// Comprueba la coherencia de los datos de un tenant demo:
//
//   node scripts/comprobar-demo.mjs [slug]
//
// Verifica que los totales cuadren, que no falten referencias obligatorias y
// que los contadores queden por delante de los documentos ya creados, para
// que la aplicación siga numerando sin colisiones.
import mongoose from "mongoose";
import "dotenv/config";
import { conexionTenant, conContexto } from "../src/models/tenant.js";
import { uriBase, nombreBdPlataforma } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";
import Empresa from "../src/models/Empresa.js";
import Cliente from "../src/models/Cliente.js";
import Proveedor from "../src/models/Proveedor.js";
import Presupuesto from "../src/models/Presupuesto.js";
import FacturaVenta from "../src/models/FacturaVenta.js";
import FacturaCompra from "../src/models/FacturaCompra.js";
import PresupuestoCompra from "../src/models/PresupuestoCompra.js";
import PedidoCompra from "../src/models/PedidoCompra.js";
import AlbaranCompra from "../src/models/AlbaranCompra.js";
import OrdenTrabajo from "../src/models/OrdenTrabajo.js";
import OrdenServicio from "../src/models/OrdenServicio.js";
import Valoracion from "../src/models/Valoracion.js";
import Vehiculo from "../src/models/Vehiculo.js";
import Contador from "../src/models/Contador.js";
import { nifValido } from "../src/services/validar-ocr.js";

const fallos = [];
const aviso = (t) => fallos.push(t);

function cuadran(docs, etiqueta) {
  for (const d of docs) {
    const suma = Math.round((d.baseImponible + d.cuotaIva) * 100) / 100;
    if (Math.abs(suma - d.total) > 0.01) {
      aviso(`${etiqueta}: ${d.serieNumero ?? d.numero ?? d._id} descuadra (${d.baseImponible} + ${d.cuotaIva} != ${d.total})`);
    }
  }
}

async function main() {
  const slug = process.argv[2] || "demofilanex";
  await mongoose.connect(`${uriBase()}/${nombreBdPlataforma()}`);
  const tenant = await Tenant.findOne({ slug });
  if (!tenant) throw new Error(`No existe el tenant "${slug}".`);

  await conContexto(
    { conn: conexionTenant(tenant.dbName), slug: tenant.slug, dbName: tenant.dbName },
    async () => {
      const empresa = await Empresa.findOne().lean();

      cuadran(await FacturaVenta.find().lean(), "Factura de venta");
      cuadran(await FacturaCompra.find().lean(), "Factura de compra");
      cuadran(await Presupuesto.find().lean(), "Presupuesto");
      cuadran(await PresupuestoCompra.find().lean(), "Presupuesto de compra");
      cuadran(await PedidoCompra.find().lean(), "Pedido de compra");
      cuadran(await AlbaranCompra.find().lean(), "Albarán de compra");

      // Referencias obligatorias
      if (await FacturaVenta.countDocuments({ cliente: null })) aviso("Hay facturas de venta sin cliente.");
      if (await FacturaCompra.countDocuments({ proveedor: null })) aviso("Hay facturas de compra sin proveedor.");
      if (await FacturaVenta.countDocuments({ estado: "emitida", serieNumero: null })) aviso("Hay facturas emitidas sin número.");
      if (await OrdenTrabajo.countDocuments({ matricula: null })) aviso("Hay órdenes de taller sin matrícula.");
      if (await Valoracion.countDocuments({ matricula: null })) aviso("Hay valoraciones sin matrícula.");

      // NIF con letra de control correcta
      for (const Modelo of [Cliente, Proveedor]) {
        for (const f of await Modelo.find({ nif: { $ne: null } }).lean()) {
          if (!nifValido(f.nif)) aviso(`NIF inválido en ${Modelo.modelName}: ${f.nombre} (${f.nif})`);
        }
      }

      // Los contadores deben quedar por delante de lo ya creado
      const maxFactura = (await FacturaVenta.find({ estado: "emitida" }).lean())
        .reduce((m, f) => Math.max(m, Number(f.numero) || 0), 0);
      const contadorFactura = await Contador.findOne({ clave: "facturaVenta:A" }).lean();
      if ((contadorFactura?.valor ?? 0) < maxFactura) aviso("El contador de facturas va por detrás de las facturas emitidas.");

      const maxOt = (await OrdenTrabajo.find().lean())
        .reduce((m, o) => Math.max(m, Number(String(o.numero).replace(/\D/g, "")) || 0), 0);
      const contadorOt = await Contador.findOne({ clave: "ordenTrabajo" }).lean();
      if ((contadorOt?.valor ?? 0) < maxOt) aviso("El contador de órdenes de taller va por detrás.");

      const maxSat = (await OrdenServicio.find().lean())
        .reduce((m, o) => Math.max(m, Number(String(o.numero).replace(/\D/g, "")) || 0), 0);
      if ((empresa.contadores?.ordenServicio ?? 0) <= maxSat) aviso("El contador de órdenes de servicio va por detrás.");

      const serieV = empresa.seriesVenta?.[0];
      const serieC = empresa.seriesCompra?.[0];
      if (!serieV) aviso("La empresa no tiene serie de venta.");
      if (!serieC) aviso("La empresa no tiene serie de compra.");
      if (serieV && serieV.proxFactura <= maxFactura) aviso("La serie de venta numeraría una factura ya existente.");

      // Matrículas duplicadas
      const matriculas = (await Vehiculo.find().select("matricula").lean()).map((v) => v.matricula);
      if (new Set(matriculas).size !== matriculas.length) aviso("Hay matrículas duplicadas.");

      console.log(`Comprobación de ${tenant.dbName} (${tenant.nombre}):`);
      if (fallos.length === 0) {
        console.log("  Todo correcto: totales cuadrados, referencias completas y contadores por delante.");
      } else {
        for (const f of fallos) console.log(`  AVISO  ${f}`);
      }
    }
  );

  await mongoose.disconnect();
  process.exit(fallos.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
