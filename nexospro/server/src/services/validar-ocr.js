// Comprobaciones sobre lo que devuelve la IA.
//
// Sirven para dos cosas:
//  1. Decidir si el resultado del modelo rápido es fiable o hay que repetir
//     con el modelo de calidad (así el caso normal va rápido y el difícil
//     sigue saliendo bien).
//  2. Cuadrar la aritmética y avisar al usuario de lo que debe revisar antes
//     de validar el documento.

const cerca = (a, b, tolerancia = 0.02) => Math.abs(Number(a ?? 0) - Number(b ?? 0)) <= tolerancia;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const redondear = (n) => Math.round(n * 100) / 100;

const TIPOS_IVA = [0, 4, 5, 10, 21];

// Letra de control del NIF/CIF español. Un NIF mal leído es el fallo más
// típico del OCR y el que más molesta después (duplica proveedores).
export function nifValido(nif) {
  if (!nif) return false;
  const limpio = String(nif).toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!/^[0-9A-Z][0-9]{7}[0-9A-Z]$/.test(limpio)) return false;
  const LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";
  // DNI y NIE
  if (/^[0-9]{8}[A-Z]$/.test(limpio)) {
    return LETRAS[Number(limpio.slice(0, 8)) % 23] === limpio[8];
  }
  if (/^[XYZ][0-9]{7}[A-Z]$/.test(limpio)) {
    const n = Number(String("XYZ".indexOf(limpio[0])) + limpio.slice(1, 8));
    return LETRAS[n % 23] === limpio[8];
  }
  // CIF de sociedades
  if (/^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(limpio)) {
    const digitos = limpio.slice(1, 8).split("").map(Number);
    let suma = 0;
    digitos.forEach((d, i) => {
      if (i % 2 === 0) {
        const doble = d * 2;
        suma += Math.floor(doble / 10) + (doble % 10);
      } else {
        suma += d;
      }
    });
    const control = (10 - (suma % 10)) % 10;
    const ultimo = limpio[8];
    return ultimo === String(control) || ultimo === "JABCDEFGHI"[control];
  }
  return false;
}

// Una fecha de documento real no puede ser del futuro ni de hace 30 años.
export function fechaRazonable(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha ?? ""))) return false;
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const hoy = new Date();
  const maximo = new Date(hoy.getTime() + 2 * 24 * 3600 * 1000); // margen por husos horarios
  const minimo = new Date(hoy.getFullYear() - 15, 0, 1);
  return d <= maximo && d >= minimo;
}

// Cuadra base / cuota / total / tipo a partir de lo que haya llegado.
// Devuelve además si los números que trajo la IA ya eran coherentes.
export function cuadrarIva({ base, cuotaIva, total, tipoIva }) {
  let b = num(base);
  let c = num(cuotaIva);
  let t = num(total);
  let tipo = num(tipoIva);

  const coherenteOrigen = b > 0 && t > 0 && cerca(b + c, t) && (tipo === 0 || cerca(c, (b * tipo) / 100, 0.05));

  // Con dos datos cualesquiera se deducen los demás.
  if (!b && t && tipo) b = t / (1 + tipo / 100);
  if (!c && b && tipo) c = (b * tipo) / 100;
  if (!t && b) t = b + c;
  if (!tipo && b > 0 && c > 0) {
    const calculado = (c / b) * 100;
    tipo = TIPOS_IVA.find((x) => cerca(x, calculado, 0.6)) ?? redondear(calculado);
  }
  // Si base y cuota no suman el total, manda el total (es el dato que mejor
  // se lee en un ticket: suele ir en grande).
  if (t > 0 && b > 0 && !cerca(b + c, t)) {
    if (tipo > 0) {
      b = t / (1 + tipo / 100);
      c = t - b;
    } else {
      c = t - b;
    }
  }
  return { base: redondear(b), cuotaIva: redondear(c), total: redondear(t), tipoIva: tipo, coherenteOrigen };
}

/**
 * ¿Es fiable lo que ha devuelto la IA para un ticket de gasto?
 * Devuelve { ok, problemas } — si no es ok, se repite con el modelo bueno.
 */
export function revisarTicket(d) {
  const problemas = [];
  if (!d) return { ok: false, problemas: ["sin respuesta"] };
  if (!(num(d.total) > 0)) problemas.push("no se ha leído el importe total");
  if (!String(d.comercio ?? "").trim()) problemas.push("no se ha leído el establecimiento");
  if (!fechaRazonable(d.fecha)) problemas.push("la fecha no es válida");
  if (d.nifComercio && !nifValido(d.nifComercio)) problemas.push("el NIF leído no es correcto");
  if (num(d.tipoIva) && !TIPOS_IVA.includes(num(d.tipoIva))) {
    problemas.push(`el tipo de IVA leído (${d.tipoIva} %) no existe en España`);
  }
  const cuadre = cuadrarIva(d);
  if (num(d.base) > 0 && num(d.total) > 0 && !cuadre.coherenteOrigen) {
    problemas.push("los importes no cuadran entre sí");
  }
  if (num(d.confianza) > 0 && num(d.confianza) < 0.55) problemas.push("lectura poco segura");
  return { ok: problemas.length === 0, problemas };
}

/**
 * ¿Es fiable lo leído de una factura o albarán de compra?
 * Aquí se exige más porque de aquí salen los importes que van al 303.
 */
export function revisarDocumentoCompra(d) {
  const problemas = [];
  if (!d) return { ok: false, problemas: ["sin respuesta"] };
  if (!String(d.proveedor?.nombre ?? "").trim()) problemas.push("no se ha leído el proveedor");
  if (!Array.isArray(d.lineas) || d.lineas.length === 0) problemas.push("no se han leído las líneas");
  if (d.proveedor?.nif && !nifValido(d.proveedor.nif)) problemas.push("el NIF del proveedor no es correcto");
  if (d.fecha && !fechaRazonable(d.fecha)) problemas.push("la fecha no es válida");

  // La suma de las líneas debe parecerse a la base declarada del documento.
  if (Array.isArray(d.lineas) && d.lineas.length) {
    const sumaLineas = d.lineas.reduce((s, l) => {
      const bruto = num(l.cantidad) * num(l.precio);
      return s + bruto * (1 - num(l.descuento) / 100);
    }, 0);
    const base = num(d.baseImponible) || num(d.total) / 1.21;
    if (sumaLineas > 0 && base > 0 && Math.abs(sumaLineas - base) / base > 0.03) {
      problemas.push("la suma de las líneas no coincide con la base imponible");
    }
    if (d.lineas.some((l) => !String(l.descripcion ?? "").trim())) {
      problemas.push("hay líneas sin descripción");
    }
  }
  return { ok: problemas.length === 0, problemas };
}

// La valoración de daños no tiene aritmética fiscal: basta con que traiga
// operaciones con contenido.
export function revisarValoracion(d) {
  const problemas = [];
  const secciones = [d?.mano_de_obra, d?.pintura, d?.piezas].filter(Array.isArray);
  const total = secciones.reduce((s, x) => s + x.length, 0);
  if (!total) problemas.push("no se ha leído ninguna operación");
  return { ok: problemas.length === 0, problemas };
}
