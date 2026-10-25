import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = "C:/FILANEX-MODULO";
const sourceRoot = "D:/Users/Francis/Desktop/ENVIO2~2/2TRIME~1/RECIBIDAS";
const stage = "/tmp/filanex-import-2t-20261024";
const remote = "root@194.62.96.102";
const key = path.join(process.env.USERPROFILE, ".ssh", "filanex_prod");
const records = JSON.parse(fs.readFileSync(path.join(repo, "tmp-importar-2t-data.json"), "utf8"));
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} terminó con código ${result.status}`);
}
run("ssh", ["-i", key, remote, "mkdir", "-p", `${stage}/pdfs`]);
run("scp", ["-i", key, path.join(repo, "tmp-importar-2t-data.json"), `${remote}:${stage}/data.json`]);
run("scp", ["-i", key, path.join(repo, "server", "tmp-importar-2t.mjs"), `${remote}:/opt/filanex/server/tmp-importar-2t.mjs`]);
for (const record of records) {
  const source = path.join(sourceRoot, record.pdf);
  if (!fs.existsSync(source)) throw new Error(`No existe el PDF fuente: ${record.pdf}`);
  run("scp", ["-i", key, source, `${remote}:${stage}/pdfs/${record.id}.pdf`]);
  console.log(`Staged ${record.number}`);
}
console.log(`Staged ${records.length} PDF files.`);
