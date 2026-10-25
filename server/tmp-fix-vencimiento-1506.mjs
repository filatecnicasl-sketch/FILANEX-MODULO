import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import FacturaCompra from "./src/models/FacturaCompra.js";
import Proveedor from "./src/models/Proveedor.js";
await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
try {
  const proveedor = await Proveedor.findOne({ nif: "B30542849" }).select("_id nombre").lean();
  if (!proveedor) throw new Error("Proveedor Hispamicro no encontrado");
  const matches = await FacturaCompra.find({ proveedor: proveedor._id, numeroFacturaProveedor: "FVH2604/1506" });
  if (matches.length !== 1) throw new Error(`Se esperaba una factura; encontradas ${matches.length}`);
  const factura = matches[0];
  if (Math.abs(factura.total - 191.63) > 0.01) throw new Error(`Total inesperado: ${factura.total}`);
  const vencimiento = new Date("2026-05-29T00:00:00.000Z");
  if (factura.vencimiento && new Date(factura.vencimiento).toISOString().slice(0, 10) !== "2026-05-29") {
    throw new Error(`Ya hay un vencimiento distinto: ${factura.vencimiento.toISOString()}`);
  }
  factura.vencimiento = vencimiento;
  await factura.save();
  console.log(JSON.stringify({ numero: factura.numeroFacturaProveedor, fecha: factura.fechaExpedicion, vencimiento: factura.vencimiento, total: factura.total, pagos: factura.pagos.length, estado: factura.estado }));
} finally {
  await mongoose.disconnect();
}
