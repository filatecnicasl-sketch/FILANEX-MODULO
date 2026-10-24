// Baja de una empresa cliente: borra su base de datos de negocio, sus
// cuentas y su registro de la plataforma. IRREVERSIBLE: hacer copia antes.
//
// Uso: node scripts/borrar-tenant.mjs <slug>
import "dotenv/config";
import mongoose from "mongoose";
import { uriBase, nombreBdPlataforma } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";
import Cuenta from "../src/models/plataforma/Cuenta.js";

const [slug] = process.argv.slice(2);
if (!slug) {
  console.error("Uso: node scripts/borrar-tenant.mjs <slug>");
  process.exit(1);
}

await mongoose.connect(`${uriBase()}/${nombreBdPlataforma()}`);
const tenant = await Tenant.findOne({ slug });
if (!tenant) {
  console.error(`No existe ninguna empresa con slug "${slug}"`);
  process.exit(1);
}

const cuentas = await Cuenta.deleteMany({ tenant: tenant._id });
const conn = mongoose.connection.useDb(tenant.dbName, { useCache: true });
await conn.dropDatabase();
await Tenant.deleteOne({ _id: tenant._id });

console.log(`Empresa "${slug}" eliminada: BD ${tenant.dbName} borrada y ${cuentas.deletedCount} cuenta(s).`);
await mongoose.disconnect();
