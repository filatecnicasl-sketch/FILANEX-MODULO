// Intenta leer el texto de los PDFs con pdf-parse
import { writeFileSync } from "fs";

import { createRequire } from "module";
import { readFileSync } from "fs";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const ficheros = ["/tmp/use-0907.pdf", "/tmp/use-0608.pdf", "/tmp/use-0309.pdf"];

for (const f of ficheros) {
  try {
    const data = await new PDFParse({ data: readFileSync(f) }).getText();
    console.log(`\n=== ${f} ===`);
    console.log("type:", typeof data, "constructor:", data?.constructor?.name);
    console.log("keys:", Object.keys(data || {}).slice(0, 10));
    console.log("text:", data?.text?.slice?.(0, 3000) ?? String(data).slice(0, 3000));
  } catch (e) {
    console.log(`\n=== ${f} ===`);
    console.log("ERROR:", e.message);
  }
}
