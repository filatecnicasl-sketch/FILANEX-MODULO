import mongoose from "mongoose";
import "dotenv/config";
import { conexionTenant, conContexto } from "../src/models/tenant.js";
import { uriBase, nombreBdPlataforma } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";
import Empresa from "../src/models/Empresa.js";

await mongoose.connect(`${uriBase()}/${nombreBdPlataforma()}`);
const t = await Tenant.findOne({ slug: "demomontiel" });
if (!t) { console.error("no existe"); process.exit(1); }

const contexto = { conn: conexionTenant(t.dbName), slug: t.slug, dbName: t.dbName };
await conContexto(contexto, async () => {
  const ya = await Empresa.findOne();
  if (ya) { console.log("ya tiene ficha:", ya.nombre); process.exit(0); }
  const emp = await Empresa.create({
    nombre: "DEMO TALLER MONTIEL S.L.",
    nif: "B11999001",
    telefono: "956000001",
    email: "demo@montiel.es",
    direccion: { calle: "Polígono Industrial Demo, Nave 1", cp: "11100", ciudad: "San Fernando", provincia: "Cádiz" },
    moduloInicio: "panel",
  });
  console.log("ficha creada:", emp.nombre);
});
await mongoose.disconnect();
process.exit(0);
