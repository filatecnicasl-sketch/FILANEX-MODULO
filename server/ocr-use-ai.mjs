// OCR a los 3 justificantes de pago de use.ai
import { readFileSync } from "fs";
import { extraerDocumentoCompra } from "./src/services/ocr-gemini.js";

const ficheros = [
  { path: "/tmp/use-0907.pdf", fecha: "2026-07-09" },
  { path: "/tmp/use-0608.pdf", fecha: "2026-08-06" },
  { path: "/tmp/use-0309.pdf", fecha: "2026-09-03" },
];

for (const f of ficheros) {
  console.log(`\n=== ${f.path} ===`);
  try {
    const buffer = readFileSync(f.path);
    const datos = await extraerDocumentoCompra({ originalname: `use-${f.fecha}.pdf`, mimetype: "application/pdf", buffer, size: buffer.length });
    console.log(JSON.stringify(datos, null, 2));
  } catch (e) {
    console.log("ERROR:", e.message);
  }
}
