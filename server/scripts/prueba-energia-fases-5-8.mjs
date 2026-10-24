/* Prueba funcional de las fases 5-8 del módulo de energía contra un servidor
   en marcha: estudios de ahorro (cálculo, estados, aceptar→trámite), consumos
   (upsert mensual y estadísticas), autofacturas (IVA, conciliación, cobro) y
   alertas (renovaciones). Crea una cuenta temporal en demototal y limpia lo
   suyo al terminar.
   Uso: node scripts/prueba-energia-fases-5-8.mjs  (desde server/, API en 4700) */
import mongoose from "mongoose";
import "dotenv/config";

const EMAIL = "stress.test@filanex.local";
const PASSWORD = "StressTest123!";
const BASE = process.env.API_BASE || "http://localhost:4700";

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
  nombre: "Prueba fases energía",
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

const rastro = { estudios: [], consumos: [], autofacturas: [], tramites: [], suministroFechaFin: null };

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

  // Datos base del demo: un suministro activo y una comercializadora distinta para la propuesta.
  const suministros = await api("GET", "/api/energia/suministros").then((x) => x.datos);
  const comercializadoras = await api("GET", "/api/energia/comercializadoras").then((x) => x.datos);
  const s = suministros.find((x) => x.estado === "activo" && x.comercializadora);
  const otra = comercializadoras.find((c) => String(c._id) !== String(s.comercializadora?._id ?? s.comercializadora));
  ok(!!s && !!otra, "datos demo disponibles (suministro activo y otra comercializadora)");

  // --- 3. ESTUDIOS: cálculo automático de costes y ahorro ---
  const estudio = await api("POST", "/api/energia/estudios", {
    suministro: s._id,
    consumoAnual: 10000,
    potenciaPunta: 5,
    potenciaValle: 5,
    precioEnergiaActual: 0.20,
    precioPotenciaPuntaActual: 40,
    precioPotenciaValleActual: 20,
    comercializadora: otra._id,
    precioEnergiaPropuesta: 0.15,
    precioPotenciaPuntaPropuesta: 35,
    precioPotenciaVallePropuesta: 15,
    notas: "PRUEBA AUTOMATIZADA - borrar",
  });
  ok(estudio.status === 201, "estudio creado");
  rastro.estudios.push(estudio.datos?._id);
  // Actual: 10000*0.20 + 5*40 + 5*20 = 2000+200+100 = 2300
  // Propuesta: 10000*0.15 + 5*35 + 5*15 = 1500+175+75 = 1750 → ahorro 550 (23.9%)
  ok(estudio.datos?.costeAnualActual === 2300, `coste actual calculado (${estudio.datos?.costeAnualActual} = 2300)`);
  ok(estudio.datos?.costeAnualPropuesta === 1750, `coste propuesta calculado (${estudio.datos?.costeAnualPropuesta} = 1750)`);
  ok(estudio.datos?.ahorroAnual === 550, `ahorro calculado (${estudio.datos?.ahorroAnual} = 550)`);
  ok(estudio.datos?.ahorroPorcentaje === 23.9, `porcentaje calculado (${estudio.datos?.ahorroPorcentaje} = 23.9)`);
  ok(estudio.datos?.cups === s.cups && estudio.datos?.comercializadoraNombre === otra.nombre, "estudio desnormalizado (CUPS y comercializadora)");

  // Prefill desde suministro.
  const prefill = await api("GET", `/api/energia/estudios/desde-suministro/${s._id}`);
  ok(prefill.status === 200 && prefill.datos?.cups === s.cups, "prefill desde suministro devuelve el CUPS");

  // --- 4. ESTUDIOS: circuito de estados y aceptar→trámite ---
  const sinCom = await api("POST", "/api/energia/estudios", { consumoAnual: 100 });
  ok(sinCom.status === 400, "estudio sin comercializadora de propuesta rechazado");

  const enviado = await api("POST", `/api/energia/estudios/${estudio.datos._id}/estado`, { estado: "enviado" });
  ok(enviado.status === 200 && enviado.datos?.fechaEnvio, "estudio marcado como enviado con fecha");

  const aceptado = await api("POST", `/api/energia/estudios/${estudio.datos._id}/estado`, { estado: "aceptado" });
  ok(aceptado.status === 200 && aceptado.datos?.estado === "aceptado", "estudio aceptado");
  ok(!!aceptado.datos?.tramite, "aceptar abre el trámite automáticamente");
  rastro.tramites.push(aceptado.datos?.tramite);
  const tramites = await api("GET", "/api/energia/tramites").then((x) => x.datos);
  const tramiteAbierto = tramites.find((t) => String(t._id) === String(aceptado.datos.tramite));
  ok(tramiteAbierto?.tipo === "cambio" && tramiteAbierto?.estado === "documentacion", "el trámite es un cambio en documentación");
  ok(tramiteAbierto?.comercializadoraDestinoNombre === otra.nombre, "el trámite apunta a la comercializadora de la propuesta");

  const editarAceptado = await api("PUT", `/api/energia/estudios/${estudio.datos._id}`, { notas: "x" });
  ok(editarAceptado.status === 400, "un estudio aceptado no se puede editar");
  const borrarAceptado = await api("DELETE", `/api/energia/estudios/${estudio.datos._id}`);
  ok(borrarAceptado.status === 400, "un estudio aceptado no se puede borrar");

  // Estudio rechazable y borrable.
  const estudio2 = await api("POST", "/api/energia/estudios", {
    suministro: s._id,
    comercializadora: otra._id,
    costeAnualActual: 1200,
    costeAnualPropuesta: 1000,
    notas: "PRUEBA AUTOMATIZADA - borrar",
  });
  rastro.estudios.push(estudio2.datos?._id);
  ok(estudio2.datos?.ahorroAnual === 200, "costes manuales respetados y ahorro calculado (1200-1000=200)");
  const rechazado = await api("POST", `/api/energia/estudios/${estudio2.datos._id}/estado`, { estado: "rechazado" });
  ok(rechazado.status === 200 && rechazado.datos?.fechaRespuesta, "estudio rechazado con fecha de respuesta");
  const borrado = await api("DELETE", `/api/energia/estudios/${estudio2.datos._id}`);
  ok(borrado.status === 200, "estudio rechazado borrado");
  rastro.estudios.pop();

  // --- 5. CONSUMOS: upsert mensual y estadísticas ---
  const c1 = await api("POST", "/api/energia/consumos", { suministro: s._id, periodo: "2026-08", kwh: 800, importe: 160 });
  ok(c1.status === 201, "consumo de agosto apuntado");
  rastro.consumos.push(c1.datos?._id);
  const c2 = await api("POST", "/api/energia/consumos", { suministro: s._id, periodo: "2026-09", kwh: 1000, importe: 190 });
  ok(c2.status === 201, "consumo de septiembre apuntado");
  rastro.consumos.push(c2.datos?._id);
  const c2bis = await api("POST", "/api/energia/consumos", { suministro: s._id, periodo: "2026-09", kwh: 1200, importe: 200 });
  ok(c2bis.status === 201 && String(c2bis.datos?._id) === String(c2.datos?._id) && c2bis.datos?.kwh === 1200, "repetir el mes actualiza, no duplica");
  const malPeriodo = await api("POST", "/api/energia/consumos", { suministro: s._id, periodo: "2026-13", kwh: 1 });
  ok(malPeriodo.status === 400, "periodo de consumo inválido rechazado");
  const listaConsumos = await api("GET", `/api/energia/consumos/suministro/${s._id}`).then((x) => x.datos);
  const prueba = listaConsumos.lista.filter((c) => ["2026-08", "2026-09"].includes(c.periodo));
  ok(prueba.length === 2, "histórico del suministro devuelve los dos meses");
  const borradoConsumo = await api("DELETE", `/api/energia/consumos/${c1.datos._id}`);
  ok(borradoConsumo.status === 200, "consumo borrado");
  rastro.consumos = rastro.consumos.filter((id) => id !== c1.datos._id);

  // --- 6. AUTOFACTURAS: IVA, conciliación y cobro ---
  await api("POST", "/api/energia/comisiones/generar", { periodo: "2026-10" });
  const comisiones = await api("GET", "/api/energia/comisiones?periodo=2026-10").then((x) => x.datos);
  const comS = comisiones.filter((c) => String(c.comercializadora) === String(s.comercializadora?._id ?? s.comercializadora));
  const totalComS = Math.round(comS.reduce((a, c) => a + c.importe, 0) * 100) / 100;
  ok(comS.length > 0, `hay comisiones calculadas de ${s.comercializadoraNombre} para octubre (${comS.length})`);

  const af = await api("POST", "/api/energia/autofacturas", {
    comercializadora: s.comercializadora?._id ?? s.comercializadora,
    numero: "AF-PRUEBA",
    periodo: "2026-10",
    base: totalComS,
    notas: "PRUEBA AUTOMATIZADA - borrar",
  });
  ok(af.status === 201, "autofactura creada");
  rastro.autofacturas.push(af.datos?._id);
  ok(af.datos?.iva === Math.round(totalComS * 0.21 * 100) / 100, `IVA calculado al 21% (${af.datos?.iva})`);
  ok(af.datos?.total === Math.round(totalComS * 1.21 * 100) / 100, `total calculado (${af.datos?.total})`);

  const listaAf = await api("GET", "/api/energia/autofacturas?periodo=2026-10").then((x) => x.datos);
  const afConciliada = listaAf.find((a) => a.numero === "AF-PRUEBA");
  ok(afConciliada?.comisionesPeriodo === totalComS, `conciliación: comisiones del mes (${afConciliada?.comisionesPeriodo})`);
  ok(Math.abs(afConciliada?.diferencia ?? 1) < 0.01, "conciliación: cuadra (diferencia 0)");

  const editAf = await api("PUT", `/api/energia/autofacturas/${af.datos._id}`, { base: totalComS + 10 });
  ok(editAf.status === 200, "autofactura pendiente editable");
  const listaAf2 = await api("GET", "/api/energia/autofacturas?periodo=2026-10").then((x) => x.datos);
  const afDif = listaAf2.find((a) => a.numero === "AF-PRUEBA");
  ok(Math.abs(afDif?.diferencia - 10) < 0.01, `la diferencia se recalcula (${afDif?.diferencia} = 10)`);

  const cobradaAf = await api("POST", `/api/energia/autofacturas/${af.datos._id}/cobrar`);
  ok(cobradaAf.status === 200 && cobradaAf.datos?.fechaCobro, "autofactura marcada como cobrada");
  const editCobrada = await api("PUT", `/api/energia/autofacturas/${af.datos._id}`, { base: 1 });
  ok(editCobrada.status === 400, "autofactura cobrada no editable");
  const borrarCobrada = await api("DELETE", `/api/energia/autofacturas/${af.datos._id}`);
  ok(borrarCobrada.status === 400, "autofactura cobrada no borrable");

  const sinBase = await api("POST", "/api/energia/autofacturas", { comercializadora: otra._id, periodo: "2026-10", base: 0 });
  ok(sinBase.status === 400, "autofactura sin base rechazada");

  // --- 7. ALERTAS: renovación próxima ---
  const fin = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
  const puestaFechaFin = await api("PUT", `/api/energia/suministros/${s._id}`, { fechaFin: fin });
  ok(puestaFechaFin.status === 200, "fecha de fin de contrato guardada en el suministro");
  rastro.suministroFechaFin = s._id;
  const alertas = await api("GET", "/api/energia/alertas").then((x) => x.datos);
  const renovacion = alertas.renovaciones.find((r) => String(r._id) === String(s._id));
  ok(!!renovacion, "la alerta de renovación aparece (vence en 20 días)");
  ok(renovacion?.dias <= 20, `los días de la alerta son correctos (${renovacion?.dias})`);
  const quitada = await api("PUT", `/api/energia/suministros/${s._id}`, { fechaFin: null });
  ok(quitada.status === 200, "fecha de fin retirada");
  rastro.suministroFechaFin = null;
  const alertas2 = await api("GET", "/api/energia/alertas").then((x) => x.datos);
  ok(!alertas2.renovaciones.find((r) => String(r._id) === String(s._id)), "sin fecha de fin ya no hay alerta de renovación");
} finally {
  // --- 8. Limpieza ---
  await mongoose.connect(`${uriBase}/filanex_demototal`);
  const EstudioEnergia = (await import("../src/models/EstudioEnergia.js")).default;
  const ConsumoEnergia = (await import("../src/models/ConsumoEnergia.js")).default;
  const AutofacturaEnergia = (await import("../src/models/AutofacturaEnergia.js")).default;
  const Tramite = (await import("../src/models/Tramite.js")).default;
  const Suministro = (await import("../src/models/Suministro.js")).default;
  if (rastro.estudios.length) await EstudioEnergia.deleteMany({ _id: { $in: rastro.estudios } });
  if (rastro.consumos.length) await ConsumoEnergia.deleteMany({ _id: { $in: rastro.consumos } });
  if (rastro.autofacturas.length) await AutofacturaEnergia.deleteMany({ _id: { $in: rastro.autofacturas } });
  if (rastro.tramites.length) await Tramite.deleteMany({ _id: { $in: rastro.tramites } });
  if (rastro.suministroFechaFin) await Suministro.updateOne({ _id: rastro.suministroFechaFin }, { $unset: { fechaFin: "" } });
  await EstudioEnergia.deleteMany({ notas: /PRUEBA AUTOMATIZADA/ });
  await AutofacturaEnergia.deleteMany({ notas: /PRUEBA AUTOMATIZADA/ });
  console.log("limpieza: restos de la prueba eliminados");
  await mongoose.disconnect();
  await mongoose.connect(`${uriBase}/filanex_plataforma`);
  await (await import("../src/models/plataforma/Cuenta.js")).default.deleteOne({ email: EMAIL });
  console.log("limpieza: cuenta temporal eliminada");
  await mongoose.disconnect();
}

console.log(fallos === 0 ? "\nTODO CORRECTO" : `\n${fallos} COMPROBACIONES FALLIDAS`);
process.exit(fallos === 0 ? 0 : 1);
