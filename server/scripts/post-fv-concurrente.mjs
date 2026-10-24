import "dotenv/config";

const BASE = "http://localhost:4700";
const EMAIL = "stress.test@filanex.local";
const PASS = "StressTest123!";
const CLIENTE = "6a737c41ebc07aa6cadc760a";
const CONCURRENCIA = 50;

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const { token } = await login.json();

  const promesas = Array.from({ length: CONCURRENCIA }, () =>
    fetch(`${BASE}/api/facturas-venta`, {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        cliente: CLIENTE,
        lineas: [{ descripcion: "Prueba concurrencia FV", cantidad: 1, precioUnitario: 100, iva: 21 }],
        metodoPago: "Transferencia",
      }),
    })
  );

  const resultados = await Promise.all(promesas);
  let ok = 0, fail = 0;
  for (const r of resultados) {
    if (r.status === 201) ok++; else fail++;
  }
  console.log(`Creadas: ${ok}, Fallos: ${fail}`);
}
main().catch(console.error);
