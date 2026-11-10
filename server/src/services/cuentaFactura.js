export function formatearIban(valor) {
  const iban = String(valor ?? "").replace(/\s+/g, "").toUpperCase();
  return iban.match(/.{1,4}/g)?.join(" ") ?? "";
}

export function prepararCuentaFactura(plantilla, datos) {
  if (!plantilla) return plantilla;
  const copia = { ...plantilla, elements: (plantilla.elements ?? []).map(elemento => ({ ...elemento })) };
  const cuentaExistente = copia.elements.find(elemento =>
    /\{\{\s*(?:empresa\.iban|pago\.(?:iban|cuenta))\s*\}\}/.test(elemento.text ?? "") ||
    ["empresa.iban", "pago.iban", "pago.cuenta"].includes(elemento.fieldKey) ||
    /^(?:C\/C|IBAN)\s*:?\s*[A-Z]{2}\d{2}[A-Z\d ]+$/i.test(elemento.text ?? "")
  );
  if (cuentaExistente) {
    if (cuentaExistente.type === "text" && /^(?:(?:C\/C|IBAN)\s*:?\s*)?(?:\{\{\s*(?:empresa\.iban|pago\.(?:iban|cuenta))\s*\}\}|[A-Z]{2}\d{2}[A-Z\d ]+)$/i.test(cuentaExistente.text.trim())) {
      cuentaExistente.text = "{{pago.cuenta}}";
    }
    return copia;
  }
  if (!datos["pago.cuenta"]) return plantilla;
  const pago = copia.elements.find(elemento =>
    /\{\{\s*pago\.metodo\s*\}\}/.test(elemento.text ?? "") || elemento.fieldKey === "pago.metodo"
  );
  if (!pago) return plantilla;
  const cuenta = {
    id: "cuenta-cobro-empresa",
    type: "text",
    x: pago.x,
    y: pago.y + pago.h + 3,
    w: pago.w,
    h: 5,
    fontSize: Math.min(pago.fontSize ?? 9, 9),
    color: pago.color ?? "#4b5563",
    align: "left",
    text: "{{pago.cuenta}}",
  };
  let limite = cuenta.y + cuenta.h + 3;
  const inferiores = copia.elements.filter(elemento => elemento !== pago && elemento.y >= cuenta.y &&
    elemento.x < cuenta.x + cuenta.w && elemento.x + elemento.w > cuenta.x).sort((primero, segundo) => primero.y - segundo.y);
  for (const elemento of inferiores) {
    if (elemento.y >= limite) break;
    elemento.y += cuenta.h + 3;
    limite = Math.max(limite, elemento.y + elemento.h + 3);
  }
  copia.elements.push(cuenta);
  return copia;
}
