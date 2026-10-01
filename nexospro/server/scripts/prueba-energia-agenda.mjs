/* Prueba de la agenda automática (ventana 7-10 meses desde el alta) contra un
   servidor en marcha. Pone a un suministro del demo fechaAlta de hace 8
   meses, comprueba que aparece en la agenda con sus meses y su aniversario,
   y también los límites de la ventana (6 meses no, 11 no). Restaura la fecha
   original al terminar.
   Uso: node scripts/prueba-energia-agenda.mjs  (desde server/, API en 4700) */
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
  nombre: "Prueba agenda",
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

let original = null;
let idSuministro = null;
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

  const suministros = await api("GET", "/api/energia/suministros").then((x) => x.datos);
  const s = suministros.find((x) => x.estado === "activo");
  idSuministro = s._id;
  original = s.fechaAlta ?? null;

  const hace = (m) => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - m, 15).toISOString().slice(0, 10);
  };

  // Dentro de la ventana: 8 meses.
  await api("PUT", `/api/energia/suministros/${s._id}`, { fechaAlta: hace(8) });
  let agenda = await api("GET", "/api/energia/alertas").then((x) => x.datos);
  let hit = agenda.porAntiguedad.find((r) => String(r._id) === String(s._id));
  ok(!!hit, "suministro con 8 meses de alta aparece en la agenda");
  ok(hit?.meses === 8, `meses calculados (${hit?.meses} = 8)`);
  ok(hit?.faltanMeses === 4, `meses que faltan (${hit?.faltanMeses} = 4)`);
  const aniv = new Date(hit?.aniversario);
  const esperado = new Date(new Date(hace(8)).setFullYear(new Date(hace(8)).getFullYear() + 1));
  ok(aniv.getFullYear() === esperado.getFullYear() && aniv.getMonth() === esperado.getMonth(), "aniversario = alta + 12 meses");
  ok(agenda.total === agenda.renovaciones.length + agenda.porAntiguedad.length + agenda.estudiosSinRespuesta.length, "el total suma las tres secciones");

  // Fuera de la ventana por abajo: 6 meses.
  await api("PUT", `/api/energia/suministros/${s._id}`, { fechaAlta: hace(6) });
  agenda = await api("GET", "/api/energia/alertas").then((x) => x.datos);
  ok(!agenda.porAntiguedad.find((r) => String(r._id) === String(s._id)), "con 6 meses aún no aparece (la ventana empieza en 7)");

  // Fuera por arriba: 11 meses.
  await api("PUT", `/api/energia/suministros/${s._id}`, { fechaAlta: hace(11) });
  agenda = await api("GET", "/api/energia/alertas").then((x) => x.datos);
  ok(!agenda.porAntiguedad.find((r) => String(r._id) === String(s._id)), "con 11 meses ya no aparece (la ventana acaba en 10)");

  // Extremo: 10 meses sí.
  await api("PUT", `/api/energia/suministros/${s._id}`, { fechaAlta: hace(10) });
  agenda = await api("GET", "/api/energia/alertas").then((x) => x.datos);
  hit = agenda.porAntiguedad.find((r) => String(r._id) === String(s._id));
  ok(!!hit && hit.meses === 10, "con 10 meses aparece (último mes de la ventana)");
} finally {
  await mongoose.connect(`${uriBase}/filanex_demototal`);
  const Suministro = (await import("../src/models/Suministro.js")).default;
  if (idSuministro) {
    const originalFecha = original ? new Date(original) : null;
    await Suministro.updateOne(
      { _id: idSuministro },
      originalFecha ? { $set: { fechaAlta: originalFecha } } : { $unset: { fechaAlta: "" } }
    );
    console.log("limpieza: fecha de alta restaurada");
  }
  await mongoose.disconnect();
  await mongoose.connect(`${uriBase}/filanex_plataforma`);
  await (await import("../src/models/plataforma/Cuenta.js")).default.deleteOne({ email: EMAIL });
  console.log("limpieza: cuenta temporal eliminada");
  await mongoose.disconnect();
}

console.log(fallos === 0 ? "\nTODO CORRECTO" : `\n${fallos} COMPROBACIONES FALLIDAS`);
process.exit(fallos === 0 ? 0 : 1);
