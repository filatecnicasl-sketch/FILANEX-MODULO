import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import FacturaCompra from "./src/models/FacturaCompra.js";
import Proveedor from "./src/models/Proveedor.js";

await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
const start = new Date("2026-04-01T00:00:00.000Z");
const end = new Date("2026-07-01T00:00:00.000Z");
const [facturas, proveedores] = await Promise.all([
  FacturaCompra.find({ fechaExpedicion: { $gte: start, $lt: end } })
    .populate("proveedor", "nombre nif")
    .select("numeroFacturaProveedor fechaExpedicion baseImponible cuotaIva total divisa totalDivisa tipoCambio estado origen ocr.ficheroUrl")
    .sort({ fechaExpedicion: 1 })
    .lean(),
  Proveedor.find({ nombre: { $regex: "IONOS|ORANGE|HISPAMICRO|EMERGENT|LINK|VERDENT|FILASUR|ENLADRILLADA|SANGAR|TONER|TINTAS", $options: "i" } })
    .select("_id nombre nif alias")
    .lean(),
]);
console.log(JSON.stringify({ facturas, proveedores }, null, 2));
await mongoose.disconnect();
