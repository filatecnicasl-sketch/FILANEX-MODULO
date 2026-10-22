// Genera la propuesta de proyecto "El Copiloto de Mejora Continua" (.docx)
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat, VerticalAlign,
} = require("docx");

// ---------- Paleta y medidas ----------
const AZUL = "1F4E79";       // azul profundo (títulos)
const AZUL_CLARO = "DEEBF7"; // cabeceras de tabla
const GRIS = "595959";       // texto secundario
const ZEBRA = "F4F8FC";      // filas alternas
const FUENTE = "Calibri";
const ANCHO_UTIL = 9026;     // A4 con márgenes de 2 cm

// ---------- Helpers ----------
const p = (texto, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 160, before: opts.before ?? 0 },
    alignment: opts.align,
    children: [
      new TextRun({
        text: texto,
        font: FUENTE,
        size: opts.size ?? 22,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color,
      }),
    ],
  });

const pMixta = (trozos, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 160, before: opts.before ?? 0 },
    alignment: opts.align,
    children: trozos.map(
      (t) =>
        new TextRun({
          text: t.texto,
          font: FUENTE,
          size: opts.size ?? 22,
          bold: t.bold,
          italics: t.italicos,
          color: t.color,
        })
    ),
  });

const h1 = (texto) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text: texto, font: FUENTE, size: 30, bold: true, color: AZUL })],
  });

const h2 = (texto) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 160 },
    children: [new TextRun({ text: texto, font: FUENTE, size: 25, bold: true, color: AZUL })],
  });

const vineta = (texto, boldInicial) => {
  const runs = [];
  if (boldInicial) {
    runs.push(new TextRun({ text: boldInicial, font: FUENTE, size: 22, bold: true }));
  }
  runs.push(new TextRun({ text: texto, font: FUENTE, size: 22 }));
  return new Paragraph({
    numbering: { reference: "vinetas", level: 0 },
    spacing: { after: 100 },
    children: runs,
  });
};

const paso = (texto, boldInicial) =>
  new Paragraph({
    numbering: { reference: "pasos", level: 0 },
    spacing: { after: 110 },
    children: [
      ...(boldInicial
        ? [new TextRun({ text: boldInicial, font: FUENTE, size: 22, bold: true })]
        : []),
      new TextRun({ text: texto, font: FUENTE, size: 22 }),
    ],
  });

const borde = { style: BorderStyle.SINGLE, size: 4, color: "BDD0E4" };
const bordes = { top: borde, bottom: borde, left: borde, right: borde };

const celda = (texto, { ancho, cabecera = false, bold = false, zebra = false } = {}) =>
  new TableCell({
    borders: bordes,
    width: { size: ancho, type: WidthType.DXA },
    shading: { fill: cabecera ? AZUL_CLARO : zebra ? ZEBRA : "FFFFFF", type: ShadingType.CLEAR },
    margins: { top: 90, bottom: 90, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: 0 },
        children: [
          new TextRun({
            text: texto,
            font: FUENTE,
            size: 21,
            bold: cabecera || bold,
            color: cabecera ? AZUL : "262626",
          }),
        ],
      }),
    ],
  });

const tabla = (anchos, filas) =>
  new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: anchos,
    rows: filas.map(
      (f, i) =>
        new TableRow({
          children: f.map((c, j) =>
            celda(c, { ancho: anchos[j], cabecera: i === 0, zebra: i % 2 === 0 && i !== 0 })
          ),
        })
    ),
  });

const lineaEspaciadora = () => new Paragraph({ spacing: { after: 120 }, children: [] });

// ---------- Portada ----------
const portada = [
  new Paragraph({ spacing: { after: 1600 }, children: [] }),
  p("PROPUESTA DE PROYECTO · INNOVACIÓN CON INTELIGENCIA ARTIFICIAL", {
    align: AlignmentType.CENTER, bold: true, size: 20, color: GRIS, after: 500,
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text: "El Copiloto de Mejora Continua", font: FUENTE, size: 64, bold: true, color: AZUL })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 900 },
    children: [
      new TextRun({
        text: "Un agente de IA que convierte las propuestas de los usuarios en mejoras reales de la plataforma — y que responde a cada usuario como se merece.",
        font: FUENTE, size: 26, italics: true, color: GRIS,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: "Preparado por: ______________________________", font: FUENTE, size: 22, color: "262626" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: "Octubre de 2026 · Versión 1.0", font: FUENTE, size: 22, color: GRIS })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Documento de presentación para aprobación — Confidencial", font: FUENTE, size: 20, color: GRIS, italics: true })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ---------- Cuerpo ----------
const cuerpo = [
  // 1. RESUMEN EJECUTIVO
  h1("1. Resumen ejecutivo"),
  p("Para quien no tenga tiempo de leerlo todo:", { italics: true, color: GRIS, after: 120 }),
  vineta("integrar en la plataforma un agente de IA — un asistente software autónomo — que lee cada propuesta de mejora enviada por los usuarios, la comprende, prepara la mejora en el código y redacta una respuesta personalizada para quien la escribió, ajustando su tono al ánimo del mensaje.", "Qué proponemos: "),
  vineta("el circuito actual depende de personas con la agenda llena. Las respuestas tardan, algunas ideas se pierden y los usuarios perciben que nadie les escucha. Cada idea dormida es una mejora que no ocurre.", "Por qué importa: "),
  vineta("por fases, con aprobación humana obligatoria en cada paso y un piloto de 30 días, reversible al 100 %, antes de tocar nada del producto.", "Cómo lo haremos sin riesgos: "),
  vineta("aprobar el piloto de la Fase 1, en la que el agente solo lee propuestas y prepara respuestas: no modifica nada del programa.", "Qué se solicita: "),

  // 2. EL PROBLEMA
  h1("2. El problema: el circuito de mejora está roto"),
  p("Hoy, cuando un usuario propone una mejora, ocurre esto:"),
  vineta("La propuesta llega a un buzón que alguien tiene que leer «cuando tenga un rato» — y ese rato nunca llega."),
  vineta("Las respuestas, cuando existen, llegan tarde y redactadas a prisas."),
  vineta("Las ideas pequeñas (las que más agradecen los usuarios) compiten con los proyectos grandes del equipo de desarrollo. Y pierden."),
  vineta("El usuario no sabe si alguien ha leído su propuesta."),
  pMixta([
    { texto: "Y hay un detalle que pesa más de lo que parece: cuando una respuesta tarda semanas, el usuario no piensa «están ocupados». Piensa " },
    { texto: "«nadie me escucha»", bold: true },
    { texto: ". Ese sentimiento, repetido, apaga justamente al usuario más valioso: el que se implica y propone." },
  ], { before: 120 }),
  pMixta([
    { texto: "La consecuencia es doble: ", bold: true },
    { texto: "perdemos mejoras y perdemos la implicación de quienes mejor conocen el programa." },
  ]),

  // 3. LA SOLUCIÓN
  h1("3. La solución: un empleado digital que nunca duerme"),
  pMixta([
    { texto: "El Copiloto", bold: true, color: AZUL },
    { texto: " es un agente de IA que vive dentro de la plataforma y que se ocupa del circuito completo de la mejora:" },
  ]),
  vineta("en el momento en que se envía, con calma y sin prisa: qué se pide, por qué se pide y con qué ánimo lo pide quien lo escribe.", "Lee cada propuesta "),
  vineta("el código de la plataforma, localiza dónde habría que tocar y construye la mejora.", "Explora "),
  vineta("y la adapta a la persona: cercana y agradecida cuando la propuesta es entusiasta; empática y reconociendo el fallo cuando hay disgusto; clara y directa cuando la idea no es viable y hay que explicarlo.", "Redacta la respuesta "),
  vineta("para que una persona dé el visto bueno. Al aprobarlo, la mejora llega al programa y el usuario recibe su respuesta en la propia pantalla, con un aviso.", "Deja todo listo "),
  pMixta([
    { texto: "Importante: ", bold: true },
    { texto: "el Copiloto no sustituye al equipo de desarrollo. Les quita el ruido (clasificar, analizar, redactar) y les trae el trabajo ya masticado, listo para aprobar." },
  ], { before: 120 }),

  // 4. CÓMO FUNCIONA
  h1("4. Cómo funciona, paso a paso"),
  paso("El usuario escribe su propuesta dentro del programa, igual que hace hoy (con capturas de pantalla si quiere)."),
  paso("El Copiloto la lee al instante: qué pide, por qué lo pide y cómo está de ánimo quien lo escribe."),
  paso("Explora el código de la plataforma y localiza exactamente dónde habría que hacer el cambio."),
  paso("Prepara la mejora sobre una copia aislada del código (una «rama de desarrollo») y la verifica."),
  paso("Redacta la respuesta al usuario y la deja en cola, a la espera del visto bueno de una persona."),
  paso("Con la aprobación, la mejora llega al programa y el usuario ve la respuesta en su pantalla, sin tener que buscarla."),

  // 5. ANTES Y DESPUÉS
  h1("5. La experiencia del usuario: antes y después"),
  p("Al final, esto es lo que el usuario de la plataforma va a notar:", { after: 140 }),
  tabla(
    [4513, 4513],
    [
      ["Antes", "Después"],
      ["«Escribo propuestas y no sé si alguien las lee»", "«Recibo respuesta en horas, escrita para mí»"],
      ["«Cuando me contestan, ha pasado un mes»", "«El aviso me llega en cuanto hay respuesta»"],
      ["«Los disgustos se quedan sin respuesta»", "«Un disgusto recibe una respuesta que lo reconoce y lo arregla»"],
      ["«Las mejoras pequeñas nunca llegan»", "«Los detalles pequeños se resuelven en días»"],
    ]
  ),

  // 6. FASES
  h1("6. El plan por fases: seguro primero"),
  p("Nada se improvisa. Cada fase solo empieza si la anterior ha demostrado que funciona:", { after: 140 }),
  tabla(
    [1900, 4426, 1100, 1600],
    [
      ["Fase", "Qué hace", "Duración", "Riesgo"],
      ["Fase 1 — El Respondedor", "Lee y comprende cada propuesta y responde con análisis y estimación del esfuerzo. No toca nada del programa.", "4 semanas", "Nulo"],
      ["Fase 2 — El Desarrollador supervisado", "Implementa cambios pequeños y bien delimitados (textos, campos, listados). Todo pasa revisión humana antes de funcionar.", "6–8 semanas", "Bajo"],
      ["Fase 3 — El Compañero autónomo", "Cambios mayores con batería de pruebas automáticas como red de seguridad. Solo si las fases anteriores lo avalan.", "A definir", "Controlado"],
    ]
  ),

  // 7. GARANTÍAS
  h1("7. Garantías de seguridad"),
  p("Un agente que trabaja sobre el producto exige reglas claras. Estas son las nuestras:", { after: 140 }),
  vineta("en las Fases 1 y 2, ninguna respuesta sale al usuario y ningún cambio se despliega sin el visto bueno de una persona.", "El humano manda: "),
  vineta("cualquier modificación es reversible al instante (se puede «volver atrás» con un clic).", "Todo cambio queda versionado: "),
  vineta("el Copiloto trabaja sobre una copia del código, nunca sobre el programa en producción.", "Entorno de pruebas obligatorio: "),
  vineta("hay datos y colecciones que el agente no puede tocar nunca, definidos de antemano y verificados.", "Límites por escrito: "),
  vineta("cada acción queda anotada: qué leyó, qué hizo, cuándo y por qué.", "Registro auditable: "),
  vineta("el Copiloto se desconecta con un clic, sin efectos secundarios.", "Freno de emergencia: "),

  // 8. RETORNO
  h1("8. Qué gana el negocio"),
  tabla(
    [2708, 3158, 3160],
    [
      ["Indicador", "Hoy", "Con el Copiloto"],
      ["Tiempo de respuesta a una propuesta", "Días o semanas", "Horas"],
      ["Propuestas que reciben respuesta", "Una parte", "El 100 %"],
      ["Carga del equipo con las propuestas", "Alta: leer, clasificar, redactar", "Baja: solo aprobar"],
      ["Implicación de los usuarios", "Se apaga si no se les responde", "Crece: ven que el programa les escucha"],
      ["Evolución del producto", "A golpe de proyecto", "Guiada por quien lo usa, cada día"],
    ]
  ),

  // 9. COSTES
  h1("9. Costes"),
  vineta("ninguna nueva. El agente vive como un proceso más en el servidor actual (Node.js y MongoDB, tecnologías ya presentes en la plataforma).", "Infraestructura: "),
  vineta("no se compra ningún software adicional.", "Licencias: "),
  vineta("las llamadas al modelo de IA, proporcionales al número de propuestas. Con volúmenes normales, del orden de decenas de euros al mes.", "Coste variable: "),
  vineta("asumido por el equipo interno, sin proveedores externos.", "Desarrollo: "),

  // 10. RIESGOS
  h1("10. Riesgos y cómo se cubren"),
  tabla(
    [3400, 5626],
    [
      ["Riesgo", "Cobertura"],
      ["El agente se equivoca al modificar código", "En Fases 1 y 2 no modifica nada; después, revisión humana + versionado + entorno de pruebas."],
      ["Una respuesta sale con tono inadecuado", "Personalidad definida por escrito y aprobación previa de cada respuesta."],
      ["El coste de la IA se dispara", "Límite de gasto por propuesta y por día, con aviso al superarlo."],
      ["Depender de un único proveedor de IA", "Diseño agnóstico: el motor se puede cambiar sin rehacer el proyecto."],
    ]
  ),

  // 11. PILOTO
  h1("11. El piloto: 30 días, cero riesgo"),
  p("Proponemos empezar por un piloto acotado, pensado para que la decisión de hoy sea fácil:", { after: 140 }),
  vineta("únicamente la Fase 1: leer y responder. El agente no toca el programa.", "Qué: "),
  vineta("el 100 % de las propuestas recibe respuesta en menos de 24 horas.", "Objetivo medible: "),
  vineta("a los 30 días, resultados sobre la mesa (propuestas respondidas, tiempo medio de respuesta, reacción de los usuarios) y decisión sobre la Fase 2.", "Informe final: "),
  vineta("si no convence, se apaga y no queda nada instalado.", "Reversible: "),

  // 12. DECISIÓN
  h1("12. Decisión que se solicita"),
  new Paragraph({
    spacing: { before: 100, after: 200 },
    shading: { fill: AZUL_CLARO, type: ShadingType.CLEAR },
    border: {
      top: { style: BorderStyle.SINGLE, size: 6, color: AZUL },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: AZUL },
      left: { style: BorderStyle.SINGLE, size: 6, color: AZUL },
      right: { style: BorderStyle.SINGLE, size: 6, color: AZUL },
    },
    children: [
      new TextRun({
        text: "Aprobar el piloto de 30 días de la Fase 1 del Copiloto de Mejora Continua.",
        font: FUENTE, size: 26, bold: true, color: AZUL,
      }),
    ],
  }),
  p("Con el piloto aprobado, la Fase 1 puede estar funcionando en dos semanas desde el arranque.", { italics: true, color: GRIS }),
];

// ---------- Documento ----------
const doc = new Document({
  styles: {
    default: { document: { run: { font: FUENTE, size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: FUENTE, color: AZUL },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 25, bold: true, font: FUENTE, color: AZUL },
        paragraph: { spacing: { before: 260, after: 160 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "vinetas",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 620, hanging: 360 } } },
        }],
      },
      {
        reference: "pasos",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 620, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1440, bottom: 1134, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: "El Copiloto de Mejora Continua · Propuesta de proyecto", font: FUENTE, size: 16, color: GRIS, italics: true })],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Página ", font: FUENTE, size: 16, color: GRIS }),
                new TextRun({ children: [PageNumber.CURRENT], font: FUENTE, size: 16, color: GRIS }),
              ],
            }),
          ],
        }),
      },
      children: [...portada, ...cuerpo],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("Propuesta-Copiloto-Mejora-Continua.docx", buffer);
  console.log("Documento generado: Propuesta-Copiloto-Mejora-Continua.docx");
});
