/**
 * Lista los tenants de la plataforma (slug, nombre, estado).
 * Uso: node scripts/listar-tenants.mjs
 */
import "dotenv/config";
import { connectDB } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";

await connectDB();
const tenants = await Tenant.find().select("slug nombre estado plan").lean();
console.log(JSON.stringify(tenants, null, 2));
process.exit(0);
