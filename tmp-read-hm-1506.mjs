import { spawnSync } from "node:child_process";
const pdf = "D:/Users/Francis/Desktop/ENVIO2~2/2TRIME~1/RECIBIDAS/hispamicro/FacturaFVH2604_1506.pdf";
const result = spawnSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
if (result.status !== 0) throw new Error(result.stderr || String(result.error));
console.log(result.stdout);
