import test from "node:test";
import assert from "node:assert/strict";
import { normalizarTelefonoWhatsApp } from "../src/services/whatsapp.js";
import { cifrarTokenWhatsApp, descifrarTokenWhatsApp } from "../src/services/whatsapp-crypto.js";

test("normaliza móviles españoles al formato E.164 de Meta", () => {
  assert.equal(normalizarTelefonoWhatsApp("612 345 678"), "34612345678");
  assert.equal(normalizarTelefonoWhatsApp("+34 612-345-678"), "34612345678");
  assert.equal(normalizarTelefonoWhatsApp("0034 912 345 678"), "34912345678");
});

test("conserva números internacionales válidos", () => {
  assert.equal(normalizarTelefonoWhatsApp("+33 6 12 34 56 78"), "33612345678");
});

test("rechaza teléfonos ambiguos o incompletos", () => {
  assert.throws(() => normalizarTelefonoWhatsApp("1234"), /no es válido/);
});

test("cifra el token sin almacenarlo en claro y lo recupera", () => {
  const anterior = process.env.CLAVE_WHATSAPP;
  process.env.CLAVE_WHATSAPP = "clave-de-pruebas-whatsapp-fil-anex-2026";
  try {
    const token = "token-secreto-meta";
    const cifrado = cifrarTokenWhatsApp(token);
    assert.notEqual(cifrado, token);
    assert.equal(descifrarTokenWhatsApp(cifrado), token);
  } finally {
    if (anterior === undefined) delete process.env.CLAVE_WHATSAPP;
    else process.env.CLAVE_WHATSAPP = anterior;
  }
});