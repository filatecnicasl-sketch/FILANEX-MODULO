import "dotenv/config";

const EMAIL = "stress.test@filanex.local";
const PASS = "StressTest123!";

async function main() {
  const login = await fetch("http://localhost:4700/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const { token } = await login.json();

  const r = await fetch("http://localhost:4700/api/taller/ordenes", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ matricula: "STRESS-TEST", motivo: "Prueba", clienteNombre: "X", telefono: "600000000" }),
  });
  console.log("Status:", r.status);
  console.log("Body:", await r.text());
}

main();
