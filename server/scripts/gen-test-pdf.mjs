// Factura de compra ficticia para probar el OCR de Gemini end-to-end.
// Genera test-factura.pdf (PDF mínimo, solo ASCII) con:
//  - proveedor con CIF válido (B12345674)
//  - 1 artículo por unidades + 1 servicio (para probar la clasificación)
const lineas = [
  "SUMINISTROS EJEMPLO SL",
  "CIF: B12345674",
  "Calle Prueba 12, 11001 Cadiz",
  "",
  "FACTURA Nº: F-2026/0415          Fecha: 05/08/2026",
  "Cliente: FILA TECNICA SL - B75418350",
  "------------------------------------------------------",
  "Descripcion                    Uds.  Precio   IVA",
  "TONER HP CF283A COMPATIBLE       2   45.00   21%",
  "CUOTA LINEA MOVIL EMPRESA        1   20.00   21%",
  "------------------------------------------------------",
  "Base imponible: 110.00 EUR",
  "IVA 21%:         23.10 EUR",
  "TOTAL FACTURA:  133.10 EUR",
];

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
let stream = "BT /F1 11 Tf 50 780 Td 15 TL\n";
for (const l of lineas) stream += `(${esc(l)}) Tj T*\n`;
stream += "ET";

const objetos = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
];

let pdf = "%PDF-1.4\n";
const offsets = [];
objetos.forEach((cuerpo, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
});
const xref = pdf.length;
pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
for (const o of offsets) pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

await import("node:fs").then((fs) => fs.writeFileSync("test-factura.pdf", pdf, "latin1"));
console.log("test-factura.pdf generado");
