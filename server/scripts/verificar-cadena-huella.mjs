/**
 * Verifica la cadena de huellas VeriFactu del tenant demo: cada registro
 * debe encadenar con el inmediatamente anterior (tickets T y facturas A
 * comparten la misma cadena por empresa).
 * Uso: node scripts/verificar-cadena-huella.mjs [slug]
 */
import "dotenv/config";
import { connectDB } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";
import { conexionTenant } from "../src/models/tenant.js";
import "../src/models/RegistroFacturacion.js";

const slug = process.argv[2] || "demo";
await connectDB();
const tenant = await Tenant.findOne({ slug }).lean();
const conn = conexionTenant(tenant.dbName);
const Registro = conn.model("RegistroFacturacion");

const registros = await Registro.find().sort({ _id: 1 }).lean();
let errores = 0;
for (let i = 1; i < registros.length; i++) {
  if (registros[i].huellaAnterior !== registros[i - 1].huella) {
    errores++;
    console.error(
      `ROTO: ${registros[i].numSerieFactura} no encadena con ${registros[i - 1].numSerieFactura}`
    );
  }
}
console.log(
  `${registros.length} registros · cadena ${errores === 0 ? "ÍNTEGRA" : `ROTA (${errores})`}`
);
const conXml = registros.filter((r) => r.xml).length;
console.log(`${conXml} registros con XML AEAT`);
process.exit(errores ? 1 : 0);
