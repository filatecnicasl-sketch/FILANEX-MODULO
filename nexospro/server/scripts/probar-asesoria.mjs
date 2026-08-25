// Prueba de extremo a extremo del módulo de asesoría contra la API en marcha.
//
//   node scripts/probar-asesoria.mjs <url> <email> <password>
//
// Crea un cliente de cartera y un documento de prueba, revisa el flujo
// (libros de IVA, fiscalidad, panel) y lo borra todo al terminar.
const [url, email, password] = process.argv.slice(2);
if (!url || !email || !password) {
  console.error("Uso: node scripts/probar-asesoria.mjs <url> <email> <password>");
  process.exit(1);
}

let fallos = 0;
const ok = (cond, texto) => {
  console.log(`${cond ? "OK  " : "FALLO"}  ${texto}`);
  if (!cond) fallos++;
};

const login = await fetch(`${url}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const sesion = await login.json();
if (!login.ok) {
  console.error("No se pudo iniciar sesión:", sesion);
  process.exit(1);
}
const H = { "Content-Type": "application/json", Authorization: `Bearer ${sesion.token}` };

// 1. Alta de cliente de cartera
const nifPrueba = `X${Date.now().toString().slice(-8)}A`;
let r = await fetch(`${url}/api/asesoria/cartera`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({
    nombre: "Prueba Asesoría S.L.",
    nif: nifPrueba,
    formaJuridica: "sl",
    modelos: ["303", "390", "200", "130"],
    cuotaMensual: 150,
  }),
});
const cliente = await r.json();
ok(r.status === 201, `Alta de cliente de cartera (${r.status})`);

// NIF duplicado debe rechazarse
r = await fetch(`${url}/api/asesoria/cartera`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ nombre: "Duplicado", nif: nifPrueba }),
});
ok(r.status === 409, `Rechaza NIF duplicado (${r.status})`);

// 2. Documentos manuales: una emitida y una recibida del trimestre actual
const hoy = new Date();
for (const [tipo, total] of [["emitida", 1210], ["recibida", 484]]) {
  r = await fetch(`${url}/api/asesoria/documentos`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      clienteAsesoria: cliente._id,
      tipo,
      fecha: hoy.toISOString().slice(0, 10),
      numero: `PR-${tipo}`,
      tercero: "Tercero de prueba",
      total,
      tipoIva: 21,
      retencion: tipo === "emitida" ? 7 : 0,
    }),
  });
  const doc = await r.json();
  const baseEsperada = Math.round((total / 1.21) * 100) / 100;
  ok(
    r.status === 201 && Math.abs(doc.base - baseEsperada) < 0.01,
    `Documento ${tipo}: base deducida del total (${doc.base} ≈ ${baseEsperada})`
  );
  // Marcar como revisado para que entre en los libros
  r = await fetch(`${url}/api/asesoria/documentos/${doc._id}`, {
    method: "PUT",
    headers: H,
    body: JSON.stringify({ estado: "revisado" }),
  });
  ok(r.ok, `Documento ${tipo} revisado`);
}

// 3. Libros de IVA: el resultado del trimestre debe ser 210 - 84 = 126
r = await fetch(`${url}/api/asesoria/libros-iva?cliente=${cliente._id}&ano=${hoy.getFullYear()}`, { headers: H });
const libros = await r.json();
const t = libros.trimestres?.[Math.floor(hoy.getMonth() / 3)];
const resultado = Math.round((t.emitidas.cuota - t.recibidas.cuota - t.gastos.cuota) * 100) / 100;
ok(Math.abs(resultado - 126) < 0.01, `Libro IVA del trimestre: resultado ${resultado} (esperado 126)`);

// 4. CSV exportable
r = await fetch(`${url}/api/asesoria/libros-iva.csv?cliente=${cliente._id}&ano=${hoy.getFullYear()}`, { headers: H });
const csv = await r.text();
ok(r.ok && csv.includes("Emitidas") && csv.includes("1.210,00") === false && csv.includes("1.210") === false, `CSV generado (${csv.split("\r\n").length - 1} líneas)`);
ok(csv.includes("Tercero de prueba"), "CSV contiene el documento de prueba");

// 5. Fiscalidad: debe aparecer el 303, 390 y 200 del cliente
r = await fetch(`${url}/api/asesoria/fiscalidad?ano=${hoy.getFullYear()}`, { headers: H });
const fiscal = await r.json();
const modelos = new Set(fiscal.vencimientos.filter((v) => v.cliente === cliente._id).map((v) => v.modelo));
ok(modelos.has("303") && modelos.has("390") && modelos.has("200"), `Calendario fiscal con 303, 390 y 200 (${fiscal.vencimientos.length} vencimientos)`);

// 6. Previsión fiscal: 303 = 126 y 130 = 20 % de (1000-400) - 70 de retención = 50
r = await fetch(`${url}/api/asesoria/prevision?ano=${hoy.getFullYear()}&cliente=${cliente._id}`, { headers: H });
const prevision = await r.json();
const prev = prevision.clientes?.[0];
const tActual = prev?.trimestres?.[Math.floor(hoy.getMonth() / 3)];
ok(prev?.presenta130 === true, "El cliente presenta el 130");
ok(tActual && Math.abs(tActual.iva.cuota - 126) < 0.01, `Previsión 303 del trimestre: ${tActual?.iva.cuota} (esperado 126)`);
ok(
  tActual?.irpf && Math.abs(tActual.irpf.rendimiento - 600) < 0.01 && Math.abs(tActual.irpf.pagoTrimestre - 50) < 0.01,
  `Previsión 130: rendimiento ${tActual?.irpf?.rendimiento}, pago ${tActual?.irpf?.pagoTrimestre} (esperado 600 y 50)`
);

// 7. Solicitudes de documentos: crear, vincular y reabrir
r = await fetch(`${url}/api/asesoria/solicitudes`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ clienteAsesoria: cliente._id, descripcion: "Factura de prueba de la solicitud", periodo: "3T" }),
});
const solicitud = await r.json();
ok(r.status === 201, `Solicitud creada (${r.status})`);

const docsPend = await (await fetch(`${url}/api/asesoria/documentos?cliente=${cliente._id}`, { headers: H })).json();
// Volver a poner un documento en pendiente para vincularlo
await fetch(`${url}/api/asesoria/documentos/${docsPend[0]._id}`, {
  method: "PUT",
  headers: H,
  body: JSON.stringify({ estado: "pendiente" }),
});
r = await fetch(`${url}/api/asesoria/solicitudes/${solicitud._id}/vincular`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ documentoId: docsPend[0]._id }),
});
let sol = await r.json();
ok(r.ok && sol.estado === "recibida" && sol.documento === docsPend[0]._id, "Solicitud vinculada y recibida");

r = await fetch(`${url}/api/asesoria/solicitudes/${solicitud._id}`, {
  method: "PUT",
  headers: H,
  body: JSON.stringify({ estado: "pendiente" }),
});
sol = await r.json();
ok(r.ok && sol.estado === "pendiente" && !sol.documento, "Solicitud reabierta y desvinculada");

r = await fetch(`${url}/api/asesoria/solicitudes/${solicitud._id}`, { method: "DELETE", headers: H });
ok(r.ok, "Solicitud borrada");

// 8. Duplicados: mismo tercero, número y fecha debe avisar (sin bloquear)
r = await fetch(`${url}/api/asesoria/documentos`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({
    clienteAsesoria: cliente._id,
    tipo: "recibida",
    fecha: hoy.toISOString().slice(0, 10),
    numero: "PR-recibida",
    tercero: "Tercero de prueba",
    total: 484,
    tipoIva: 21,
  }),
});
const dup = await r.json();
ok(r.status === 201 && (dup.avisos || []).length > 0, `Avisa de documento duplicado (${(dup.avisos || []).join(" ") || "sin aviso"})`);
if (dup?._id ?? dup?.documento?._id) {
  await fetch(`${url}/api/asesoria/documentos/${dup._id ?? dup.documento._id}`, { method: "DELETE", headers: H });
}

// 9. Cierres trimestrales: matriz, cambio de estado y kit de solicitudes
const anoActual = hoy.getFullYear();
const trimActual = Math.floor(hoy.getMonth() / 3) + 1;
r = await fetch(`${url}/api/asesoria/cierres?ano=${anoActual}`, { headers: H });
const matriz = await r.json();
const fila = matriz.clientes?.find((f) => f.cliente._id === cliente._id);
ok(r.ok && fila && fila.trimestres.length === 4, `Matriz de cierres (${matriz.clientes?.length ?? 0} clientes, 4 trimestres)`);

r = await fetch(`${url}/api/asesoria/cierres`, {
  method: "PUT",
  headers: H,
  body: JSON.stringify({ clienteAsesoria: cliente._id, ano: anoActual, trimestre: trimActual, estado: "presentado" }),
});
const cierre = await r.json();
ok(r.ok && cierre.estado === "presentado" && cierre.presentadoEn, "Cierre marcado como presentado con fecha");

r = await fetch(`${url}/api/asesoria/solicitudes/kit`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ clienteAsesoria: cliente._id, ano: anoActual, trimestre: trimActual }),
});
const kit1 = await r.json();
ok(r.status === 201 && kit1.creadas === 5, `Kit de cierre crea 5 solicitudes (${kit1.creadas})`);

r = await fetch(`${url}/api/asesoria/solicitudes/kit`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ clienteAsesoria: cliente._id, ano: anoActual, trimestre: trimActual }),
});
const kit2 = await r.json();
ok(r.ok && kit2.creadas === 0, `Kit no duplica lo ya pedido (${kit2.creadas})`);

const pendKit = await (await fetch(`${url}/api/asesoria/solicitudes?cliente=${cliente._id}`, { headers: H })).json();
for (const s of pendKit) {
  await fetch(`${url}/api/asesoria/solicitudes/${s._id}`, { method: "DELETE", headers: H });
}

// 10. Panel (con contador de solicitudes y alertas)
r = await fetch(`${url}/api/asesoria/panel`, { headers: H });
const panel = await r.json();
ok(r.ok && panel.clientesActivos >= 1, `Panel (${panel.clientesActivos} clientes, ${panel.pendientesRevision} pendientes)`);
ok(!!panel.alertas && Array.isArray(panel.alertas.clientesSinMovimiento), "Panel devuelve alertas");

// 7. Limpieza: borrar documentos y cliente
const docs = await (await fetch(`${url}/api/asesoria/documentos?cliente=${cliente._id}`, { headers: H })).json();
for (const d of docs) {
  await fetch(`${url}/api/asesoria/documentos/${d._id}`, { method: "DELETE", headers: H });
}
r = await fetch(`${url}/api/asesoria/cartera/${cliente._id}`, { method: "DELETE", headers: H });
ok(r.ok, "Limpieza: documentos y cliente de prueba borrados");

console.log(fallos === 0 ? "\nMódulo de asesoría correcto." : `\n${fallos} fallos.`);
process.exit(fallos ? 1 : 0);
