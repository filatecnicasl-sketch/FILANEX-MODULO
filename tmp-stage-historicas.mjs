import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root = "D:/Users/Francis/Desktop/ENVIO2~2";
const out = "tmp-autofacturas-historicas";
const rows = [
  { number: "FS-26-1-01", date: "2026-01-30", base: 400, vat: 84, total: 484, client: "AT ENTERPRISE ZOOM S.L.", nif: "B13809793", source: "1º TRIMESTRE/venta/atenterprise_autofactura_934_FS-26-1-01.pdf", description: "Liquidación de comisiones por altas" },
  { number: "FS-26-2-01", date: "2026-02-20", base: 210, vat: 44.10, total: 254.10, client: "AT ENTERPRISE ZOOM S.L.", nif: "B13809793", source: "1º TRIMESTRE/venta/atenterprise_autofactura_1071_FS-26-2-01.pdf", description: "Liquidación de comisiones por altas" },
  { number: "FS-26-3-01", date: "2026-03-06", base: 893.52, vat: 187.64, total: 1081.16, client: "AT ENTERPRISE ZOOM S.L.", nif: "B13809793", source: "1º TRIMESTRE/venta/atenterprise_autofactura_1209_FS-26-3-01.pdf", description: "Liquidación de comisiones por altas" },
  { number: "5569-26-00001", date: "2026-06-01", base: 120, vat: 25.20, total: 145.20, client: "GAOLANIA SERVICIOS S.L. (GANA ENERGÍA)", nif: "B98717457", source: "2º TRIMESTRE/autofactura/auto facura gana.pdf", description: "Altas LUZ" },
  { number: "ACI/0001", date: "2026-05-06", base: 222, vat: 46.62, total: 268.62, client: "AHORRELUZ SERVICIOS ONLINE S.L.", nif: "B66868902", source: "2º TRIMESTRE/autofactura/CC002056_8036_ACI0001_ALTAS.pdf", description: "Comisiones por altas (04/26)", note: "La factura no imprime fecha de emisión. Se usa provisionalmente 06/05/2026, fecha de creación que figura en los metadatos del PDF; confirmar con el emisor antes del cierre fiscal." },
  { number: "INFA202606090100864", date: "2026-06-09", base: 111.93, vat: 23.51, total: 135.44, client: "INFORMA ENERGÍA S.L.", nif: "B72833155", source: "2º TRIMESTRE/autofactura/autofactura informa.pdf", description: "Comisiones agentes" },
];
fs.mkdirSync(out, { recursive: true });
for (const [index, row] of rows.entries()) {
  const input = path.join(root, row.source);
  const buffer = fs.readFileSync(input);
  if (buffer.subarray(0, 5).toString() !== "%PDF-") throw new Error(`PDF inválido: ${input}`);
  const file = `${String(index + 1).padStart(2, "0")}.pdf`;
  row.file = file;
  row.sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  row.bytes = buffer.length;
  fs.writeFileSync(path.join(out, file), buffer);
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows.map(({ number, date, total, file, sha256, bytes }) => ({ number, date, total, file, sha256, bytes })), null, 2));
