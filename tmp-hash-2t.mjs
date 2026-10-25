import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = "D:/Users/Francis/Desktop/ENVIO2~2/2TRIME~1/RECIBIDAS";
const files = [];
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(fullPath);
    else if (entry.name.toLowerCase().endsWith(".pdf")) {
      const buffer = fs.readFileSync(fullPath);
      files.push({
        name: path.relative(root, fullPath),
        bytes: buffer.length,
        hash: crypto.createHash("sha256").update(buffer).digest("hex"),
      });
    }
  }
}
visit(root);
const byHash = new Map();
for (const file of files) {
  const group = byHash.get(file.hash) ?? [];
  group.push(file.name);
  byHash.set(file.hash, group);
}
console.log(JSON.stringify({
  count: files.length,
  uniqueContentCount: byHash.size,
  duplicates: [...byHash.values()].filter((group) => group.length > 1),
  files: files.map(({ name, bytes }) => ({ name, bytes })),
}, null, 2));
