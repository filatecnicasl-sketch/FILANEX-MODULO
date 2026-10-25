import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
const root = "D:/Users/Francis/Desktop/ENVIO2~2";
const wanted = /FS-26-[123]-01|auto facura gana|CC002056_8036_ACI0001_ALTAS|autofactura informa/i;
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.toLowerCase().endsWith(".pdf") && wanted.test(entry.name)) files.push(full);
  }
}
walk(root);
console.log(JSON.stringify(files.map((file) => {
  const buffer = fs.readFileSync(file);
  const info = spawnSync("pdfinfo", [file], { encoding: "utf8" });
  return { relative: path.relative(root, file), size: buffer.length, sha256: crypto.createHash("sha256").update(buffer).digest("hex"), pdfInfo: info.stdout ?? info.stderr };
}), null, 2));
