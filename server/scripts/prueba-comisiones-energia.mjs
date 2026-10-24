/* Prueba funcional de la API de comisiones de energía contra un servidor
   en marcha. Crea una cuenta temporal en el tenant demototal y comprueba:
   generación del mes, idempotencia al regenerar, resumen, cobro y deshacer,
   alta manual, rechazo de duplicados y borrado. Las comisiones generadas del
   mes se quedan (son datos demo útiles); la prueba borra solo lo suyo.
   Uso: node scripts/prueba-comisiones-energia.mjs  (desde server/, con el API en 4700) */
import mongoose from "mongoose";
import "dotenv/config";

const EMAIL = "stress.test@filanex.local";
const PASSWORD = "StressTest123!";
const BASE = process.env.API_BASE || "http://localhost:4700";
const PERIODO = "2026-10";

const uriBase = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";

// --- 1. Cuenta temporal en el tenant demototal ---
await mongoose.connect(`${uriBase}/filanex_plataforma`);
const Tenant = (await import("../src/models/plataforma/Tenant.js")).default;
const Cuenta = (await import("../src/models/plataforma/Cuenta.js")).default;
const { hashContrasena } = await import("../src/routes/usuarios.js");
const tenant = await Tenant.findOne({ slug: "demototal" });
if (!tenant) throw new Error("No existe el tenant demototal");
await Cuenta.deleteOne({ email: EMAIL });
await Cuenta.create({
  nombre: "Prueba comisiones",
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

let manualId = null;
try {
  // --- 2. Login ---
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  if (!login.token) throw new Error("Login sin token: " + JSON.stringify(login));
  const H = { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` };
  const api = async (metodo, ruta, cuerpo) => {
    const r = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: H,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { status: r.status, datos: await r.json().catch(() => null) };
  };

  // --- 3. Generar el mes ---
  const gen1 = await api("POST", "/api/energia/comisiones/generar", { periodo: PERIODO });
  ok(gen1.status === 200 && gen1.datos.creadas > 0, `primera generación crea comisiones (${gen1.datos?.creadas})`);

  // --- 4. Regenerar: idempotente ---
  const gen2 = await api("POST", "/api/energia/comisiones/generar", { periodo: PERIODO });
  ok(gen2.status === 200 && gen2.datos.creadas === 0, "regenerar el mismo mes no duplica (creadas = 0)");
  ok(gen2.datos?.existentes > 0, `las existentes se respetan (${gen2.datos?.existentes})`);

  // --- 5. Listado y conceptos ---
  const lista = await api("GET", `/api/energia/comisiones?periodo=${PERIODO}`).then((x) => x.datos);
  ok(Array.isArray(lista) && lista.length > 0, `listado del periodo devuelve ${lista?.length} comisiones`);
  const conceptos = new Set(lista.map((c) => c.concepto));
  ok(conceptos.has("mensual"), "hay comisiones mensuales por contrato activo");
  ok(
    lista.every((c) => c.cups && c.comercializadoraNombre),
    "cada comisión lleva CUPS y comercializadora desnormalizados"
  );

  // --- 6. Resumen ---
  const res1 = await api("GET", "/api/energia/comisiones/resumen").then((x) => x.datos);
  ok(res1?.pendiente.total > 0, `resumen: pendiente de cobrar ${res1?.pendiente.total} €`);

  // --- 7. Cobrar y deshacer ---
  const pendiente = lista.find((c) => c.estado === "pendiente");
  const cobrada = await api("POST", `/api/energia/comisiones/${pendiente._id}/cobrar`);
  ok(cobrada.status === 200 && cobrada.datos.estado === "cobrada" && cobrada.datos.fechaCobro, "comisión marcada como cobrada con fecha");
  const res2 = await api("GET", "/api/energia/comisiones/resumen").then((x) => x.datos);
  ok(res2.pendiente.total === res1.pendiente.total - pendiente.importe, "el resumen descuenta lo cobrado");
  const cobradaDosVeces = await api("POST", `/api/energia/comisiones/${pendiente._id}/cobrar`);
  ok(cobradaDosVeces.status === 400, "no se puede cobrar dos veces");
  const borrarCobrada = await api("DELETE", `/api/energia/comisiones/${pendiente._id}`);
  ok(borrarCobrada.status === 400, "una comisión cobrada no se puede borrar");
  const deshecha = await api("POST", `/api/energia/comisiones/${pendiente._id}/pendiente`);
  ok(deshecha.status === 200 && deshecha.datos.estado === "pendiente" && !deshecha.datos.fechaCobro, "cobro deshecho, vuelve a pendiente");

  // --- 8. Alta manual, duplicado y borrado ---
  const suministros = await api("GET", "/api/energia/suministros").then((x) => x.datos);
  const s = suministros.find((x) => x.estado === "activo");
  const manual = await api("POST", "/api/energia/comisiones", {
    suministro: s._id,
    concepto: "anual",
    periodo: PERIODO,
    importe: 33.5,
    notas: "PRUEBA AUTOMATIZADA - borrar",
  });
  ok(manual.status === 201 && manual.datos.importe === 33.5, "comisión manual creada");
  manualId = manual.datos?._id;
  const duplicada = await api("POST", "/api/energia/comisiones", {
    suministro: s._id,
    concepto: "anual",
    periodo: PERIODO,
    importe: 10,
  });
  ok(duplicada.status === 400, "duplicado (mismo suministro+concepto+mes) rechazado");
  const borrada = await api("DELETE", `/api/energia/comisiones/${manualId}`);
  ok(borrada.status === 200, "comisión manual pendiente borrada");
  manualId = null;

  // --- 9. Validaciones ---
  const malPeriodo = await api("POST", "/api/energia/comisiones/generar", { periodo: "2026-13" });
  ok(malPeriodo.status === 400, "periodo inválido rechazado");
} finally {
  // --- 10. Limpieza: cuenta temporal y restos de la prueba ---
  await mongoose.connect(`${uriBase}/filanex_demototal`);
  const ComisionEnergia = (await import("../src/models/ComisionEnergia.js")).default;
  const r = await ComisionEnergia.deleteMany({ notas: /PRUEBA AUTOMATIZADA/ });
  console.log("limpieza: comisiones de prueba borradas:", r.deletedCount);
  await mongoose.disconnect();
  await mongoose.connect(`${uriBase}/filanex_plataforma`);
  await (await import("../src/models/plataforma/Cuenta.js")).default.deleteOne({ email: EMAIL });
  console.log("limpieza: cuenta temporal eliminada");
  await mongoose.disconnect();
}

console.log(fallos === 0 ? "\nTODO CORRECTO" : `\n${fallos} COMPROBACIONES FALLIDAS`);
process.exit(fallos === 0 ? 0 : 1);
