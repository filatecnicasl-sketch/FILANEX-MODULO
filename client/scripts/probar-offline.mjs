import { reglaOffline, respuestaSintetica } from "../src/lib/rutasOffline.js";

const casos = [
  ["POST", "/api/taller/recepcion", true],
  ["POST", "/api/taller/ordenes", true],
  ["PUT", "/api/taller/ordenes/abc123", true],
  ["POST", "/api/taller/citas", true],
  ["POST", "/api/servicio/recepcion", true],
  ["POST", "/api/servicio/ordenes", true],
  ["POST", "/api/clientes", true],
  ["POST", "/api/presupuestos", true],
  ["POST", "/api/albaranes-venta", true],
  ["POST", "/api/agenda/citas", true],
  ["POST", "/api/facturas-venta", false],
  ["POST", "/api/facturas-venta/abc/emitir", false],
  ["DELETE", "/api/clientes/abc", false],
  ["POST", "/api/certificado", false],
];

let fallos = 0;
for (const [metodo, url, esperado] of casos) {
  const resultado = Boolean(reglaOffline(metodo, url));
  const correcto = resultado === esperado;
  if (!correcto) fallos++;
  console.log(`${correcto ? "OK  " : "FALLO"} ${metodo.padEnd(6)} ${url} → ${resultado ? "encolable" : "requiere red"}`);
}

const reglaRecepcion = reglaOffline("POST", "/api/taller/recepcion");
const recepcion = respuestaSintetica(
  reglaRecepcion,
  { matricula: "1234-ABC", nombreCliente: "Cliente offline", motivo: "Revisión" },
  "tmp_operacion",
);
const recepcionCorrecta =
  recepcion._pendiente === true &&
  recepcion.orden?._id === "tmp_operacion" &&
  recepcion.vehiculo?._pendiente === true;
if (!recepcionCorrecta) fallos++;
console.log(`${recepcionCorrecta ? "OK  " : "FALLO"} Respuesta temporal de recepción conserva dependencias`);

if (fallos) {
  console.error(`\n${fallos} fallo(s) en la política offline.`);
  process.exit(1);
}
console.log(`\nPolítica offline correcta: ${casos.length + 1} comprobaciones.`);