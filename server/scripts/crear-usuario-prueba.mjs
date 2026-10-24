/* Crea una cuenta de administrador temporal en la base de datos local
   para poder ejecutar pruebas de estrés autenticadas.
   Uso: node scripts/crear-usuario-prueba.mjs
   Al finalizar las pruebas, ejecútalo con --borrar para eliminar la cuenta. */

import mongoose from "mongoose";
import "dotenv/config";
import Tenant from "../src/models/plataforma/Tenant.js";
import Cuenta from "../src/models/plataforma/Cuenta.js";
import { hashContrasena } from "../src/routes/usuarios.js";

const EMAIL = "stress.test@filanex.local";
const PASSWORD = "StressTest123!";

async function main() {
  const borrar = process.argv.includes("--borrar");
  const uriBase = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
  const bdPlataforma = process.env.BD_PLATAFORMA || "filanex_plataforma";
  await mongoose.connect(`${uriBase}/${bdPlataforma}`);

  if (borrar) {
    const res = await Cuenta.deleteOne({ email: EMAIL });
    console.log(res.deletedCount ? "Cuenta temporal eliminada." : "No había cuenta temporal.");
    await mongoose.disconnect();
    return;
  }

  let tenant = await Tenant.findOne({ slug: "local" });
  if (!tenant) {
    tenant = await Tenant.findOne();
  }
  if (!tenant) {
    console.error("No se encontró ningún tenant.");
    await mongoose.disconnect();
    process.exit(1);
  }

  await Cuenta.deleteOne({ email: EMAIL }); // por si existía de antes
  await Cuenta.create({
    nombre: "Usuario pruebas estrés",
    email: EMAIL,
    passwordHash: hashContrasena(PASSWORD),
    rol: "admin",
    tenant: tenant._id,
  });

  console.log(`Cuenta temporal creada:`);
  console.log(`  Email: ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Tenant: ${tenant.slug} (${tenant.dbName})`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
