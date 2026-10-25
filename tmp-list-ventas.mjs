import fs from "node:fs";
import path from "node:path";
const root = "D:/Users/Francis/Desktop/ENVIO2~2";
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.toLowerCase().endsWith(".pdf") && /venta/i.test(fullPath)) {
      console.log(path.relative(root, fullPath));
    }
  }
}
walk(root);
