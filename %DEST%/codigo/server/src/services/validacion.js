// Validaciones deterministas sobre los datos extraídos por OCR.
// Nada aquí llama a ninguna IA: son comprobaciones fiscales clásicas.

const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";
const LETRAS_CONTROL_CIF = "JABCDEFGHI";

function letraDNI(numeros) {
  return LETRAS_DNI[parseInt(numeros, 10) % 23];
}

function controlCIF(digitos) {
  let suma = 0;
  for (let i = 0; i < 7; i++) {
    const d = parseInt(digitos[i], 10);
    if (i % 2 === 0) {
      const doble = d * 2;
      suma += Math.floor(doble / 10) + (doble % 10);
    } else {
      suma += d;
    }
  }
  const control = (10 - (suma % 10)) % 10;
  return { digito: String(control), letra: LETRAS_CONTROL_CIF[control] };
}

export function validarNIF(valor) {
  if (!valor) return false;
  const nif = String(valor).toUpperCase().replace(/[\s.\-]/g, "");

  let m = nif.match(/^(\d{8})([A-Z])$/); // DNI
  if (m) return letraDNI(m[1]) === m[2];

  m = nif.match(/^([XYZ])(\d{7})([A-Z])$/); // NIE
  if (m) return letraDNI({ X: "0", Y: "1", Z: "2" }[m[1]] + m[2]) === m[3];

  m = nif.match(/^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/); // CIF
  if (m) {
    const { digito, letra } = controlCIF(m[2]);
    if ("PQRSWN".includes(m[1])) return m[3] === letra; // control letra obligatorio
    if ("ABEH".includes(m[1])) return m[3] === digito;   // control dígito obligatorio
    return m[3] === digito || m[3] === letra;            // resto: ambos válidos
  }
  return false;
}

export function normalizarNIF(valor) {
  return String(valor ?? "").toUpperCase().replace(/[\s.\-]/g, "");
}

// Comprueba que las líneas cuadran con los totales del documento.
// Devuelve una lista de avisos (vacía si todo cuadra).
export function revisarAritmetica(lineas, doc, tolerancia = 0.05) {
  const avisos = [];
  if (!lineas.length) {
    avisos.push("No se han detectado líneas en el documento");
    return avisos;
  }
  let base = 0;
  let iva = 0;
  for (const l of lineas) {
    const b = (l.cantidad ?? 0) * (l.precioUnitario ?? 0);
    base += b;
    iva += (b * (l.iva ?? 0)) / 100;
  }
  const total = base + iva;
  const difiere = (a, b) => Math.abs(a - b) > tolerancia;

  if (doc.baseImponible != null && difiere(base, doc.baseImponible)) {
    avisos.push(
      `La suma de líneas (${base.toFixed(2)}) no coincide con la base del documento (${doc.baseImponible})`
    );
  }
  if (doc.total != null && difiere(total, doc.total)) {
    avisos.push(
      `Base + IVA calculada (${total.toFixed(2)}) no coincide con el total del documento (${doc.total})`
    );
  }
  return avisos;
}
