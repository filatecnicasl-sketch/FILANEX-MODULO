import "dotenv/config";
import { connectDB } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";

await connectDB();
const t = await Tenant.findOne({ slug: "demomontiel" });
if (!t) { console.error("no existe"); process.exit(1); }
console.log("antes:", t.estado, "plan:", t.plan, "modulos:", JSON.stringify(t.modulos));
t.estado = "demo";
await t.save();
console.log("despues:", t.estado);
process.exit(0);
