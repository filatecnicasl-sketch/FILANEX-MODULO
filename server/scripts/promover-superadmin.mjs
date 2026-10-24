// Activa o desactiva el flag superadmin de una cuenta.
// Uso: node scripts/promover-superadmin.mjs <email> [true|false]
import "dotenv/config";
import mongoose from "mongoose";
import Cuenta from "../src/models/plataforma/Cuenta.js";
import { uriBase, nombreBdPlataforma } from "../src/config/db.js";

const email = String(process.argv[2] ?? "").trim().toLowerCase();
const valor = String(process.argv[3] ?? "true").toLowerCase() !== "false";
if (!email || !email.includes("@")) {
  console.error("Uso: node scripts/promover-superadmin.mjs <email> [true|false]");
  process.exit(1);
}

await mongoose.connect(`${uriBase()}/${nombreBdPlataforma()}`);

const cuenta = await Cuenta.findOneAndUpdate(
  { email },
  { superadmin: valor },
  { new: true }
);

if (!cuenta) {
  console.error(`No se encontró la cuenta ${email}`);
  await mongoose.disconnect();
  process.exit(1);
}

console.log(`Cuenta ${cuenta.email} (${cuenta.nombre}): superadmin = ${cuenta.superadmin}.`);
await mongoose.disconnect();
