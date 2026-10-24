// Prueba búsqueda de mensajes con adjuntos Invoice-
const login = await fetch("http://localhost:4700/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "fbarroso@filatecnica.com", password: "Barroso@159000" }),
});
const { token } = await login.json();
const headers = { Authorization: `Bearer ${token}` };

const r = await fetch("http://localhost:4700/api/correo/entrante/mensajes?soloAdjuntos=1&limite=100&busqueda=Invoice-", { headers });
console.log("status:", r.status);
const datos = await r.json();
if (!r.ok) {
  console.log("error:", JSON.stringify(datos, null, 2));
} else {
  console.log("mensajes:", datos.length);
  for (const m of datos.slice(0, 10)) {
    console.log(`UID ${m.uid} | ${m.fecha?.slice(0, 10)} | ${m.asunto}`);
    for (const a of m.adjuntos) console.log(`  - ${a.nombre}`);
  }
  if (datos.length > 10) console.log(`... y ${datos.length - 10} más`);
}
