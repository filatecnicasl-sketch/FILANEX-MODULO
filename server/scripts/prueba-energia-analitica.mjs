/* Prueba del análisis de cartera (fase 9) contra un servidor en marcha:
   crea un suministro de prueba con presupuesto y 6 meses de consumos (el
   último con una subida del 100 %), y comprueba:
   - GET /api/energia/suministros devuelve costeMedioKwh, importe12m y
     desviacionPresupuesto.
   - GET /api/energia/consumos/suministro/:id devuelve coste medio,
     presupuesto/desviación y CO2 estimado.
   - GET /api/energia/alertas detecta la anomalía (+100 %) y devuelve el CO2
     de la cartera.
   Al terminar borra el suministro, sus consumos y la cuenta temporal.
   Uso: node scripts/prueba-energia-analitica.mjs  (desde server/, API en 4700) */
import mongoose from "mongoose";
import "dotenv/config";

const EMAIL = "stress.test@filanex.local";
const PASSWORD = "StressTest123!";
const BASE = process.env.API_BASE || "http://localhost:4700";
const uriBase = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";
const CUPS = "ES00210000000000TEST01";

await mongoose.connect(`${uriBase}/filanex_plataforma`);
const Tenant = (await import("../src/models/plataforma/Tenant.js")).default;
const Cuenta = (await import("../src/models/plataforma/Cuenta.js")).default;
const { hashContrasena } = await import("../src/routes/usuarios.js");
const tenant = await Tenant.findOne({ slug: "demototal" });
await Cuenta.deleteOne({ email: EMAIL });
await Cuenta.create({
  nombre: "Prueba analitica",
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

const periodo = (hace) => {
  const d = new Date();
  const p = new Date(d.getFullYear(), d.getMonth() - hace, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
};

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

  // Suministro de prueba con presupuesto anual de 1.200 €.
  const creado = await api("POST", "/api/energia/suministros", {
    cups: CUPS, tipo: "luz", presupuestoAnual: 1200,
  });
  ok(creado.status === 201, "suministro de prueba creado");
  idSuministro = creado.datos._id;

  // 5 meses a 100 kWh / 15 € y el último a 200 kWh / 40 € (+100 %).
  for (let hace = 5; hace >= 1; hace--) {
    await api("POST", "/api/energia/consumos", {
      suministro: idSuministro, periodo: periodo(hace), kwh: 100, importe: 15,
    });
  }
  await api("POST", "/api/energia/consumos", {
    suministro: idSuministro, periodo: periodo(0), kwh: 200, importe: 40,
  });

  // Listado: agregados de 12 meses.
  const lista = await api("GET", "/api/energia/suministros").then((x) => x.datos);
  const s = lista.find((x) => x.cups === CUPS);
  ok(!!s, "el suministro aparece en el listado");
  ok(s?.importe12m === 115, `importe 12 meses (${s?.importe12m} = 15×5+40 = 115)`);
  ok(s?.consumo12mKwh === 700, `kWh 12 meses (${s?.consumo12mKwh} = 100×5+200 = 700)`);
  ok(Math.abs((s?.costeMedioKwh ?? 0) - 115 / 700) < 0.0001, `coste medio €/kWh (${s?.costeMedioKwh} ≈ 0,1643)`);
  ok(s?.desviacionPresupuesto === 115 - 1200, `desviación vs presupuesto (${s?.desviacionPresupuesto} = 115−1200)`);

  // Estadísticas del modal de consumos.
  const con = await api("GET", `/api/energia/consumos/suministro/${idSuministro}`).then((x) => x.datos);
  const st = con?.estadisticas;
  ok(Math.abs((st?.costeMedioKwh ?? 0) - 115 / 700) < 0.0001, "modal: coste medio €/kWh");
  ok(st?.presupuestoAnual === 1200, "modal: presupuesto anual");
  ok(st?.desviacionPresupuesto === 115 - 1200, "modal: desviación vs presupuesto");
  ok(st?.co2Kg === Math.round(700 * 0.19), `modal: CO2 estimado (${st?.co2Kg} = 700 × 0,19)`);

  // Agenda: anomalía + CO2 de cartera.
  const agenda = await api("GET", "/api/energia/alertas").then((x) => x.datos);
  const anomalia = agenda.anomalias.find((a) => a.cups === CUPS);
  ok(!!anomalia, "agenda: el consumo anómalo aparece");
  ok(anomalia?.kwh === 200 && anomalia?.mediaKwh === 100, `agenda: mes 200 kWh frente a media 100 (${anomalia?.kwh}/${anomalia?.mediaKwh})`);
  ok(anomalia?.desviacionPct === 100, `agenda: desviación +100 % (${anomalia?.desviacionPct})`);
  ok(agenda.co2Kg >= 133, `agenda: CO2 de la cartera ≥ el del suministro (${agenda.co2Kg} ≥ 133)`);
  ok(
    agenda.total === agenda.renovaciones.length + agenda.porAntiguedad.length + agenda.estudiosSinRespuesta.length + agenda.anomalias.length,
    "agenda: el total suma las cuatro secciones"
  );
} finally {
  await mongoose.connect(`${uriBase}/filanex_demototal`);
  const ConsumoEnergia = (await import("../src/models/ConsumoEnergia.js")).default;
  const Suministro = (await import("../src/models/Suministro.js")).default;
  await ConsumoEnergia.deleteMany({ cups: CUPS });
  await Suministro.deleteOne({ cups: CUPS });
  console.log("limpieza: suministro y consumos de prueba eliminados");
  await mongoose.disconnect();
  await mongoose.connect(`${uriBase}/filanex_plataforma`);
  await (await import("../src/models/plataforma/Cuenta.js")).default.deleteOne({ email: EMAIL });
  console.log("limpieza: cuenta temporal eliminada");
  await mongoose.disconnect();
}

console.log(fallos === 0 ? "\nTODO CORRECTO" : `\n${fallos} COMPROBACIONES FALLIDAS`);
process.exit(fallos === 0 ? 0 : 1);
