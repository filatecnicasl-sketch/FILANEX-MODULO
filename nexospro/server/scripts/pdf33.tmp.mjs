// Genera el PDF de la factura 3-2026-33 (filanex_local) con sello PAGADA.
import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";
import { conContexto } from "../src/models/tenant.js";
import FacturaVenta from "../src/models/FacturaVenta.js";
import Empresa from "../src/models/Empresa.js";
import { generarPdfFactura } from "../src/services/factura-pdf.js";

const ID = "6ab129cdb1141653b898531e";
const base = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";

await conContexto({ dbName: "filanex_local", slug: "local" }, async () => {
  await mongoose.connect(`${base}/filanex_local`);
  const factura = await FacturaVenta.findById(ID).lean();
  if (!factura) throw new Error("Factura no encontrada");
  const cliente = await mongoose.connection.db
    .collection("clientes")
    .findOne({ _id: factura.cliente }, { projection: { nombre: 1, nif: 1, direccion: 1 } });
  const empresa = (await Empresa.findById(factura.empresa).lean()) ?? (await Empresa.findOne().lean());
  const pdf = await generarPdfFactura({ empresa, factura, cliente });
  fs.writeFileSync("/tmp/factura-33-sello.pdf", pdf);
  console.log(`PDF generado: ${pdf.length} bytes`);
  await mongoose.disconnect();
});
