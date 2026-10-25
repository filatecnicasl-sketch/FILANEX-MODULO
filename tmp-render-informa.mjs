import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = "D:/Users/Francis/Desktop/ENVIO2~2";
let source = null;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.toLowerCase() === "autofactura informa.pdf") source = fullPath;
  }
}
walk(root);
if (!source) throw new Error("No se encontró autofactura informa.pdf");
const output = "C:/FILANEX-MODULO/tmp-pdfs/autofactura-informa";
const result = spawnSync("pdftoppm", ["-f", "1", "-l", "1", "-png", "-r", "220", source, output], { stdio: "inherit" });
if (result.status !== 0) throw new Error(`pdftoppm terminó con ${result.status}`);
console.log(`${output}-1.png`);
