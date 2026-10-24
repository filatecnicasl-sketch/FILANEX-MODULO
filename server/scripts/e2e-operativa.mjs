// Prueba E2E de la operativa: presupuesto → factura → cobro parcial → remesa SEPA → recurrencia.
// Uso: node scripts/e2e-operativa.mjs   (con la API arrancada en :4700)
const base = "http://localhost:4700/api";

async function api(metodo, ruta, cuerpo) {
  const r = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    datos = texto;
  }
  return { ok: r.ok, status: r.status, datos };
}

function paso(nombre, ok, detalle) {
  console.log(`${ok ? "OK  " : "FAIL"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) process.exit(1);
}

// 1. Datos SEPA de la empresa
let r = await api("PUT", "/empresa", {
  sepa: { iban: "ES9121000418450200051332", idAcreedor: "ES97000B75418350" },
});
paso("PUT /empresa (SEPA)", r.ok && r.datos.sepa?.iban === "ES9121000418450200051332");

// 2. Cliente con IBAN
r = await api("POST", "/clientes", {
  nombre: "CLIENTE E2E OPERATIVA SL",
  nif: "B87654321",
  iban: "ES6000495332091234567890",
});
paso("POST /clientes (con IBAN)", r.ok, r.datos?._id);
const clienteId = r.datos._id;

// 3. Presupuesto P-1
r = await api("POST", "/presupuestos", {
  cliente: clienteId,
  lineas: [{ descripcion: "Instalación centralita VoIP", cantidad: 1, precioUnitario: 1000, iva: 21 }],
});
paso("POST /presupuestos", r.ok && r.datos.serieNumero === "P-1", `${r.datos.serieNumero} total ${r.datos.total}`);
const presupuestoId = r.datos._id;

r = await api("POST", `/presupuestos/${presupuestoId}/estado`, { estado: "aceptado" });
paso("Presupuesto aceptado", r.ok && r.datos.estado === "aceptado");

// 4. Facturar presupuesto
r = await api("POST", `/presupuestos/${presupuestoId}/facturar`);
paso("Presupuesto → factura borrador", r.ok && r.datos.estado === "borrador", `total ${r.datos.total}`);
const facturaId = r.datos._id;

// 5. Emitir factura (VeriFactu)
r = await api("POST", `/facturas-venta/${facturaId}/emitir`);
paso("Emitir factura", r.ok && r.datos.estado === "emitida" && !!r.datos.verifactu?.huella,
  `${r.datos.serieNumero} huella ${String(r.datos.verifactu?.huella ?? "").slice(0, 12)}…`);

// 6. Cobro parcial de 210 € (quedan 1000 €)
r = await api("POST", `/facturas-venta/${facturaId}/cobros`, { importe: 210, metodo: "transferencia" });
paso("Cobro parcial 210 €", r.ok, `estadoCobro=${r.datos.estadoCobro} cobrado=${r.datos.cobrado}`);

// 7. Pendientes de cobro
r = await api("GET", "/facturas-venta?pendientesCobro=1");
const pendiente = r.datos.find((f) => f._id === facturaId);
paso("GET pendientesCobro", r.ok && !!pendiente, `pendiente ${(pendiente.total - pendiente.cobrado).toFixed(2)} €`);

// 8. Remesa SEPA por lo pendiente
r = await api("POST", "/remesas", { facturaIds: [facturaId], fechaCargo: "2026-09-01" });
paso("POST /remesas", r.ok && r.datos.total === 1000, `total remesa ${r.datos.total}`);
const remesaId = r.datos._id;

r = await api("GET", `/remesas/${remesaId}/xml`);
const xml = r.datos;
paso("XML pain.008.001.02",
  typeof xml === "string" && xml.includes("pain.008.001.02") && xml.includes("1000.00") && xml.includes("ES6000495332091234567890"),
  `${xml.length} caracteres`);

// 9. Recurrencia vencida → generar borrador
r = await api("POST", "/recurrencias", {
  cliente: clienteId,
  concepto: "Cuota mantenimiento centralita",
  lineas: [{ descripcion: "Mantenimiento mensual", cantidad: 1, precioUnitario: 60, iva: 21 }],
  periodicidad: "mensual",
  diaEmision: 5,
  proximaEmision: "2026-08-05",
});
paso("POST /recurrencias", r.ok, `próxima ${r.datos.proximaEmision}`);

r = await api("POST", "/recurrencias/generar");
paso("Generar recurrencias", r.ok && r.datos.generadas === 1,
  `${r.datos.generadas} factura(s): ${r.datos.facturas?.[0]?.total} € (borrador=${r.datos.facturas?.[0]?.estado})`);

console.log("\nE2E OPERATIVA COMPLETO");
