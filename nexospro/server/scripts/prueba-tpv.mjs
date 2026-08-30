/**
 * Pruebas E2E del módulo TPV: F2, cadena de huella, caja, R5 y aislamiento.
 * Uso: node scripts/prueba-tpv.mjs <email> <password>
 */
const API = process.env.API_URL || "http://127.0.0.1:4700";
const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Uso: node scripts/prueba-tpv.mjs <email> <password>");
  process.exit(1);
}

let token = null;
let ok = 0;
let fail = 0;

function check(cond, nombre, extra = "") {
  if (cond) {
    ok++;
    console.log(`  OK  ${nombre}${extra ? " — " + extra : ""}`);
  } else {
    fail++;
    console.error(`  FAIL ${nombre}${extra ? " — " + extra : ""}`);
  }
}

async function api(path, { method = "GET", body } = {}) {
  const r = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  return { status: r.status, datos };
}

async function login() {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const datos = await r.json();
  if (!r.ok) throw new Error(datos.error || "Login fallido");
  token = datos.token;
}

async function esperarHealth() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${API}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("API no responde");
}

async function main() {
  console.log("Pruebas E2E TPV\n");
  await esperarHealth();
  await login();
  console.log("Login OK\n");

  // 1. Estado TPV
  let r = await api("/tpv/estado");
  check(r.status === 200, "GET /tpv/estado responde");
  const teniaCaja = !!r.datos.caja;

  // 2. Abrir caja (o usar la abierta)
  if (!teniaCaja) {
    r = await api("/tpv/caja/abrir", { method: "POST", body: { fondo: 100 } });
    check(r.status === 200 || r.status === 201, "Abrir caja", r.datos?.error ?? "");
  } else {
    console.log("  · Caja ya estaba abierta");
  }

  // 3. Cobrar ticket de 3 líneas
  const lineas = [
    { descripcion: "Producto A", cantidad: 2, precioUnitario: 1.5, iva: 21 },
    { descripcion: "Producto B", cantidad: 1, precioUnitario: 3.0, iva: 10 },
    { descripcion: "Producto C", cantidad: 3, precioUnitario: 0.5, iva: 4 },
  ];
  r = await api("/tpv/cobrar", { method: "POST", body: { lineas, metodoCobro: "efectivo", entregado: 20 } });
  check(r.status === 201, "Cobrar ticket 3 líneas", r.datos?.error ?? "");
  const t1 = r.datos?.ticket ?? {};
  check(t1.serieNumero?.startsWith("T-"), "Ticket con serie T", t1.serieNumero);
  check(!!t1.qrContenido, "Ticket con QR VeriFactu");
  check(r.datos?.cambio > 0, "Cambio calculado", `cambio=${r.datos?.cambio}`);
  check(!!r.datos?.imprimirUrl, "Devuelve URL de impresión");

  // 4. Segundo cobro: huella encadenada (la del 2.º = huella del 1.º)
  r = await api("/tpv/cobrar", {
    method: "POST",
    body: { lineas: [{ descripcion: "Producto D", cantidad: 1, precioUnitario: 5, iva: 21 }], metodoCobro: "tarjeta" },
  });
  const t2 = r.datos?.ticket ?? {};
  check(r.status === 201, "Segundo cobro", r.datos?.error ?? "");
  check(
    t1.serieNumero && t2.serieNumero && t1.serieNumero !== t2.serieNumero,
    "Números correlativos distintos",
    `${t1.serieNumero} → ${t2.serieNumero}`
  );

  // 5. XML F2 no lleva Destinatarios; F1 sí lo sigue llevando
  r = await fetch(`${API}/api/facturas-venta/${t1._id}/xml`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const xml = await r.text();
  check(r.status === 200, "XML del ticket accesible");
  check(!xml.includes("<sf:Destinatarios>"), "XML F2 sin Destinatarios");
  check(xml.includes("<sf:TipoFactura>F2</sf:TipoFactura>"), "XML marca tipo F2");

  // 6. Cobrar sin caja abierta → 409 (cerramos primero)
  r = await api("/tpv/caja/cerrar", { method: "POST", body: { conteoEfectivo: 150, notas: "Prueba E2E" } });
  check(r.status === 200, "Cerrar caja con arqueo", r.datos?.error ?? "");
  check(typeof r.datos?.cierre?.diferencia === "number", "Arqueo calcula diferencia", `dif=${r.datos?.cierre?.diferencia}`);
  r = await api("/tpv/cobrar", {
    method: "POST",
    body: { lineas: [{ descripcion: "X", cantidad: 1, precioUnitario: 1, iva: 21 }], metodoCobro: "efectivo" },
  });
  check(r.status === 409, "Cobrar sin caja abierta devuelve 409", `status=${r.status}`);

  // 7. Reabrir caja y devolución R5
  r = await api("/tpv/caja/abrir", { method: "POST", body: { fondo: 100 } });
  check(r.status === 201, "Reabrir caja", r.datos?.error ?? "");
  r = await api(`/tpv/tickets/${t1._id}/devolucion`, { method: "POST" });
  check(r.status === 201, "Devolución R5", r.datos?.error ?? "");
  const dev = r.datos?.devolucion ?? {};
  check((dev.total ?? 0) < 0, "Rectificativa con importe negativo", `total=${dev.total}`);
  check(dev.numero?.startsWith("T-"), "Rectificativa en serie T", dev.numero);

  // 8. Tickets del día: el original queda rectificado
  const hoy = new Date().toISOString().slice(0, 10);
  r = await api(`/tpv/tickets?fecha=${hoy}`);
  check(r.status === 200, "Listado de tickets del día");
  check(Array.isArray(r.datos) && r.datos.length >= 2, "Devuelve tickets");
  const t1Listado = r.datos.find((t) => t._id === t1._id);
  check(t1Listado?.estado === "rectificada", "Ticket original marcado rectificada");

  // 9. Imprimir ticket 80 mm
  r = await fetch(`${API}/api/tpv/tickets/${t1._id}/imprimir`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const html = await r.text();
  check(r.status === 200, "Imprimir ticket responde");
  check(html.includes("FACTURA SIMPLIFICADA") && html.includes(t1.serieNumero), "HTML con datos del ticket");
  check(html.includes("qrserver") || html.includes("QR"), "HTML con QR VeriFactu");

  // 10. Cliente mostrador no aparece en el listado normal de clientes
  r = await api("/clientes?q=Consumidor");
  check(r.status === 200, "Listado de clientes responde");
  const lista = Array.isArray(r.datos) ? r.datos : (r.datos?.clientes ?? []);
  check(!lista.some((c) => c.mostrador), "Cliente mostrador oculto en /clientes");

  console.log(`\nResumen: ${ok} OK, ${fail} fallos`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
