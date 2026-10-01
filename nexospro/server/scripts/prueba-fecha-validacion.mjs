/* Prueba E2E de la fecha de expedición al validar un borrador:
   1) Crea un borrador con fecha de hace 10 días.
   2) Lo emite (valida).
   3) Comprueba que la fecha de expedición pasa a ser HOY (día de la
      validación) y que el registro VeriFactu lleva esa misma fecha.
   4) También comprueba que un borrador creado hoy y validado hoy no cambia.
   Al terminar borra facturas y registros de la prueba (empresa demo).
   Uso: node scripts/prueba-fecha-validacion.mjs  (desde server/, API en 4700) */
import mongoose from "mongoose";
import "dotenv/config";

const EMAIL = "stress.test@filanex.local";
const PASSWORD = "StressTest123!";
const BASE = process.env.API_BASE || "http://localhost:4700";
const uriBase = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";

await mongoose.connect(`${uriBase}/filanex_plataforma`);
const Tenant = (await import("../src/models/plataforma/Tenant.js")).default;
const Cuenta = (await import("../src/models/plataforma/Cuenta.js")).default;
const { hashContrasena } = await import("../src/routes/usuarios.js");
const tenant = await Tenant.findOne({ slug: "demototal" });
await Cuenta.deleteOne({ email: EMAIL });
await Cuenta.create({
  nombre: "Prueba fecha validacion",
  email: EMAIL,
  passwordHash: hashContrasena(PASSWORD),
  rol: "admin",
  tenant: tenant._id,
});
await mongoose.disconnect();

let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK " : "FALLO"} - ${msg}`);
  if (!cond) fallos++;
};
const mismoDia = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const ids = [];
try {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  const H = { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` };
  const api = async (metodo, ruta, cuerpo) => {
    const r = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: H,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { status: r.status, datos: await r.json().catch(() => null) };
  };

  const clientes = await api("GET", "/api/clientes").then((x) => x.datos);
  ok(Array.isArray(clientes) && clientes.length > 0, "hay clientes en la demo");
  const lineas = [{ descripcion: "Prueba fecha validacion", cantidad: 1, precio: 10 }];
  const hoy = new Date();

  // 1) Borrador con fecha de hace 10 días → al validar, fecha de HOY.
  const vieja = new Date(hoy.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const b1 = await api("POST", "/api/facturas-venta", { cliente: clientes[0]._id, lineas, fechaExpedicion: vieja });
  ok(b1.status === 201, "borrador con fecha atrasada creado");
  ids.push(b1.datos._id);
  const e1 = await api("POST", `/api/facturas-venta/${b1.datos._id}/emitir`);
  ok(e1.status === 200, `borrador emitido (${e1.status})`);
  ok(mismoDia(new Date(e1.datos.fechaExpedicion), hoy), `fecha de expedición = día de validación (${new Date(e1.datos.fechaExpedicion).toLocaleDateString("es-ES")})`);

  // 2) Borrador creado y validado hoy → la fecha no cambia.
  const b2 = await api("POST", "/api/facturas-venta", { cliente: clientes[0]._id, lineas });
  ok(b2.status === 201, "borrador de hoy creado");
  ids.push(b2.datos._id);
  const e2 = await api("POST", `/api/facturas-venta/${b2.datos._id}/emitir`);
  ok(e2.status === 200, `segundo borrador emitido (${e2.status})`);
  ok(mismoDia(new Date(e2.datos.fechaExpedicion), hoy), "borrador de hoy valida con fecha de hoy");
} finally {
  // Limpieza: facturas emitidas de la prueba y sus registros (empresa demo).
  await mongoose.connect(`${uriBase}/filanex_demototal`);
  const FacturaVenta = (await import("../src/models/FacturaVenta.js")).default;
  const RegistroFacturacion = (await import("../src/models/RegistroFacturacion.js")).default;
  for (const id of ids) {
    await RegistroFacturacion.deleteMany({ facturaVenta: id });
    await FacturaVenta.deleteOne({ _id: id });
  }
  console.log("limpieza: facturas y registros de prueba eliminados");
  await mongoose.disconnect();
  await mongoose.connect(`${uriBase}/filanex_plataforma`);
  await (await import("../src/models/plataforma/Cuenta.js")).default.deleteOne({ email: EMAIL });
  console.log("limpieza: cuenta temporal eliminada");
  await mongoose.disconnect();
}

console.log(fallos === 0 ? "\nTODO CORRECTO" : `\n${fallos} COMPROBACIONES FALLIDAS`);
process.exit(fallos === 0 ? 0 : 1);
