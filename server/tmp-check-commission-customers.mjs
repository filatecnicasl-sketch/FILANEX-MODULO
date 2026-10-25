import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import Cliente from "./src/models/Cliente.js";
import FacturaVenta from "./src/models/FacturaVenta.js";
await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
try {
  const clientes = await Cliente.find({ $or: [
    { nif: { $in: ["B13809793", "B66868902", "B98717457", "B72833155"] } },
    { nombre: /AT ENTERPRISE|AHORRELUZ|GANA ENERGIA|INFORMA ENERGIA/i },
  ] }).select("_id nombre nif").lean();
  const numeros = ["FS-26-1-01", "FS-26-2-01", "FS-26-3-01", "5569-26-00001", "ACI/0001", "INFA202606090100864"];
  const ventas = await FacturaVenta.find({ $or: [
    { serieNumero: { $in: numeros } },
    { descripcion: { $regex: "INFA202606090100864|FS-26-[123]-01|5569-26-00001|ACI/0001", $options: "i" } },
  ] }).populate("cliente", "nombre nif").select("_id serieNumero fechaExpedicion baseImponible cuotaIva total estado verifactu.estadoEnvio documentoOriginal cliente").lean();
  console.log(JSON.stringify({ clientes, ventas }, null, 2));
} finally {
  await mongoose.disconnect();
}
