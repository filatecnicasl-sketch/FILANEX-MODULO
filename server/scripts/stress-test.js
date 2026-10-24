/* Pruebas de estrés de FILANEX en localhost.
   Uso:
     node scripts/stress-test.js [email] [password]
   o con variables de entorno:
     FILANEX_EMAIL=admin@ejemplo.com FILANEX_PASS=clave node scripts/stress-test.js

   Escenarios:
   - 100 conexiones concurrentes contra /health (público).
   - Login con 10 concurrentes (para no disparar rate limiting).
   - Si se proporcionan credenciales:
     * GET /api/facturas-venta (listado con populate y cálculos).
     * POST /api/facturas-venta (creación de borrador).
     * GET /api/taller/ordenes (listado de taller).
     * POST /api/taller/ordenes (creación de OT).
*/

import autocannon from "autocannon";

const BASE = process.env.FILANEX_BASE || "http://localhost:4700";
const DURACION = Number(process.env.FILANEX_DURACION) || 10; // segundos
const EMAIL = process.argv[2] || process.env.FILANEX_EMAIL;
const PASS = process.argv[3] || process.env.FILANEX_PASS;

function imprimir(titulo, result) {
  console.log(`\n=== ${titulo} ===`);
  console.log(`  Peticiones: ${result.requests.total} (${result.requests.sent} enviadas)`);
  console.log(`  Errores: ${result.errors}`);
  console.log(`  Timeouts: ${result.timeouts}`);
  console.log(`  Latencia media: ${result.latency.average} ms`);
  console.log(`  Latencia p95: ${result.latency.p95} ms`);
  console.log(`  Latencia p99: ${result.latency.p99} ms`);
  console.log(`  Throughput: ${result.throughput.average} req/s`);
  console.log(`  Status 2xx: ${result["2xx"]}`);
  console.log(`  Status 4xx: ${result["4xx"]}`);
  console.log(`  Status 5xx: ${result["5xx"]}`);
}

async function lanzar(opts) {
  return new Promise((resolve, reject) => {
    const inst = autocannon({ ...opts, duration: DURACION }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    autocannon.track(inst, { renderLatencyTable: false, renderProgressBar: false });
  });
}

async function obtenerToken() {
  if (!EMAIL || !PASS) return null;
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!res.ok) {
    console.error(`Login falló: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data.token;
}

async function main() {
  console.log(`Base: ${BASE}`);
  console.log(`Duración por escenario: ${DURACION}s`);
  console.log(`Credenciales: ${EMAIL ? "sí" : "no"}`);

  // Login correcto UNA VEZ para obtener token sin disparar rate limit.
  const token = await obtenerToken();

  // 1. Health check (público) con 100 conexiones.
  const health = await lanzar({
    url: `${BASE}/health`,
    connections: 100,
    pipelining: 1,
  });
  imprimir("GET /health (100 conexiones)", health);

  if (!token) {
    console.log("\nNo se proporcionaron credenciales válidas. Para probar facturación y taller, pasa email y password.");
    return;
  }

  const authHeaders = { authorization: `Bearer ${token}` };

  // 2. Listado de facturas de venta.
  const facturasGet = await lanzar({
    url: `${BASE}/api/facturas-venta`,
    headers: authHeaders,
    connections: 100,
  });
  imprimir("GET /api/facturas-venta (100 conexiones)", facturasGet);

  // 3. Creación de facturas borrador.
  const facturasPost = await lanzar({
    url: `${BASE}/api/facturas-venta`,
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      cliente: "000000000000000000000000",
      lineas: [{ descripcion: "Prueba estrés", cantidad: 1, precioUnitario: 100, iva: 21 }],
      metodoPago: "Transferencia",
    }),
    connections: 50,
  });
  imprimir("POST /api/facturas-venta (50 conexiones)", facturasPost);

  // 4. Listado de órdenes de taller.
  const ordenesGet = await lanzar({
    url: `${BASE}/api/taller/ordenes`,
    headers: authHeaders,
    connections: 100,
  });
  imprimir("GET /api/taller/ordenes (100 conexiones)", ordenesGet);

  // 5. Creación de órdenes de taller.
  const ordenesPost = await lanzar({
    url: `${BASE}/api/taller/ordenes`,
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      matricula: "STRESS-TEST",
      motivo: "Prueba de carga",
      clienteNombre: "Cliente prueba",
      telefono: "600000000",
    }),
    connections: 50,
  });
  imprimir("POST /api/taller/ordenes (50 conexiones)", ordenesPost);

  // 6. Login de estrés con 1 conexión (omitido por defecto para no bloquear la IP con rate limiting).
  if (process.env.STRESS_LOGIN === "true") {
    const login = await lanzar({
      url: `${BASE}/api/auth/login`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: "wrong" }),
      connections: 1,
    });
    imprimir("POST /api/auth/login (1 conexión, cred. incorrectas)", login);
  } else {
    console.log("\nStress de login omitido. Usa STRESS_LOGIN=true para probarlo (bloqueará la IP tras 10 intentos).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
