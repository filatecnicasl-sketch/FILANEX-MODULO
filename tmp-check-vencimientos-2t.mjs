import { spawnSync } from "node:child_process";
const root = "D:/Users/Francis/Desktop/ENVIO2~2/2TRIME~1/RECIBIDAS";
for (const rel of ["orange/orange abril.pdf", "hispamicro/FacturaFVH2604_1506.pdf", "hispamicro/FacturaFVH2605_0248.pdf", "hispamicro/FVH2605-0541.pdf"]) {
  const result = spawnSync("pdftotext", ["-layout", `${root}/${rel}`, "-"], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  console.log(`\n##### ${rel}\n${result.stdout || result.stderr}`);
}
