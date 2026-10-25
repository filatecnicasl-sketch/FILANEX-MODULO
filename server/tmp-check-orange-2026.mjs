import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import FacturaCompra from "./src/models/FacturaCompra.js";
import Proveedor from "./src/models/Proveedor.js";
await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
await Proveedor.findOne().select("_id").lean();
const rows = await FacturaCompra.find({ numeroFacturaProveedor: /^E1001/ })
  .select("numeroFacturaProveedor fechaExpedicion baseImponible cuotaIva ajusteRedondeo total lineas")
  .sort({ fechaExpedicion: 1 }).lean();
console.log(JSON.stringify(rows, null, 2));
await mongoose.disconnect();
