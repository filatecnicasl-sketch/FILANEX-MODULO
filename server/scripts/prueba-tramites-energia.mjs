/* Prueba funcional de la API de trámites de energía contra un servidor
   en marcha. Crea una cuenta temporal en el tenant demototal, prueba el
   circuito completo (crear → enviado → activar) verificando que el
   suministro se actualiza, y limpia todo al final.
   Uso: node scripts/prueba-tramites-energia.mjs  (desde server/, con el API en 4700) */
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
  nombre: "Prueba tramites",
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

  // --- 3. Datos de partida: un suministro y la comercializadora destino ---
  const suministros = await api("GET", "/api/energia/suministros").then((x) => x.datos);
  const s = suministros.find((x) => x.cups === "ES0021000000000008OP"); // panadería, Endesa
  ok(!!s, "suministro de prueba encontrado (ES...08OP)");
  const comercializadoras = await api("GET", "/api/energia/comercializadoras").then((x) => x.datos);
  const destino = comercializadoras.find((c) => c.nombre === "Iberdrola Clientes");
  ok(!!destino, "comercializadora destino encontrada (Iberdrola)");
  ok(s.comercializadoraNombre !== "Iberdrola Clientes", "el suministro NO está aún con Iberdrola");

  // --- 4. Crear trámite de cambio ---
  const creado = await api("POST", "/api/energia/tramites", {
    tipo: "cambio",
    suministro: s._id,
    comercializadoraDestino: destino._id,
    notas: "PRUEBA AUTOMATIZADA - borrar",
  });
  ok(creado.status === 201 && creado.datos.estado === "documentacion", "trámite creado en documentación");
  const id = creado.datos._id;

  // Validaciones que deben fallar:
  const sinDestino = await api("POST", "/api/energia/tramites", { tipo: "cambio", suministro: s._id });
  ok(sinDestino.status === 400, "crear un cambio sin destino devuelve 400");

  // --- 5. Circuito ---
  const enviado = await api("POST", `/api/energia/tramites/${id}/estado`, { estado: "enviado", nota: "PRUEBA: enviado" });
  ok(enviado.status === 200 && enviado.datos.fechaEnvio, "marcado como enviado con fecha");
  const enTramite = await api("POST", `/api/energia/tramites/${id}/estado`, { estado: "en_tramite" });
  ok(enTramite.status === 200, "marcado como en trámite");
  const activado = await api("POST", `/api/energia/tramites/${id}/estado`, { estado: "activado" });
  ok(activado.status === 200 && activado.datos.fechaActivacion, "trámite activado con fecha");

  // --- 6. El suministro se actualizó solo ---
  const s2 = (await api("GET", "/api/energia/suministros").then((x) => x.datos)).find((x) => x._id === s._id);
  ok(s2.comercializadoraNombre === "Iberdrola Clientes", `suministro ahora con Iberdrola (era ${s.comercializadoraNombre})`);
  ok(s2.fechaAlta, "suministro con fecha de alta actualizada");

  // --- 7. Protecciones ---
  const reeditar = await api("PUT", `/api/energia/tramites/${id}`, { notas: "x" });
  ok(reeditar.status === 400, "un trámite activado no se puede editar");
  const reactivar = await api("POST", `/api/energia/tramites/${id}/estado`, { estado: "enviado" });
  ok(reactivar.status === 400, "un trámite activado no cambia de estado");
  const borrarAct = await api("DELETE", `/api/energia/tramites/${id}`);
  ok(borrarAct.status === 400, "un trámite activado no se puede borrar");

  // --- 8. Edición y borrado de un trámite en curso ---
  const prov = await api("POST", "/api/energia/tramites", {
    tipo: "baja",
    suministro: s._id,
    notas: "PRUEBA AUTOMATIZADA - borrar",
  });
  ok(prov.status === 201, "trámite de baja creado sin comercializadora destino");
  const editado = await api("PUT", `/api/energia/tramites/${prov.datos._id}`, { notas: "PRUEBA editada" });
  ok(editado.status === 200 && editado.datos.notas === "PRUEBA editada", "trámite en curso editable");
  const cancelado = await api("POST", `/api/energia/tramites/${prov.datos._id}/estado`, { estado: "cancelado" });
  ok(cancelado.status === 200, "trámite cancelado");
  const borrado = await api("DELETE", `/api/energia/tramites/${prov.datos._id}`);
  ok(borrado.status === 200, "trámite cancelado borrado");
} finally {
  // --- 9. Limpieza: cuenta temporal, trámites de prueba y suministro restaurado ---
  await mongoose.connect(`${uriBase}/filanex_demototal`);
  const Tramite = (await import("../src/models/Tramite.js")).default;
  const Suministro = (await import("../src/models/Suministro.js")).default;
  const Comercializadora = (await import("../src/models/Comercializadora.js")).default;
  const r = await Tramite.deleteMany({ notas: /PRUEBA AUTOMATIZADA/ });
  console.log("limpieza: trámites de prueba borrados:", r.deletedCount);
  // Restaurar la comercializadora del suministro de la panadería (Endesa).
  const endesa = await Comercializadora.findOne({ nombre: "Endesa Energía" });
  await Suministro.updateOne(
    { cups: "ES0021000000000008OP" },
    { $set: { comercializadora: endesa._id, comercializadoraNombre: "Endesa Energía", fechaAlta: new Date("2026-01-15") } }
  );
  console.log("limpieza: suministro de la panadería restaurado a Endesa");
  await mongoose.disconnect();
  await mongoose.connect(`${uriBase}/filanex_plataforma`);
  await (await import("../src/models/plataforma/Cuenta.js")).default.deleteOne({ email: EMAIL });
  console.log("limpieza: cuenta temporal eliminada");
  await mongoose.disconnect();
}

console.log(fallos === 0 ? "\nTODO CORRECTO" : `\n${fallos} COMPROBACIONES FALLIDAS`);
process.exit(fallos === 0 ? 0 : 1);
