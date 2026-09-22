import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUTA_SELLO = path.resolve(__dirname, "../../../client/public/sello-pagada.png");

// La imagen del sello se carga una vez: el buffer sirve para PDFKit y el
// data URI para incrustarla en las plantillas HTML del editor de formatos.
let cache = null;
function sello() {
  if (!cache) {
    const buffer = fs.readFileSync(RUTA_SELLO);
    cache = { buffer, dataUri: `data:image/png;base64,${buffer.toString("base64")}` };
  }
  return cache;
}

const MEDIOS = {
  transferencia: "transferencia",
  efectivo: "efectivo",
  tarjeta: "tarjeta",
  remesa: "remesa bancaria",
  otro: "otro medio",
};

const fechaTxt = (d) => {
  const f = new Date(d);
  return `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}/${f.getFullYear()}`;
};

// null si la factura NO está totalmente cobrada; si lo está, el texto del
// sello con la fecha y el medio del último cobro.
export function textoSelloPagada(factura) {
  if (!factura || factura.estado === "anulada") return null;
  const cobros = factura.cobros ?? [];
  const cobrado = cobros.reduce((s, c) => s + (c.importe ?? 0), 0);
  if (!(cobrado > 0 && cobrado + 0.005 >= (factura.total ?? 0))) return null;
  const ultimo = cobros[cobros.length - 1];
  return `Cobrada el ${fechaTxt(ultimo?.fecha ?? new Date())} por ${MEDIOS[ultimo?.metodo] ?? "transferencia"}`;
}

export function imagenSello() {
  return sello();
}

// Elementos de plantilla (editor de formatos) con el sello y el texto, para
// el hueco en blanco que queda bajo las líneas de la factura.
export function elementosSelloPagada(factura) {
  const texto = textoSelloPagada(factura);
  if (!texto) return null;
  return [
    { id: "sello-pagada", type: "image", x: 55, y: 232, w: 62, h: 20, src: sello().dataUri },
    {
      id: "sello-pagada-texto",
      type: "text",
      x: 50,
      y: 253,
      w: 72,
      h: 5,
      text: texto,
      fontSize: 7,
      bold: true,
      align: "center",
      color: "#1a8f4a",
    },
  ];
}
