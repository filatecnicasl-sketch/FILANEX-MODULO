import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import FacturaCompra from "./src/models/FacturaCompra.js";
import Proveedor from "./src/models/Proveedor.js";
import CierreEjercicio from "./src/models/CierreEjercicio.js";
import { siguienteCodigoFicha } from "./src/services/codigoFicha.js";
import { calcularTotales } from "./src/services/totales.js";
import { guardarArchivo, urlPublica } from "./src/services/storage.js";

const root = "/tmp/filanex-import-2t-20261024";
const aplicar = process.argv.includes("--apply");
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const norm = (s) => String(s ?? "").trim().toUpperCase().replace(/O/g, "0").replace(/I/g, "1");
const close = (a, b) => Math.abs(round(a) - round(b)) <= 0.01;
const records = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));

await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
try {
  const cierre = await CierreEjercicio.findOne({ ano: 2026, estado: "cerrado" }).lean();
  if (cierre) throw new Error("El ejercicio 2026 está cerrado; se cancela la importación.");

  const suppliers = await Proveedor.find().select("_id nombre nif alias").lean();
  const suppliersByKey = new Map();
  for (const supplier of suppliers) {
    if (supplier.nif) suppliersByKey.set(`nif:${norm(supplier.nif)}`, supplier);
    for (const name of [supplier.nombre, ...(supplier.alias ?? [])]) {
      if (name) suppliersByKey.set(`name:${String(name).trim().toLowerCase()}`, supplier);
    }
  }

  const recordsBySupplier = new Map();
  for (const record of records) {
    const supplierKey = record.supplier.nif
      ? `nif:${norm(record.supplier.nif)}`
      : `name:${record.supplier.name.trim().toLowerCase()}`;
    if (!record.number || !record.date || !record.pdf) throw new Error(`Faltan datos requeridos: ${record.id}`);
    const sourcePdf = path.join(root, "pdfs", `${record.id}.pdf`);
    if (!fs.existsSync(sourcePdf) || fs.statSync(sourcePdf).size < 100) throw new Error(`PDF ausente o vacío: ${record.id}`);
    if (!fs.readFileSync(sourcePdf).subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error(`El archivo no tiene cabecera PDF válida: ${record.id}`);
    const duplicateKey = `${supplierKey}:${norm(record.number)}`;
    if (recordsBySupplier.has(duplicateKey)) throw new Error(`Duplicado en el manifiesto: ${record.number}`);
    recordsBySupplier.set(duplicateKey, record);

    const lineas = record.lines.map((line) => ({
      descripcion: line.description,
      cantidad: line.quantity ?? 1,
      precioUnitario: record.currency === "USD"
        ? round(round(line.priceUsd * record.rate) * 1)
        : line.priceEur,
      ...(record.currency === "USD" ? { precioUnitarioDivisa: line.priceUsd } : {}),
      descuento: line.discount ?? 0,
      iva: line.iva,
    }));
    const calculated = calcularTotales(lineas);
    const retention = record.retention?.amount ?? 0;
    const totalFromPaper = round(record.base + record.vat - retention);
    if (!close(calculated.baseImponible, record.base) || !close(calculated.cuotaIva, record.vat) || Math.abs(round(calculated.total - retention - record.total)) > 0.5 || !close(totalFromPaper, record.total)) {
      throw new Error(`Importes no cuadran en ${record.number}: líneas ${calculated.baseImponible}/${calculated.cuotaIva}/${round(calculated.total - retention)}, factura ${record.base}/${record.vat}/${record.total}`);
    }
    if (record.currency === "USD" && !(record.rate > 0 && record.totalDivisa > 0)) {
      throw new Error(`Tipo de cambio/importe USD inválido: ${record.number}`);
    }
  }

  const existingInvoiceCache = new Map();
  const plan = [];
  for (const record of records) {
    const supplierKey = record.supplier.nif
      ? `nif:${norm(record.supplier.nif)}`
      : `name:${record.supplier.name.trim().toLowerCase()}`;
    let supplier = suppliersByKey.get(supplierKey);
    if (!supplier) {
      const byName = suppliers.find((candidate) =>
        [candidate.nombre, ...(candidate.alias ?? [])].some((name) => name?.trim().toLowerCase() === record.supplier.name.trim().toLowerCase())
      );
      supplier = byName;
    }
    let duplicate = null;
    if (supplier?._id) {
      const cacheKey = String(supplier._id);
      if (!existingInvoiceCache.has(cacheKey)) {
        existingInvoiceCache.set(cacheKey, await FacturaCompra.find({
          proveedor: supplier._id,
          estado: { $ne: "rechazada" },
          numeroFacturaProveedor: { $ne: null },
        }).select("numeroFacturaProveedor").lean());
      }
      duplicate = existingInvoiceCache.get(cacheKey).find((invoice) => norm(invoice.numeroFacturaProveedor) === norm(record.number));
    }
    plan.push({ record, supplier, duplicate });
  }

  console.log(JSON.stringify({
    mode: aplicar ? "apply" : "dry-run",
    total: records.length,
    existingDuplicates: plan.filter((item) => item.duplicate).map(({ record, duplicate }) => ({ number: record.number, existingNumber: duplicate.numeroFacturaProveedor })),
    newSuppliers: [...new Map(plan.filter((item) => !item.supplier).map((item) => [item.record.supplier.name, item.record.supplier])).values()],
    candidates: plan.filter((item) => !item.duplicate).map(({ record }) => ({ number: record.number, supplier: record.supplier.name, date: record.date, total: record.total, currency: record.currency ?? "EUR" })),
  }, null, 2));

  if (!aplicar) process.exitCode = 0;
  else {
    for (const item of plan) {
      const { record } = item;
      const supplierKey = record.supplier.nif
        ? `nif:${norm(record.supplier.nif)}`
        : `name:${record.supplier.name.trim().toLowerCase()}`;
      let supplier = item.supplier ?? suppliersByKey.get(supplierKey);
      if (!supplier) {
        supplier = await Proveedor.create({
          codigo: await siguienteCodigoFicha(Proveedor),
          nombre: record.supplier.name,
          ...(record.supplier.nif ? { nif: record.supplier.nif } : {}),
          alias: [record.supplier.name],
        });
        suppliersByKey.set(record.supplier.nif ? `nif:${norm(record.supplier.nif)}` : `name:${record.supplier.name.trim().toLowerCase()}`, supplier);
        item.supplier = supplier;
      }
      const supplierIdKey = String(supplier._id);
      if (!existingInvoiceCache.has(supplierIdKey)) {
        existingInvoiceCache.set(supplierIdKey, await FacturaCompra.find({
          proveedor: supplier._id,
          estado: { $ne: "rechazada" },
          numeroFacturaProveedor: { $ne: null },
        }).select("numeroFacturaProveedor").lean());
      }
      const duplicate = existingInvoiceCache.get(supplierIdKey).find((invoice) => norm(invoice.numeroFacturaProveedor) === norm(record.number));
      if (duplicate) {
        console.log(`SKIP ${record.number}: ya existe con este proveedor`);
        continue;
      }

      const lineas = record.lines.map((line) => ({
        descripcion: line.description,
        cantidad: line.quantity ?? 1,
        precioUnitario: record.currency === "USD" ? round(line.priceUsd * record.rate) : line.priceEur,
        ...(record.currency === "USD" ? { precioUnitarioDivisa: line.priceUsd } : {}),
        descuento: line.discount ?? 0,
        iva: line.iva,
      }));
      const calculated = calcularTotales(lineas);
      const nombreFichero = `${Date.now()}-${record.id}.pdf`;
      const remoto = `uploads/local/documentos/${nombreFichero}`;
      await guardarArchivo(remoto, fs.readFileSync(path.join(root, "pdfs", `${record.id}.pdf`)), "application/pdf");
      const invoice = new FacturaCompra({
        proveedor: supplier._id,
        numeroFacturaProveedor: record.number,
        fechaExpedicion: new Date(`${record.date}T00:00:00.000Z`),
        ...(record.due ? { vencimiento: new Date(`${record.due}T00:00:00.000Z`) } : {}),
        notas: record.notes,
        lineas,
        divisa: record.currency ?? "EUR",
        tipoCambio: record.currency === "USD" ? record.rate : 1,
        totalDivisa: record.currency === "USD" ? record.totalDivisa : record.total,
        baseImponible: record.base,
        cuotaIva: record.vat,
        ajusteRedondeo: round(record.total - calculated.total + (record.retention?.amount ?? 0)),
        total: record.total,
        ...(record.retention ? { retencionIrpf: { porcentaje: record.retention.percentage, importe: record.retention.amount, modelo: record.retention.model } } : {}),
        estado: "pendiente_revision",
        origen: "manual",
        crearArticulos: false,
        pagos: [],
        ocr: {
          ficheroUrl: urlPublica(remoto),
          datosExtraidos: {
            fuente: "Importación manual revisada del segundo trimestre de 2026",
            archivoOriginal: record.pdf,
            importeOriginal: record.currency === "USD" ? record.totalDivisa : record.total,
            divisaOriginal: record.currency ?? "EUR",
            ...(record.currency === "USD" ? { tipoCambioBceEur: record.rate } : {}),
          },
        },
      });
      await invoice.save();
      existingInvoiceCache.get(supplierIdKey).push({ numeroFacturaProveedor: record.number });
      console.log(`CREATED ${record.number} ${invoice.total.toFixed(2)} EUR ${invoice.ocr.ficheroUrl}`);
    }
  }
} finally {
  await mongoose.disconnect();
}
