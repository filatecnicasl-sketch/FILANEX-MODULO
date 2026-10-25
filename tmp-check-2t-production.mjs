import mongoose from "mongoose";
import "dotenv/config";
import FacturaCompra from "./server/src/models/FacturaCompra.js";
import Proveedor from "./server/src/models/Proveedor.js";

const base = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";
await mongoose.connect(`${base.replace(/\/+$/, "")}/filanex_local`);
const desde = new Date("2026-04-01T00:00:00.000Z");
const hasta = new Date("2026-07-01T00:00:00.000Z");
const [facturas, proveedores] = await Promise.all([
  FacturaCompra.find({ fechaExpedicion: { $gte: desde, $lt: hasta } })
    .populate("proveedor", "nombre nif")
    .select("numeroFacturaProveedor fechaExpedicion baseImponible cuotaIva total divisa totalDivisa tipoCambio estado origen ocr.ficheroUrl")
    .sort({ fechaExpedicion: 1 })
    .lean(),
  Proveedor.find({ nombre: { $regex: "IONOS|ORANGE|HISPAMICRO|EMERGENT|LINK|VERDENT|FILASUR|ENLADRILLADA|TONER|TINTAS", $options: "i" } })
    .select("nombre nif alias")
    .lean(),
]);
console.log(JSON.stringify({ facturas, proveedores }, null, 2));
await mongoose.disconnect();
