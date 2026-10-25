import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import FacturaCompra from "./src/models/FacturaCompra.js";
import Proveedor from "./src/models/Proveedor.js";
const numeros = ["LINKT-31963174", "LINKT-31994482", "LINKT-31995192", "LINKT-32054934", "LINKT-32062376", "LINKT-32073102"];
await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
try {
  const proveedor = await Proveedor.findOne({ nif: "EU440000220" }).select("_id nombre").lean();
  if (!proveedor) throw new Error("Proveedor Link, LLC no encontrado");
  const results = [];
  for (const numero of numeros) {
    const docs = await FacturaCompra.find({ proveedor: proveedor._id, numeroFacturaProveedor: numero });
    if (docs.length !== 1) throw new Error(`${numero}: se esperaba una factura, encontradas ${docs.length}`);
    const factura = docs[0];
    if (Math.abs(factura.total) < 0.01 || factura.estado !== "pendiente_revision" || factura.pagos.length) throw new Error(`${numero}: comprobación de estado/importe/pagos fallida`);
    factura.vencimiento = undefined;
    await factura.save();
    results.push({ numero, vencimiento: factura.vencimiento ?? null, total: factura.total });
  }
  console.log(JSON.stringify(results));
} finally {
  await mongoose.disconnect();
}
