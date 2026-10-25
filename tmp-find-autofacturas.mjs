import fs from "node:fs";
import path from "node:path";
const root = "D:/Users/Francis/Desktop/ENVIO2~2";
const match = /5569-26-00001|ACI[_-]?0001|autofactura informa|autofactura/i;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (match.test(entry.name)) console.log(path.relative(root, fullPath));
  }
}
walk(root);
