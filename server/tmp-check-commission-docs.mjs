import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import Comercializadora from "./src/models/Comercializadora.js";
import CanalDistribucion from "./src/models/CanalDistribucion.js";
import ComisionEnergia from "./src/models/ComisionEnergia.js";
import AutofacturaEnergia from "./src/models/AutofacturaEnergia.js";
import FacturaVenta from "./src/models/FacturaVenta.js";
import Cliente from "./src/models/Cliente.js";

await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
const [commercializers, channels, commissions, autofacturas, clients, sales] = await Promise.all([
  Comercializadora.find().select("_id nombre nif").lean(),
  CanalDistribucion.find().select("_id nombre nif comercializadoraNombres comercializadoras").lean(),
  ComisionEnergia.find({ periodo: { $gte: "2026-01", $lte: "2026-06" } }).select("comercializadora comercializadoraNombre periodo importe tipo estado").lean(),
  AutofacturaEnergia.find({ periodo: { $gte: "2026-01", $lte: "2026-06" } }).select("_id comercializadora comercializadoraNombre numero periodo fecha base iva total estado fechaCobro notas").lean(),
  Cliente.find({ nif: { $in: ["B13809793", "B66868902", "B75418350"] } }).select("_id nombre nif").lean(),
  FacturaVenta.find({ $or: [{ serieNumero: { $in: ["FS-26-1-01", "FS-26-2-01", "FS-26-3-01", "5569-26-00001", "ACI/0001"] } }, { descripcion: /autofactura|comisiones por altas/i }] }).populate("cliente", "nombre nif").select("serieNumero descripcion fechaExpedicion baseImponible cuotaIva total estado cliente").lean(),
]);
console.log(JSON.stringify({ commercializers, channels, commissions, autofacturas, clients, sales }, null, 2));
await mongoose.disconnect();
