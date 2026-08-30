// Configuración de periféricos del TPV, por terminal (localStorage de este
// equipo/tablet): impresora de tickets, cajón portamonedas y escáner.
//
// Modos de impresión:
//  - "navegador": abre el ticket HTML y usa el diálogo de impresión (funciona
//    con cualquier impresora instalada en el sistema, incluida compartida).
//  - "escpos": impresión directa ESC/POS por Web Serial (Chrome/Edge en PC),
//    sin diálogo y con apertura del cajón portamonedas por el RJ11 de la
//    impresora. La impresora debe estar conectada por USB-serie o puerto serie.

const CLAVE = "filanex.tpvHardware";

export const CONFIG_DEFECTO = {
  impresion: {
    modo: "navegador", // navegador | escpos
    ancho: 80, // 80 | 58 (mm)
    copias: 1,
    autoImprimir: true, // imprimir automáticamente al cobrar
  },
  cajon: {
    abrirEfectivo: true, // abrir el cajón al cobrar en efectivo
    abrirSiempre: false, // abrir también con tarjeta/otros
  },
  escaner: {
    sonido: true, // pitido al añadir por escáner/toque
  },
};

export function cargarConfigHardware() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE) || "{}");
    return {
      impresion: { ...CONFIG_DEFECTO.impresion, ...(guardada.impresion ?? {}) },
      cajon: { ...CONFIG_DEFECTO.cajon, ...(guardada.cajon ?? {}) },
      escaner: { ...CONFIG_DEFECTO.escaner, ...(guardada.escaner ?? {}) },
    };
  } catch {
    return structuredClone(CONFIG_DEFECTO);
  }
}

export function guardarConfigHardware(cfg) {
  localStorage.setItem(CLAVE, JSON.stringify(cfg));
}

// ------------------------------------------------------------- ESC/POS ----

const ESC = 0x1b;
const GS = 0x1d;

function bytes(...vals) {
  return vals.flatMap((v) => (Array.isArray(v) ? v : [v]));
}

function texto(s) {
  // ESC/POS clásico trabaja en CP858/latin1: quitamos el euro por "EUR"
  // si la impresora no lo soporta y normalizamos tildes a latin1.
  return Array.from(
    new TextEncoder("latin1", { NON_BMP_ASCII_REPLACEMENT: 0x3f }).encode(
      s.replace(/€/g, " EUR")
    )
  ).map((b) => (b > 0xff ? 0x3f : b));
}

function linea(txt = "") {
  return bytes(texto(txt), 0x0a);
}

function lineaDos(izq, der, anchoCaracteres) {
  const espacios = Math.max(1, anchoCaracteres - izq.length - der.length);
  return linea(izq + " ".repeat(espacios) + der);
}

const eurosTxt = (n) => `${(Math.round((n ?? 0) * 100) / 100).toFixed(2).replace(".", ",")} EUR`;

// Comando de apertura del cajón conectado al RJ11 de la impresora
// (ESC p m t1 t2 — pulso al pin 2).
function comandoAbrirCajon() {
  return bytes(ESC, 0x70, 0x00, 50, 200);
}

// Construye los bytes ESC/POS de un ticket (normal o regalo).
export function construirTicketEscPos(ticket, empresa, { ancho = 80, regalo = false } = {}) {
  const cols = ancho === 58 ? 32 : 42;
  const sep = "-".repeat(cols);
  const partes = [];

  partes.push(bytes(ESC, 0x40)); // init
  partes.push(bytes(ESC, 0x61, 0x01)); // centrado
  partes.push(bytes(GS, 0x21, 0x01)); // doble altura
  partes.push(linea(empresa?.nombre ?? ""));
  partes.push(bytes(GS, 0x21, 0x00));
  if (!regalo && empresa?.nif) partes.push(linea(`NIF ${empresa.nif}`));
  partes.push(linea(sep));

  const fecha = new Date(ticket.fechaExpedicion);
  const fechaTxt = `${fecha.toLocaleDateString("es-ES")} ${fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
  partes.push(bytes(ESC, 0x61, 0x00)); // izquierda
  if (regalo) {
    partes.push(bytes(ESC, 0x61, 0x01, GS, 0x21, 0x01));
    partes.push(linea("TICKET REGALO"));
    partes.push(bytes(GS, 0x21, 0x00, ESC, 0x61, 0x00));
    partes.push(linea(sep));
    partes.push(linea(`No ${ticket.serieNumero}  ${fechaTxt}`));
  } else {
    partes.push(linea("FACTURA SIMPLIFICADA"));
    partes.push(linea(`No ${ticket.serieNumero}  ${fechaTxt}`));
  }
  partes.push(linea(sep));

  for (const l of ticket.lineas ?? []) {
    partes.push(linea(`${l.descripcion}`));
    const precioUd = l.precioUnitario ?? l.precio ?? 0;
    if (!regalo) {
      const totalLinea = l.cantidad * precioUd * (1 - (l.descuento ?? 0) / 100) * (1 + l.iva / 100);
      partes.push(lineaDos(`  ${l.cantidad} x ${eurosTxt(precioUd)}`, eurosTxt(totalLinea), cols));
    } else {
      partes.push(linea(`  x ${l.cantidad}`));
    }
  }
  partes.push(linea(sep));

  const base = ticket.baseImponible ?? ticket.base ?? 0;
  const metodoPago = ticket.cobros?.[0]?.metodo ?? ticket.metodoCobro ?? "efectivo";

  if (regalo) {
    partes.push(bytes(ESC, 0x61, 0x01));
    partes.push(linea("Documento valido para cambios."));
    partes.push(linea("Sin valor fiscal."));
    partes.push(linea(sep));
    partes.push(linea("Gracias por su compra"));
  } else {
    partes.push(lineaDos("Base imponible", eurosTxt(base), cols));
    partes.push(lineaDos("IVA", eurosTxt(ticket.cuotaIva), cols));
    partes.push(bytes(GS, 0x21, 0x01));
    partes.push(lineaDos("TOTAL", eurosTxt(ticket.total), Math.floor(cols / 2)));
    partes.push(bytes(GS, 0x21, 0x00));
    partes.push(linea(`Pago: ${metodoPago}`));
    partes.push(bytes(ESC, 0x61, 0x01));
    partes.push(linea(sep));
    partes.push(linea("Gracias por su compra"));
    partes.push(linea("Verificado en Veri*factu - AEAT"));
  }

  partes.push(linea(""));
  partes.push(linea(""));
  partes.push(bytes(GS, 0x56, 0x42, 3)); // corte parcial con avance
  return new Uint8Array(partes.flat());
}

// Ticket de prueba para el botón "Imprimir prueba" de la configuración.
export function construirTicketPrueba({ ancho = 80 } = {}) {
  return construirTicketEscPos(
    {
      serieNumero: "PRUEBA",
      fechaExpedicion: new Date().toISOString(),
      lineas: [
        { descripcion: "Articulo de prueba", cantidad: 1, precioUnitario: 1, iva: 21 },
        { descripcion: "Segunda linea del ticket", cantidad: 2, precioUnitario: 0.5, iva: 21 },
      ],
      baseImponible: 1.65,
      cuotaIva: 0.35,
      total: 2,
      cobros: [{ metodo: "efectivo" }],
    },
    { nombre: "FILANEX — prueba de impresora", nif: "" },
    { ancho }
  );
}

// ---------------------------------------------------------- Web Serial ----

export const soportaEscPos = typeof navigator !== "undefined" && "serial" in navigator;

let puerto = null;

// Pide al usuario elegir la impresora serie/USB (requiere gesto del usuario).
export async function conectarImpresora() {
  if (!soportaEscPos) throw new Error("Este navegador no soporta impresión directa (usa Chrome o Edge en el PC)");
  puerto = await navigator.serial.requestPort();
  await puerto.open({ baudRate: 9600 });
  return true;
}

// Reutiliza un puerto ya concedido en sesiones anteriores (sin pedir permiso).
export async function reconectarImpresora() {
  if (!soportaEscPos) return false;
  if (puerto?.writable) return true;
  const puertos = await navigator.serial.getPorts();
  if (!puertos.length) return false;
  puerto = puertos[0];
  if (!puerto.writable) await puerto.open({ baudRate: 9600 });
  return true;
}

async function enviar(datos) {
  if (!(await reconectarImpresora())) {
    throw new Error("Impresora no conectada: pulsa «Conectar impresora» en Periféricos");
  }
  const escritor = puerto.writable.getWriter();
  try {
    await escritor.write(datos instanceof Uint8Array ? datos : new Uint8Array(datos));
  } finally {
    escritor.releaseLock();
  }
}

export async function imprimirEscPos(bytesTicket, { copias = 1, abrirCajonAntes = false } = {}) {
  for (let i = 0; i < copias; i++) {
    if (abrirCajonAntes && i === 0) await enviar(comandoAbrirCajon());
    await enviar(bytesTicket);
  }
}

export async function abrirCajon() {
  await enviar(comandoAbrirCajon());
}

// Decide si hay que abrir el cajón según la config y el método de cobro.
export function debeAbrirCajon(cfg, metodoCobro) {
  if (cfg.cajon.abrirSiempre) return true;
  return cfg.cajon.abrirEfectivo && metodoCobro === "efectivo";
}

// Imprime un ticket según la configuración del terminal: directo ESC/POS o
// ventana del navegador con el HTML de 80 mm.
export async function imprimirTicketSegunConfig(cfg, { ticket, empresa, imprimirUrl, regalo = false }) {
  if (cfg.impresion.modo === "escpos" && soportaEscPos) {
    try {
      const bytesTicket = construirTicketEscPos(ticket, empresa, {
        ancho: cfg.impresion.ancho,
        regalo,
      });
      await imprimirEscPos(bytesTicket, {
        copias: regalo ? 1 : cfg.impresion.copias,
        abrirCajonAntes: !regalo && debeAbrirCajon(cfg, ticket.cobros?.[0]?.metodo ?? ticket.metodoCobro),
      });
      return "escpos";
    } catch {
      // Si falla la impresora directa, cae al modo navegador.
    }
  }
  const url = regalo ? `${imprimirUrl}${imprimirUrl.includes("?") ? "&" : "?"}regalo=1` : imprimirUrl;
  const w = window.open(url, "_blank", "width=400,height=600");
  if (w) w.focus();
  return "navegador";
}
