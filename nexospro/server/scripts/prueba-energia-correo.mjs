/* Prueba E2E de la recogida de campañas por correo (Fase 2):
   comprueba los endpoints de configuración del buzón (validación de
   campos, contraseña que no vuelve al navegador, error amigable de
   conexión con credenciales falsas, revisar sin configurar) y que no
   rompe el flujo de campañas existente.
   No usa un buzón real: la parte de IMAP real se prueba al configurar
   el buzón del cliente. Uso: node scripts/prueba-energia-correo.mjs */
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
  nombre: "Prueba correo campanas",
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

try {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  const H = { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` };

  // Estado inicial: sin configurar (o la que haya, pero nunca con password).
  const rCfg0 = await fetch(`${BASE}/api/energia/campanas/correo/config`, { headers: H });
  const cfg0 = await rCfg0.json();
  ok(rCfg0.status === 200, `GET config responde 200 (${rCfg0.status})`);
  ok(!("password" in cfg0) && !("passwordCifrada" in cfg0), "la config no expone la contraseña");
  ok(typeof cfg0.activo === "boolean" && typeof cfg0.carpeta === "string", "la config tiene los campos públicos esperados");

  // Revisar sin buzón activo → mensaje claro, no error 500.
  const rRev0 = await fetch(`${BASE}/api/energia/campanas/correo/revisar`, { method: "POST", headers: H });
  const rev0 = await rRev0.json();
  ok(rRev0.status === 200 && rev0.ok === false && /no está configurado|desactivado/.test(rev0.mensaje ?? ""), `revisar sin configurar devuelve mensaje claro (${rev0.mensaje})`);

  // Guardar config sin usuario → 400.
  const rMal = await fetch(`${BASE}/api/energia/campanas/correo/config`, {
    method: "PUT",
    headers: H,
    body: JSON.stringify({ tipo: "gmail", activo: true }),
  });
  ok(rMal.status === 400, "guardar sin usuario responde 400");

  // Guardar config IMAP sin host → 400.
  const rMal2 = await fetch(`${BASE}/api/energia/campanas/correo/config`, {
    method: "PUT",
    headers: H,
    body: JSON.stringify({ tipo: "imap", usuario: "precios@demo.es", activo: true }),
  });
  ok(rMal2.status === 400, "guardar IMAP sin host responde 400");

  // Guardar una config completa con contraseña falsa: se guarda cifrada y
  // sin activar el sondeo no procesa nada... la guardamos inactiva para no
  // interferir; el estado llega sin contraseña y con passwordGuardada.
  const rGuardar = await fetch(`${BASE}/api/energia/campanas/correo/config`, {
    method: "PUT",
    headers: H,
    body: JSON.stringify({
      tipo: "gmail",
      usuario: "stress.test@filanex.local",
      password: "clave-falsa-1234",
      carpeta: "INBOX",
      activo: false,
    }),
  });
  const cfg1 = await rGuardar.json();
  ok(rGuardar.status === 200, `config guardada (${rGuardar.status})`);
  ok(cfg1.passwordGuardada === true, "la config indica que hay contraseña guardada");
  ok(!("password" in cfg1) && !("passwordCifrada" in cfg1), "la respuesta no contiene la contraseña");
  ok(cfg1.host === "imap.gmail.com", `tipo gmail fuerza el host IMAP (${cfg1.host})`);

  // Probar conexión con credenciales falsas → error amigable (400 con
  // mención de Gmail/contraseña de aplicación), nunca 500.
  const rProbar = await fetch(`${BASE}/api/energia/campanas/correo/probar`, { method: "POST", headers: H });
  const probar = await rProbar.json();
  ok(rProbar.status === 400, `probar con credenciales falsas responde 400 (${rProbar.status})`);
  ok(/Gmail|contraseña|autenticaci/i.test(probar.error ?? ""), `el error explica el problema de Gmail (${(probar.error ?? "").slice(0, 80)})`);

  // La config queda grabada pero inactiva: revisar → mensaje claro.
  const rRev1 = await fetch(`${BASE}/api/energia/campanas/correo/revisar`, { method: "POST", headers: H });
  const rev1 = await rRev1.json();
  ok(rRev1.status === 200 && rev1.ok === false, `revisar con buzón inactivo no intenta conectar (${rev1.mensaje})`);

  // El flujo de campañas sigue intacto: el listado responde.
  const rLista = await fetch(`${BASE}/api/energia/campanas`, { headers: H });
  ok(rLista.status === 200 && Array.isArray(await rLista.json()), "el listado de campañas sigue funcionando");

  // Restablecer: quitar el buzón de prueba (activo=false, sin password no
  // se puede borrar el hash por API; lo dejamos inactivo y sin datos).
  const rLimpiar = await fetch(`${BASE}/api/energia/campanas/correo/config`, {
    method: "PUT",
    headers: H,
    body: JSON.stringify({ tipo: "gmail", usuario: "", activo: false }),
  });
  ok(rLimpiar.status === 400, "guardar sin usuario no permite dejar config basura");
} finally {
  await mongoose.connect(`${uriBase}/filanex_plataforma`);
  const Cuenta2 = (await import("../src/models/plataforma/Cuenta.js")).default;
  await Cuenta2.deleteOne({ email: EMAIL });
  console.log("limpieza: cuenta temporal eliminada");
  await mongoose.disconnect();
}

console.log(fallos === 0 ? "\nTODO CORRECTO" : `\n${fallos} COMPROBACIONES FALLIDAS`);
process.exit(fallos === 0 ? 0 : 1);
