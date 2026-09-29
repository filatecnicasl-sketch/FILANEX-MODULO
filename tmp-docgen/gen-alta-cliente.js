// Hoja de alta de cliente FILANEX — identidad corporativa (navy + turquesa, Poppins)
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, TableLayoutType,
} = require("docx");

const NAVY = "060B16";
const NAVY2 = "131B30";
const TURQ = "22D3EE";
const GRIS = "CBD5E1";
const GRIS_CLARO = "F1F5F9";
const TEXTO = "1E293B";
const FUENTE = "Poppins";

const PW = 9638; // ancho imprimible A4 con márgenes de 1134 dxa

const borde = (color = GRIS) => ({ style: BorderStyle.SINGLE, size: 4, color });
const sinBorde = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const bordes = (color) => ({ top: borde(color), bottom: borde(color), left: borde(color), right: borde(color) });

function txt(t, opts = {}) {
  return new TextRun({ text: t, font: FUENTE, color: opts.color ?? TEXTO, size: opts.size ?? 20, bold: opts.bold, italics: opts.italics });
}

function celdaEtiqueta(texto, w) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: { fill: GRIS_CLARO, type: ShadingType.CLEAR },
    borders: bordes(),
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [txt(texto, { bold: true, size: 15, color: NAVY2 })] })],
  });
}

function celdaCampo(w, alto = false) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: bordes(),
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [txt(alto ? "\n" : "", {})] })],
  });
}

function filaCampo(e1, w1, e2, w2) {
  const cols = e2 ? [celdaEtiqueta(e1, w1), celdaCampo(Math.round((PW - w1 * 2 - w2) / 1)), null] : null;
  return null;
}

// Fila con anchos a medida: cada par es [etiqueta, anchoEtiqueta, anchoCampo].
// Devuelve las celdas y sus anchos para montar una tabla propia por fila
// (así Word y LibreOffice respetan los anchos exactos).
function fila(pares) {
  const celdas = [];
  const widths = [];
  pares.forEach((p) => {
    celdas.push(celdaEtiqueta(p[0], p[1]));
    celdas.push(celdaCampo(p[2]));
    widths.push(p[1], p[2]);
  });
  return { celdas, widths };
}

// Cada fila se convierte en una tabla independiente con columnWidths exactos;
// al ir pegadas se ven como una única tabla continua.
function tablaCampos(filas) {
  return filas.map((f) => new Table({
    width: { size: f.widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: f.widths,
    layout: TableLayoutType.FIXED,
    borders: { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde, insideHorizontal: sinBorde, insideVertical: sinBorde },
    rows: [new TableRow({ children: f.celdas })],
  }));
}

function cabeceraSeccion(num, titulo) {
  return new Paragraph({
    spacing: { before: 300, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TURQ, space: 4 } },
    children: [
      txt(`${num}  `, { bold: true, size: 26, color: TURQ }),
      txt(titulo.toUpperCase(), { bold: true, size: 24, color: NAVY }),
    ],
  });
}

function checks(items, sep = "    ") {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: items.flatMap((it, i) => [
      txt("☐  ", { size: 22, color: TURQ }),
      txt(it + (i < items.length - 1 ? sep : ""), { size: 20 }),
    ]),
  });
}

function cajaGris(children) {
  return new Table({
    width: { size: PW, type: WidthType.DXA },
    columnWidths: [PW],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: PW, type: WidthType.DXA },
        shading: { fill: GRIS_CLARO, type: ShadingType.CLEAR },
        borders: bordes(),
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children,
      })],
    })],
  });
}

const logo = fs.readFileSync("C:\\FILANEX-MODULO\\nexospro\\client\\public\\icono-512.png");

const header = new Header({
  children: [
    new Table({
      width: { size: PW, type: WidthType.DXA },
      columnWidths: [1200, PW - 1200],
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 1200, type: WidthType.DXA },
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            borders: { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 140, bottom: 140, left: 200, right: 60 },
            children: [new Paragraph({
              children: [new ImageRun({ type: "png", data: logo, transformation: { width: 46, height: 46 }, altText: { title: "FILANEX", description: "Logo FILANEX", name: "logo" } })],
            })],
          }),
          new TableCell({
            width: { size: PW - 1200, type: WidthType.DXA },
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            borders: { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 140, bottom: 140, left: 60, right: 200 },
            children: [
              new Paragraph({ children: [txt("FILANEX", { bold: true, size: 32, color: "FFFFFF" })] }),
              new Paragraph({ children: [txt("Hoja de alta de cliente", { size: 18, color: TURQ })] }),
            ],
          }),
        ],
      })],
    }),
    new Paragraph({ spacing: { after: 100 }, children: [] }),
  ],
});

const footer = new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 8, color: TURQ, space: 6 } },
      children: [
        txt("Filatecnica S.L. · info@filatecnica.com · app.filanex.es", { size: 16, color: "64748B" }),
        txt("      Página ", { size: 16, color: "64748B" }),
        new TextRun({ children: [PageNumber.CURRENT], font: FUENTE, size: 16, color: "64748B" }),
        txt(" de ", { size: 16, color: "64748B" }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FUENTE, size: 16, color: "64748B" }),
      ],
    }),
  ],
});

const children = [
  new Paragraph({ spacing: { before: 120, after: 60 }, children: [txt("Datos para dar de alta una nueva empresa en FILANEX. Rellénala en digital o a mano y devuélvela a ", { size: 20, color: "475569" }), txt("info@filatecnica.com", { size: 20, bold: true, color: NAVY }), txt(".", { size: 20, color: "475569" })] }),

  // 1 · EMPRESA
  cabeceraSeccion("1 ·", "Datos de la empresa"),
  ...tablaCampos([
    fila([["Nombre comercial", 1750, 2950], ["Razón social", 1400, 3538]]),
    fila([["CIF / NIF", 1200, 1900], ["Actividad / sector", 1800, 4738]]),
    fila([["Dirección", 1250, 8388]]),
    fila([["Código postal", 1450, 1250], ["Localidad", 1250, 5688]]),
    fila([["Provincia", 1250, 3050], ["Teléfono", 1200, 4138]]),
    fila([["Email general", 1400, 3050], ["Página web", 1300, 3888]]),
  ]),

  // 2 · CONTACTO
  cabeceraSeccion("2 ·", "Persona de contacto"),
  ...tablaCampos([
    fila([["Nombre y apellidos", 1750, 3450], ["Cargo", 900, 3538]]),
    fila([["Teléfono directo", 1550, 2200], ["Email", 850, 5038]]),
  ]),

  // 3 · MÓDULOS
  cabeceraSeccion("3 ·", "Módulos contratados"),
  cajaGris([
    checks(["Facturación", "Taller", "TPV", "Asesoría", "Telefonía", "Agente IA Nexo"]),
    new Paragraph({ children: [txt("Observaciones sobre módulos: ", { size: 18, color: "64748B" })] }),
  ]),

  // 4 · PLAN Y PAGO
  cabeceraSeccion("4 ·", "Plan y condiciones"),
  cajaGris([
    new Paragraph({ spacing: { after: 80 }, children: [
      txt("Plan:   ", { bold: true, size: 20, color: NAVY2 }),
      ...["Básico", "Profesional", "A medida"].flatMap((it, i) => [txt("☐  ", { size: 24, color: TURQ }), txt(it + "      ", { size: 20 })]),
      txt("Cuota: ", { bold: true, size: 20, color: NAVY2 }), txt("________ €/mes      ", { size: 20 }),
      txt("Oferta primer año: ", { bold: true, size: 20, color: NAVY2 }), txt("250 €", { size: 20, bold: true, color: TURQ }),
    ] }),
    new Paragraph({ children: [
      txt("Forma de pago:   ", { bold: true, size: 20, color: NAVY2 }),
      txt("☐  ", { size: 22, color: TURQ }), txt("Domiciliación (rellena el IBAN de abajo)      ", { size: 20 }),
      txt("☐  ", { size: 22, color: TURQ }), txt("Transferencia", { size: 20 }),
    ] }),
    new Paragraph({ spacing: { before: 40 }, children: [
      txt("Si eliges transferencia, hazla a:  ", { size: 18, color: "475569" }),
      txt("ES21 0049 2388 1725 1480 1871", { size: 18, bold: true, color: NAVY }),
      txt("  indicando el nombre de tu empresa en el concepto.", { size: 18, color: "475569" }),
    ] }),
  ]),
  ...tablaCampos([
    fila([["IBAN (si domicilia)", 1800, 7838]]),
    fila([["Titular de la cuenta", 1900, 3700], ["Fecha de inicio", 1500, 2538]]),
  ]),

  // 5 · MIGRACIÓN
  cabeceraSeccion("5 ·", "Programa actual y datos a migrar"),
  ...tablaCampos([fila([["Programa que usa ahora", 2350, 7288]])]),
  cajaGris([
    new Paragraph({ spacing: { after: 40 }, children: [txt("Datos que quiere traer:", { bold: true, size: 20, color: NAVY2 })] }),
    checks(["Clientes", "Proveedores", "Artículos", "Facturas", "Stock", "Vehículos", "Ninguno"], "  "),
  ]),

  // 6 · ACCESO
  cabeceraSeccion("6 ·", "Acceso al programa"),
  ...tablaCampos([
    fila([["Usuario administrador", 2000, 2950], ["Email de acceso", 1550, 3138]]),
    fila([["Nº de usuarios", 1500, 1200], ["Puestos / dispositivos", 1950, 4988]]),
  ]),
  new Paragraph({ spacing: { before: 60, after: 60 }, children: [txt("La contraseña inicial y la dirección de acceso se envían por email al activar el alta.", { size: 17, italics: true, color: "64748B" })] }),

  // 7 · RGPD Y FIRMA
  cabeceraSeccion("7 ·", "Protección de datos y firma"),
  new Paragraph({ spacing: { after: 160 }, children: [txt("Los datos facilitados se tratan por Filatecnica S.L. con la única finalidad de gestionar el alta y la prestación del servicio FILANEX, conforme al RGPD (UE) 2016/679. No se ceden a terceros. Puedes ejercer tus derechos de acceso, rectificación, supresión y portabilidad escribiendo a info@filatecnica.com.", { size: 16, color: "475569" })] }),
  new Table({
    width: { size: PW, type: WidthType.DXA },
    columnWidths: [Math.round(PW / 2), Math.round(PW / 2)],
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: Math.round(PW / 2), type: WidthType.DXA },
          borders: { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde },
          children: [
            new Paragraph({ children: [txt("En ____________ a ___ de ________ de 20___", { size: 16 })] }),
          ],
        }),
        new TableCell({
          width: { size: Math.round(PW / 2), type: WidthType.DXA },
          borders: { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde },
          children: [
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [txt("Firmado:  ", { size: 18 })] }),
            new Paragraph({ children: [] }), new Paragraph({ children: [] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [txt("___________________________________", { size: 18, color: "94A3B8" })] }),
          ],
        }),
      ],
    })],
  }),

  // USO INTERNO
  new Paragraph({ spacing: { before: 360, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 4 } }, children: [txt("PARA USO INTERNO DE FILANEX", { bold: true, size: 20, color: NAVY })] }),
  ...tablaCampos([
    fila([["Slug asignado", 1450, 2600], ["Fecha de alta", 1350, 4238]]),
    fila([["Licencia / plan creado", 2000, 2050], ["Alta confirmada por", 1850, 3738]]),
  ]),
];

const doc = new Document({
  styles: { default: { document: { run: { font: FUENTE, size: 20, color: TEXTO } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, right: 1134, bottom: 850, left: 1134 } } },
    headers: { default: header },
    footers: { default: footer },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("D:\\FILANEX\\hoja-alta-cliente-filanex.docx", buf);
  console.log("OK hoja-alta-cliente-filanex.docx");
});
