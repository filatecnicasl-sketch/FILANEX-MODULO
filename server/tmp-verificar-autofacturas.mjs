import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import FacturaVenta from "./src/models/FacturaVenta.js";
const numeros = ["FS-26-1-01", "FS-26-2-01", "FS-26-3-01", "5569-26-00001", "ACI/0001", "INFA202606090100864"];
await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
try {
  const historicas = await FacturaVenta.find({ "verifactu.estadoEnvio": "historica" })
    .select("serieNumero fechaExpedicion baseImponible cuotaIva total estado documentoOriginal notaImportacion")
    .lean();
  console.log(JSON.stringify({ total: historicas.length, historicas }, null, 2));
} finally {
  await mongoose.disconnect();
}
