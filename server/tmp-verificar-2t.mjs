import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import FacturaCompra from "./src/models/FacturaCompra.js";
import Proveedor from "./src/models/Proveedor.js";
import { existeArchivo, leerArchivo } from "./src/services/storage.js";

const root = "/tmp/filanex-import-2t-20261024";
const records = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
const norm = (s) => String(s ?? "").trim().toUpperCase().replace(/O/g, "0").replace(/I/g, "1");
const errors = [];
await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
try {
  const suppliers = await Proveedor.find().select("_id nombre nif alias").lean();
  const results = [];
  for (const record of records) {
    const supplier = suppliers.find((candidate) => record.supplier.nif
      ? norm(candidate.nif) === norm(record.supplier.nif)
      : [candidate.nombre, ...(candidate.alias ?? [])].some((name) => name?.trim().toLowerCase() === record.supplier.name.trim().toLowerCase()));
    if (!supplier) {
      errors.push(`Proveedor no encontrado: ${record.supplier.name}`);
      continue;
    }
    const candidates = await FacturaCompra.find({ proveedor: supplier._id, estado: { $ne: "rechazada" } })
      .select("_id numeroFacturaProveedor fechaExpedicion vencimiento baseImponible cuotaIva total divisa totalDivisa tipoCambio estado pagos albaranes retencionIrpf ocr.ficheroUrl")
      .lean();
    const matches = candidates.filter((invoice) => norm(invoice.numeroFacturaProveedor) === norm(record.number));
    if (matches.length !== 1) {
      errors.push(`${record.number}: se esperaban 1 factura, hay ${matches.length}`);
      continue;
    }
    const invoice = matches[0];
    if (invoice.estado !== "pendiente_revision") errors.push(`${record.number}: estado ${invoice.estado}`);
    if (new Date(invoice.fechaExpedicion).toISOString().slice(0, 10) !== record.date) errors.push(`${record.number}: fecha de expedición distinta`);
    if ((invoice.pagos ?? []).length !== 0) errors.push(`${record.number}: contiene pagos`);
    if ((invoice.albaranes ?? []).length !== 0) errors.push(`${record.number}: contiene conciliaciones/albaranes`);
    if (record.due && new Date(invoice.vencimiento ?? 0).toISOString().slice(0, 10) !== record.due) errors.push(`${record.number}: vencimiento distinto de ${record.due}`);
    if (Math.abs(invoice.total - record.total) > 0.01 || Math.abs(invoice.baseImponible - record.base) > 0.01 || Math.abs(invoice.cuotaIva - record.vat) > 0.01) errors.push(`${record.number}: importes distintos a la factura`);
    if ((record.currency ?? "EUR") === "USD" && (invoice.divisa !== "USD" || Math.abs(invoice.totalDivisa - record.totalDivisa) > 0.01 || Math.abs(invoice.tipoCambio - record.rate) > 0.00001)) errors.push(`${record.number}: conversión USD incorrecta`);
    if (record.retention && (invoice.retencionIrpf?.porcentaje !== record.retention.percentage || Math.abs(invoice.retencionIrpf?.importe - record.retention.amount) > 0.01)) errors.push(`${record.number}: retención IRPF incorrecta`);
    const remote = invoice.ocr?.ficheroUrl?.replace(/^\//, "");
    if (!remote || !(await existeArchivo(remote))) errors.push(`${record.number}: PDF no encontrado (${invoice.ocr?.ficheroUrl ?? "sin URL"})`);
    else {
      const bytes = await leerArchivo(remote);
      if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) errors.push(`${record.number}: adjunto sin cabecera PDF válida`);
    }
    results.push({ number: record.number, total: invoice.total, currency: invoice.divisa, state: invoice.estado, pdf: Boolean(remote) });
  }
  console.log(JSON.stringify({ expected: records.length, verified: results.length, errors, results }, null, 2));
  if (errors.length || results.length !== records.length) process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
