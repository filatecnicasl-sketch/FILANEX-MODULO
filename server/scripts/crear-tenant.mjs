// Alta de una empresa cliente en la plataforma (modo nube).
// Crea el Tenant (con su base de datos vacía) y su cuenta de administrador.
// En su primer acceso, el asistente de configuración le guía para dar de
// alta los datos fiscales, series, módulos y certificado.
//
// Uso:
//   node scripts/crear-tenant.mjs <slug> "<nombre>" <email> <contraseña>
// Ejemplo:
//   node scripts/crear-tenant.mjs taller-perez "Taller Pérez S.L." admin@tallerperez.es clave123
import "dotenv/config";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { uriBase, nombreBdPlataforma, prefijoBd } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";
import Cuenta from "../src/models/plataforma/Cuenta.js";

const [slug, nombre, email, password] = process.argv.slice(2);

if (!slug || !nombre || !email || !password) {
  console.error('Uso: node scripts/crear-tenant.mjs <slug> "<nombre>" <email> <contraseña>');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error("El slug solo puede tener minúsculas, números y guiones");
  process.exit(1);
}
if (String(password).length < 6) {
  console.error("La contraseña debe tener al menos 6 caracteres");
  process.exit(1);
}

await mongoose.connect(`${uriBase()}/${nombreBdPlataforma()}`);

if (await Tenant.findOne({ $or: [{ slug }, { dbName: `${prefijoBd()}${slug}` }] })) {
  console.error(`Ya existe una empresa con slug "${slug}"`);
  process.exit(1);
}
const correo = email.trim().toLowerCase();
if (await Cuenta.findOne({ email: correo })) {
  console.error(`Ya existe una cuenta con el email ${correo}`);
  process.exit(1);
}

const tenant = await Tenant.create({
  slug,
  nombre: nombre.trim(),
  dbName: `${prefijoBd()}${slug}`,
});
const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
await Cuenta.create({
  nombre: nombre.trim(),
  email: correo,
  passwordHash: `${salt}:${hash}`,
  rol: "admin",
  tenant: tenant._id,
});

console.log(`Empresa creada:`);
console.log(`  slug:   ${tenant.slug}`);
console.log(`  BD:     ${tenant.dbName}`);
console.log(`  admin:  ${correo}`);
console.log("En su primer acceso verá el asistente de configuración inicial.");
await mongoose.disconnect();
