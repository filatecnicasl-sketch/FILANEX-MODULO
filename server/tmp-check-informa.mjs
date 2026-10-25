import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import FacturaCompra from "./src/models/FacturaCompra.js";
import Proveedor from "./src/models/Proveedor.js";
await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
try {
  const proveedores = await Proveedor.find({ $or: [{ nif: "B72833155" }, { nombre: /INFORMA ENERGIA/i }] }).select("_id nombre nif").lean();
  const facturas = [];
  for (const proveedor of proveedores) {
    const rows = await FacturaCompra.find({ proveedor: proveedor._id, numeroFacturaProveedor: { $regex: "^INFA202606090100864$", $options: "i" } })
      .select("_id numeroFacturaProveedor fechaExpedicion baseImponible cuotaIva total estado ocr.ficheroUrl").lean();
    facturas.push(...rows.map((row) => ({ proveedor: proveedor.nombre, ...row })));
  }
  console.log(JSON.stringify({ proveedores, facturas }, null, 2));
} finally {
  await mongoose.disconnect();
}
