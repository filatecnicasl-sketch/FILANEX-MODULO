import mongoose from "mongoose";
import crypto from "node:crypto";
import "dotenv/config";
import Cuenta from "../src/models/plataforma/Cuenta.js";
import Tenant from "../src/models/plataforma/Tenant.js";
import { hashContrasena } from "../src/routes/usuarios.js";

const base = process.argv[2] || "http://127.0.0.1:4700";
const password = `Audit-${crypto.randomBytes(12).toString("hex")}`;
const prefijo = `audit.${Date.now()}`;
const creadas = [];

function ok(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
  console.log(`OK   ${mensaje}`);
}

async function login(email) {
  const respuesta = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const datos = await respuesta.json();
  ok(respuesta.ok && datos.token, `Login temporal de ${email}`);
  return datos.token;
}

async function get(ruta, token) {
  const respuesta = await fetch(`${base}${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const datos = await respuesta.json();
  ok(respuesta.ok, `${ruta} responde ${respuesta.status}`);
  return datos;
}

async function main() {
  const uri = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";
  const plataforma = process.env.BD_PLATAFORMA || "filanex_plataforma";
  await mongoose.connect(`${uri}/${plataforma}`);
  const tenants = await Tenant.find({ estado: { $nin: ["inactivo", "suspendido"] } })
    .sort({ slug: 1 })
    .limit(2);
  ok(tenants.length === 2, "Hay dos empresas activas para comprobar aislamiento");

  for (const [indice, tenant] of tenants.entries()) {
    const email = `${prefijo}.${indice}@filanex.local`;
    const cuenta = await Cuenta.create({
      nombre: `Auditoría aislamiento ${indice + 1}`,
      email,
      passwordHash: hashContrasena(password),
      rol: "usuario",
      tenant: tenant._id,
    });
    creadas.push(cuenta._id);
  }

  const tokenA = await login(`${prefijo}.0@filanex.local`);
  const tokenB = await login(`${prefijo}.1@filanex.local`);
  const meA = await get("/api/auth/me", tokenA);
  const meB = await get("/api/auth/me", tokenB);
  ok(meA.empresa !== meB.empresa, `Tokens pertenecen a empresas distintas (${meA.empresa} / ${meB.empresa})`);

  const clientesA = await get("/api/clientes", tokenA);
  const clientesB = await get("/api/clientes", tokenB);
  const idsA = new Set(clientesA.map((cliente) => String(cliente._id)));
  const compartidos = clientesB.filter((cliente) => idsA.has(String(cliente._id)));
  ok(compartidos.length === 0, "Ningún cliente de una empresa aparece en la otra");

  const tokenAAnterior = tokenA;
  const tokenANuevo = await login(`${prefijo}.0@filanex.local`);
  const sesionAnterior = await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tokenAAnterior}` },
  });
  const sesionNueva = await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tokenANuevo}` },
  });
  ok(sesionAnterior.status === 401 && sesionNueva.ok, "El segundo login invalida la sesión anterior del mismo usuario");
}

try {
  await main();
  console.log("\nAislamiento práctico correcto.");
} finally {
  if (creadas.length) await Cuenta.deleteMany({ _id: { $in: creadas } });
  await mongoose.disconnect();
}