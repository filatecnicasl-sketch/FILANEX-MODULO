import test from "node:test";
import assert from "node:assert/strict";
import { formatearIban, prepararCuentaFactura } from "../src/services/cuentaFactura.js";

const formato = () => ({ elements: [
  { id: "pago", type: "text", text: "Forma de pago: {{pago.metodo}}", x: 20, y: 210, w: 90, h: 5, fontSize: 9 },
  { id: "vence", type: "text", text: "Vencimiento: {{pago.vencimiento}}", x: 20, y: 218, w: 90, h: 5 },
  { id: "notas", type: "text", text: "{{notas}}", x: 20, y: 228, w: 95, h: 16 },
  { id: "total", type: "text", text: "TOTAL", x: 134, y: 218, w: 52, h: 5 },
  { id: "pie", type: "text", text: "Gracias", x: 20, y: 268, w: 170, h: 8 },
] });
const datos = { "pago.cuenta": "C/C ES91 2100 0418 4502 0005 1332" };

test("formatea el IBAN configurado sin mezclar cuentas ni inventar valores", () => {
  assert.equal(formatearIban(" es91 2100 0418 4502 0005 1332 "), "ES91 2100 0418 4502 0005 1332");
  assert.equal(formatearIban("DE89370400440532013000"), "DE89 3704 0044 0532 0130 00");
  assert.equal(formatearIban(null), "");
  assert.equal(formatearIban(undefined), "");
});

test("añade el campo dinámico debajo del pago, sin guardar ni modificar el original", () => {
  const original = formato();
  const copia = structuredClone(original);
  const resultado = prepararCuentaFactura(original, datos);
  assert.deepEqual(original, copia);
  const cuenta = resultado.elements.find(e => e.id === "cuenta-cobro-empresa");
  assert.equal(cuenta.text, "{{pago.cuenta}}");
  assert.equal(cuenta.y, 218);
  assert.equal(resultado.elements.find(e => e.id === "vence").y, 226);
  assert.equal(resultado.elements.find(e => e.id === "notas").y, 236);
  assert.equal(resultado.elements.find(e => e.id === "total").y, 218);
  assert.equal(resultado.elements.find(e => e.id === "pie").y, 268);
});

test("sin IBAN no añade una cuenta vacía ni desplaza el documento", () => {
  const original = formato();
  assert.deepEqual(prepararCuentaFactura(original, { "pago.cuenta": "" }), original);
});

test("no duplica la cuenta ni desplaza dos veces al preparar de nuevo", () => {
  const resultado = prepararCuentaFactura(formato(), datos);
  assert.deepEqual(prepararCuentaFactura(resultado, datos), resultado);
});

test("una cuenta fija anterior pasa a leer el campo de la empresa", () => {
  const original = formato();
  original.elements.push({ id: "cuenta-anterior", type: "text", text: "C/C ES66 2100 0418 4502 0005 1333", x: 20, y: 218, w: 90, h: 5 });
  const resultado = prepararCuentaFactura(original, datos);
  assert.equal(resultado.elements.length, original.elements.length);
  assert.equal(resultado.elements.at(-1).text, "{{pago.cuenta}}");
  assert.equal(original.elements.at(-1).text, "C/C ES66 2100 0418 4502 0005 1333");
});

test("respeta el diseño personalizado y no sustituye textos con más información", () => {
  const original = formato();
  original.elements.push({ type: "text", text: "Empresa: {{empresa.nombre}} / IBAN: {{empresa.iban}}", x: 20, y: 230, w: 90, h: 5 });
  assert.deepEqual(prepararCuentaFactura(original, datos), original);
});

test("los campos IBAN existentes no provocan duplicados", () => {
  const original = formato();
  original.elements.push({ type: "field", fieldKey: "empresa.iban", x: 20, y: 230, w: 90, h: 5 });
  assert.deepEqual(prepararCuentaFactura(original, datos), original);
});

test("la cuenta vacía elimina el rótulo suelto en un campo bancario independiente", () => {
  const original = formato();
  original.elements.push({ type: "text", text: "IBAN: {{empresa.iban}}", x: 20, y: 230, w: 90, h: 5 });
  assert.equal(prepararCuentaFactura(original, { "pago.cuenta": "" }).elements.at(-1).text, "{{pago.cuenta}}");
});

test("no inventa una posición si el formato no contiene forma de pago", () => {
  const original = { elements: [{ type: "text", text: "Cabecera", x: 20, y: 10, w: 90, h: 5 }] };
  assert.deepEqual(prepararCuentaFactura(original, datos), original);
  assert.equal(prepararCuentaFactura(null, datos), null);
});
