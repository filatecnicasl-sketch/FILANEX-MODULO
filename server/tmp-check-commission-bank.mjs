import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import MovimientoBancario from "./src/models/MovimientoBancario.js";
const rows = [
  { number: "FS-26-1-01", amount: 484, from: "2026-01-25", to: "2026-02-20" },
  { number: "FS-26-2-01", amount: 254.10, from: "2026-02-15", to: "2026-03-15" },
  { number: "FS-26-3-01", amount: 1081.16, from: "2026-03-01", to: "2026-04-10" },
  { number: "5569-26-00001", amount: 145.20, from: "2026-06-01", to: "2026-07-15" },
  { number: "ACI/0001", amount: 268.62, from: "2026-04-01", to: "2026-07-15" },
  { number: "INFA202606090100864", amount: 135.44, from: "2026-06-09", to: "2026-07-15" },
];
await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
try {
  const results = [];
  for (const row of rows) {
    const movimientos = await MovimientoBancario.find({
      importe: { $gt: 0, $gte: row.amount - 0.01, $lte: row.amount + 0.01 },
      fecha: { $gte: new Date(`${row.from}T00:00:00.000Z`), $lte: new Date(`${row.to}T23:59:59.999Z`) },
    }).select("fecha concepto importe referencia conciliadoCon archivoUrl").lean();
    results.push({ invoice: row.number, expected: row.amount, matches: movimientos });
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await mongoose.disconnect();
}
