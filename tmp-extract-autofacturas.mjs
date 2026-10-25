import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = "D:/Users/Francis/Desktop/ENVIO2~2";
const names = /FS-26-[123]-01|auto facura gana|ACI0001|autofactura informa/i;
const found = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.toLowerCase().endsWith(".pdf") && names.test(entry.name)) found.push(fullPath);
  }
}
walk(root);
let output = "";
for (const file of found) {
  const result = spawnSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  output += `\n##### ${path.relative(root, file)}\n`;
  output += result.status === 0 ? result.stdout : `ERROR ${result.stderr || result.error}\n`;
}
fs.writeFileSync("tmp-pdfs/texto-autofacturas.txt", output, "utf8");
console.log(`Extracted ${found.length} files to tmp-pdfs/texto-autofacturas.txt`);
