import fs from "node:fs";
const source = fs.readFileSync("tmp-pdfs/texto-2t.txt", "utf8");
const blocks = source.split(/(?=^##### )/m).filter((block) => block.startsWith("##### "));
const interesting = /factura|invoice|fecha|date|total|base imponible|iva|amount|usd|eur|vat|n\.?\s*(?:º|┬º|o)|number|reference|transferencia|enladrillada/i;
for (const block of blocks) {
  const lines = block.split(/\r?\n/);
  const path = lines.shift().replace(/^#####\s*/, "").trim();
  const selected = lines.filter((line) => interesting.test(line)).slice(0, 18).map((line) => line.trim());
  console.log(JSON.stringify({ path, lines: selected }));
}
