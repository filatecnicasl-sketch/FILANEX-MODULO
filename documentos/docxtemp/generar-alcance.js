const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, LevelFormat,
  PageNumber, BorderStyle, WidthType, ShadingType,
} = require('docx');
const fs = require('fs');

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const allBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function createCell(text, width, options = {}) {
  const runs = [];
  if (options.bold) runs.push(new TextRun({ text, bold: true, font: 'Arial', size: 20 }));
  else runs.push(new TextRun({ text, font: 'Arial', size: 20 }));
  return new TableCell({
    borders: allBorders,
    width: { size: width, type: WidthType.DXA },
    shading: options.fill ? { fill: options.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: 'center',
    children: [new Paragraph({ children: runs, spacing: { after: 0 } })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullet-list', level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: 'Arial', size: 22 })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, font: 'Arial', size: 26 })],
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: '1F2937' },
        paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: '374151' },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: 'bullet-list',
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '\u2022',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: 'FILANEX / NEXOSPRO — Auditoría técnica', font: 'Arial', size: 18, color: '6B7280' })],
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
                new TextRun({ text: 'Página ', font: 'Arial', size: 18, color: '6B7280' }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: '6B7280' }),
              ],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: 'Alcance de auditoría técnica de software', bold: true, font: 'Arial', size: 36, color: '111827' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 360 },
          children: [new TextRun({ text: 'FILANEX / NEXOSPRO', font: 'Arial', size: 28, color: '374151' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 480 },
          children: [new TextRun({ text: '18 de septiembre de 2026 — Versión 1.0', font: 'Arial', size: 22, color: '6B7280' })],
        }),

        heading2('1. Contexto del proyecto'),
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({
            text: 'FILANEX (también referido como NEXOSPRO) es una aplicación multi-tenant SaaS para gestión de facturación, talleres, telefonía y operativa de negocio, con despliegue posible en cloud o on-premise.',
            font: 'Arial', size: 22,
          })],
        }),
        bullet('Backend: Node.js + Express + Mongoose.'),
        bullet('Frontend: React + Vite + Tailwind CSS.'),
        bullet('Base de datos: MongoDB con una base de datos de plataforma y una base de datos por empresa/tenant.'),
        bullet('Facturación electrónica: integración con VeriFactu de la AEAT.'),
        bullet('Despliegue actual: servidor en UpCloud (Madrid) con PM2.'),

        heading2('2. Objetivos de la auditoría'),
        bullet('Detectar riesgos técnicos, de seguridad y de escalabilidad que puedan afectar a clientes o a la operativa.'),
        bullet('Evaluar la calidad del código, la arquitectura y la mantenibilidad a medio/largo plazo.'),
        bullet('Revisar el cumplimiento de la integración con VeriFactu y la correcta gestión fiscal.'),
        bullet('Obtener una hoja de ruta priorizada de mejoras con estimación de esfuerzo.'),

        heading2('3. Alcance técnico'),
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [new TextRun({ text: 'La auditoría cubrirá los siguientes ámbitos:', font: 'Arial', size: 22 })],
        }),
        new Table({
          width: { size: 9638, type: WidthType.DXA },
          columnWidths: [2892, 6746],
          rows: [
            new TableRow({ children: [createCell('Ámbito', 2892, { bold: true, fill: 'E5E7EB' }), createCell('Qué se revisa', 6746, { bold: true, fill: 'E5E7EB' })] }),
            new TableRow({ children: [createCell('Arquitectura y multi-tenancy', 2892), createCell('Aislamiento de datos entre empresas, uso de AsyncLocalStorage, modelos por tenant, contexto de empresa y rutas protegidas.', 6746)] }),
            new TableRow({ children: [createCell('Seguridad', 2892), createCell('Autenticación JWT, control de acceso, gestión de certificados, subida de archivos, headers de seguridad, CORS y protección contra ataques comunes.', 6746)] }),
            new TableRow({ children: [createCell('Calidad de código', 2892), createCell('Legibilidad, duplicación, manejo de errores, tests, estructura de carpetas y deuda técnica acumulada.', 6746)] }),
            new TableRow({ children: [createCell('VeriFactu y fiscalidad', 2892), createCell('Generación de registros, huella/QR, envío asíncrono a AEAT, reintentos, entorno de pruebas vs producción y campos obligatorios.', 6746)] }),
            new TableRow({ children: [createCell('Infraestructura y DevOps', 2892), createCell('Servidor UpCloud, PM2, despliegue (build en producción), copias de seguridad, monitorización y logs.', 6746)] }),
            new TableRow({ children: [createCell('Escalabilidad y rendimiento', 2892), createCell('Índices de MongoDB, procesos asíncronos, límites de rate limiting, caché y cuellos de botella.', 6746)] }),
            new TableRow({ children: [createCell('Protección de datos', 2892), createCell('Gestión de datos personales, copias de seguridad, acceso a logs y medidas de confidencialidad.', 6746)] }),
          ],
        }),

        heading2('4. Entregables'),
        bullet('Informe ejecutivo con conclusiones generales y nivel de riesgo global.'),
        bullet('Matriz de hallazgos clasificada por severidad: Crítico / Alto / Medio / Bajo.'),
        bullet('Recomendaciones priorizadas con estimación de esfuerzo y dependencias.'),
        bullet('Reunión de cierre de 60 minutos para presentar resultados y responder dudas.'),

        heading2('5. Acceso y documentación necesaria'),
        bullet('Acceso de solo lectura al repositorio de GitHub del proyecto.'),
        bullet('Descripción de los entornos (producción, staging si existe) y diagrama de arquitectura si lo hay.'),
        bullet('Posibilidad de acceder a logs y a una réplica o entorno de pruebas (sin datos reales de clientes).'),
        bullet('Listado de integraciones externas activas (AEAT, Gemini/Vertex, telefonía, almacenamiento R2/S3, etc.).'),

        heading2('6. Planificación y duración estimada'),
        new Table({
          width: { size: 9638, type: WidthType.DXA },
          columnWidths: [2400, 7238],
          rows: [
            new TableRow({ children: [createCell('Fase', 2400, { bold: true, fill: 'E5E7EB' }), createCell('Duración estimada', 7238, { bold: true, fill: 'E5E7EB' })] }),
            new TableRow({ children: [createCell('Preparación y acceso', 2400), createCell('1 día', 7238)] }),
            new TableRow({ children: [createCell('Revisión de código y arquitectura', 2400), createCell('3-5 días', 7238)] }),
            new TableRow({ children: [createCell('Revisión de infraestructura y seguridad', 2400), createCell('2-3 días', 7238)] }),
            new TableRow({ children: [createCell('Redacción del informe', 2400), createCell('2-3 días', 7238)] }),
            new TableRow({ children: [createCell('Reunión de cierre', 2400), createCell('1 día', 7238)] }),
            new TableRow({ children: [createCell('Total estimado', 2400, { bold: true, fill: 'F3F4F6' }), createCell('1,5 - 2 semanas', 7238, { bold: true, fill: 'F3F4F6' })] }),
          ],
        }),

        heading2('7. Confidencialidad'),
        new Paragraph({
          spacing: { before: 120, after: 0 },
          children: [new TextRun({
            text: 'Se firmará un acuerdo de confidencialidad (NDA) antes de facilitar cualquier acceso al código, documentación o entornos. El auditor no podrá copiar, divulgar ni reutilizar la información ajena.',
            font: 'Arial', size: 22,
          })],
        }),
      ],
    },
  ],
});

const outputPath = 'C:\\FILANEX-MODULO\\Alcance_Auditoria_FILANEX.docx';
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log('Documento generado en:', outputPath);
});
