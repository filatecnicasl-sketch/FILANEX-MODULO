/**
 * Limpia los datos TPV del tenant demo (registros huérfanos de las primeras
 * ejecuciones fallidas, facturas F2 y el contador de la serie T) para
 * regenerar la numeración correlativa T-1, T-2…
 * Uso: node scripts/limpiar-tpv-demo.mjs
 */
import "dotenv/config";
import { connectDB } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";
import { conexionTenant } from "../src/models/tenant.js";
import "../src/models/RegistroFacturacion.js";
import "../src/models/FacturaVenta.js";

const slug = process.argv[2] || "demo";

await connectDB();
const tenant = await Tenant.findOne({ slug }).lean();
if (!tenant) throw new Error(`No existe el tenant "${slug}"`);

const conn = conexionTenant(tenant.dbName);
const Registro = conn.model("RegistroFacturacion");
const Factura = conn.model("FacturaVenta");
const contadores = conn.collection("contadors");

const r1 = await Registro.deleteMany({ $or: [{ facturaVenta: null }, { empresa: null }] });
const r2 = await Registro.deleteMany({ numSerieFactura: /^T-/ });
const r3 = await Factura.deleteMany({ tipoFactura: "F2" });
const r4 = await contadores.deleteMany({ clave: "facturaVenta:T" });

console.log("Limpieza TPV demo:", {
  registrosHuerfanos: r1.deletedCount,
  registrosSerieT: r2.deletedCount,
  facturasF2: r3.deletedCount,
  contadorT: r4.deletedCount,
});
process.exit(0);
