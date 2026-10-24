// Migración de una instalación monolítica (pre-multiempresa) a la
// arquitectura multiempresa:
//   1. Copia de seguridad de la BD actual con mongodump.
//   2. Crea la BD plataforma con el Tenant "local" apuntando a la BD actual.
//   3. Convierte los Usuario en Cuenta (mismo hash: las contraseñas siguen).
//   4. Si había certificado en .env, lo mueve a la ficha de la empresa
//      (contraseña cifrada con CLAVE_CERTS).
// Es idempotente: si el tenant "local" ya existe, avisa y no duplica.
import "dotenv/config";
import mongoose from "mongoose";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { uriBase, nombreBdPlataforma } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";
import Cuenta from "../src/models/plataforma/Cuenta.js";
import { cifrar } from "../src/services/cifrado.js";

const uriAntigua = process.env.MONGODB_URI;
if (!uriAntigua) {
  console.error("Falta MONGODB_URI (la antigua, con base de datos) en server/.env");
  process.exit(1);
}
const bdAntigua = uriAntigua.match(/\/([^/?]+)(\?.*)?$/)?.[1];
if (!bdAntigua) {
  console.error("No se pudo sacar el nombre de la BD de MONGODB_URI");
  process.exit(1);
}
console.log(`BD de negocio actual: ${bdAntigua}`);

// ---- 1. Copia de seguridad ----
const fecha = new Date().toISOString().slice(0, 10);
const dirBackup = path.resolve(process.cwd(), "..", "backups", `pre-multiempresa-${fecha}`);
try {
  fs.mkdirSync(dirBackup, { recursive: true });
  execFileSync("mongodump", ["--db", bdAntigua, "--out", dirBackup], { stdio: "inherit" });
  console.log(`Copia de seguridad en ${dirBackup}`);
} catch {
  console.warn("AVISO: mongodump no disponible; la migración sigue, pero SIN copia de seguridad.");
}

// ---- 2. Tenant local en la BD plataforma ----
await mongoose.connect(`${uriBase()}/${nombreBdPlataforma()}`);
let tenant = await Tenant.findOne({ slug: "local" });
if (tenant) {
  console.log(`El tenant "local" ya existe (BD: ${tenant.dbName}): no se duplica.`);
} else {
  tenant = await Tenant.create({
    slug: "local",
    nombre: "Mi empresa",
    dbName: bdAntigua,
  });
  console.log(`Tenant "local" creado apuntando a ${bdAntigua}.`);
}

// ---- 3. Usuarios → Cuentas ----
const vieja = await mongoose.createConnection(uriAntigua).asPromise();
const usuarios = await vieja.db.collection("usuarios").find({}).toArray();
let creadas = 0;
for (const u of usuarios) {
  const correo = String(u.email ?? "").trim().toLowerCase();
  if (!correo) continue;
  const existe = await Cuenta.findOne({ email: correo });
  if (existe) continue;
  await Cuenta.create({
    nombre: u.nombre ?? correo,
    email: correo,
    passwordHash: u.passwordHash,
    rol: u.rol === "admin" ? "admin" : "usuario",
    tenant: tenant._id,
  });
  creadas++;
}
console.log(`Cuentas creadas: ${creadas} de ${usuarios.length} usuario(s) antiguos.`);

// Nombre del tenant = nombre de la empresa, si existe.
const empresa = await vieja.db.collection("empresas").findOne({});
if (empresa?.nombre && tenant.nombre === "Mi empresa") {
  tenant.nombre = empresa.nombre;
  await tenant.save();
  console.log(`Tenant renombrado a "${empresa.nombre}".`);
}

// ---- 4. Certificado del .env → ficha de la empresa ----
if (process.env.AEAT_CERT_PFX && fs.existsSync(process.env.AEAT_CERT_PFX)) {
  const dirCerts = path.resolve(process.cwd(), "certificados");
  fs.mkdirSync(dirCerts, { recursive: true });
  const destino = path.join(dirCerts, "local-aeat.pfx");
  fs.copyFileSync(process.env.AEAT_CERT_PFX, destino);
  const passCifrada = process.env.AEAT_CERT_PASS ? cifrar(process.env.AEAT_CERT_PASS) : undefined;
  await vieja.db.collection("empresas").updateOne(
    { _id: empresa?._id },
    { $set: { certificado: { ruta: destino, passCifrada } } }
  );
  console.log("Certificado movido a la ficha de la empresa (contraseña cifrada).");
} else {
  console.log("No había certificado en .env: nada que mover.");
}

await vieja.close();
await mongoose.disconnect();
console.log("Migración terminada. Ya puedes entrar con tus credenciales de siempre.");
