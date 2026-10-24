// Da de alta los 3 justificantes de pago de use.ai como facturas de compra sin IVA
// y los concilia con los cargos bancarios correspondientes.
const login = await fetch("http://localhost:4700/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "fbarroso@filatecnica.com", password: "Barroso@159000" }),
});
const { token } = await login.json();
if (!token) throw new Error("Login falló");

const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

// 1. Buscar proveedor use.ai
let prov = await (await fetch("http://localhost:4700/api/proveedores?busqueda=use.ai", { headers })).json();
let proveedorId = Array.isArray(prov) && prov[0]?._id;
if (!proveedorId) {
  const crear = await fetch("http://localhost:4700/api/proveedores", {
    method: "POST",
    headers,
    body: JSON.stringify({
      nombre: "USE.AI",
      nombreComercial: "use.ai",
      nif: "",
      pais: "Estados Unidos",
      notas: "Suscripción cancelada el 09/09/2026. Justificantes de pago sin IVA.",
    }),
  });
  const creado = await crear.json();
  proveedorId = creado._id;
  console.log("Proveedor creado:", proveedorId);
} else {
  console.log("Proveedor existente:", proveedorId);
}

const documentos = [
  { fecha: "2026-07-09", numero: "USE-09072026", concepto: "Suscripción use.ai - justificante de pago 09/07/2026" },
  { fecha: "2026-08-06", numero: "USE-06082026", concepto: "Suscripción use.ai - justificante de pago 06/08/2026" },
  { fecha: "2026-09-03", numero: "USE-03092026", concepto: "Suscripción use.ai - justificante de pago 03/09/2026" },
];

for (const doc of documentos) {
  // 2. Crear factura de compra sin IVA
  const body = {
    proveedor: proveedorId,
    numeroFacturaProveedor: doc.numero,
    fechaExpedicion: doc.fecha,
    vencimiento: doc.fecha,
    divisa: "EUR",
    tipoCambio: 1,
    totalDivisa: 29.99,
    totalReal: 29.99,
    notas: doc.concepto,
    lineas: [
      {
        descripcion: doc.concepto,
        cantidad: 1,
        precioUnitario: 29.99,
        descuento: 0,
        iva: 0,
      },
    ],
  };

  const crear = await fetch("http://localhost:4700/api/facturas-compra", { method: "POST", headers, body: JSON.stringify(body) });
  const factura = await crear.json();
  if (!crear.ok) {
    console.error(`ERROR creando ${doc.numero}:`, factura.error || factura);
    continue;
  }
  console.log(`Creada ${doc.numero}: ${factura._id}`);

  // 3. Validar
  const val = await fetch(`http://localhost:4700/api/facturas-compra/${factura._id}/validar`, { method: "POST", headers });
  console.log(`  Validada ${doc.numero}:`, val.status);

  // 4. Conciliar con cargo bancario
  const movs = await (await fetch(`http://localhost:4700/api/tesoreria/extractos?limite=200`, { headers })).json();
  const cargo = movs
    .flatMap((e) => (e.movimientos ?? []).map((m) => ({ ...m, extractoId: e._id })))
    .find((m) =>
      Math.abs(m.importe + 29.99) < 0.05 &&
      m.fecha &&
      Math.abs(new Date(m.fecha) - new Date(doc.fecha)) < 5 * 86400000
    );

  if (cargo) {
    const conc = await fetch(`http://localhost:4700/api/tesoreria/extractos/${cargo.extractoId}/conciliar`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tipo: "factura_compra", id: factura._id }),
    });
    console.log(`  Conciliada ${doc.numero} con movimiento ${cargo._id}:`, conc.status);
  } else {
    console.log(`  No se encontró cargo bancario para ${doc.numero}`);
  }
}

console.log("FIN");
