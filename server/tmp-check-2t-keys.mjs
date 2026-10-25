import mongoose from "mongoose";
import "dotenv/config";
import { uriBase } from "./src/config/db.js";
import FacturaCompra from "./src/models/FacturaCompra.js";
import Proveedor from "./src/models/Proveedor.js";

const numbers = [
  ...Array.from({ length: 8 }, (_, i) => `PJQ0IGLM-${String(i + 1).padStart(4, "0")}`),
  "LINKT-31963174", "LINKT-31994482", "LINKT-31995192", "LINKT-32054934", "LINKT-32062376", "LINKT-32073102",
  "261F0001014-02714F", "261F0001341-02714F", "261F0001661-02714F",
  "FVH2604/1506", "FVH2605/0248", "FVH2604/1206", "FVH2605/0541",
  "202786252739", "202786252740", "202786252741", "202786079854", "202786294086", "202786353190",
  "202786502401", "202786502402", "202786502403", "202786539225", "202786594166", "202786719855",
  "202786719856", "202786719857",
  "E10010866283-0426", "E10010975520-0526", "E10011073312-0626",
  "F26-4262", "F26-4809", "6", "",
];
const key = (s) => String(s ?? "").trim().toUpperCase().replace(/O/g, "0").replace(/I/g, "1");
await mongoose.connect(`${uriBase().replace(/\/+$/, "")}/filanex_local`);
await Proveedor.findOne().select("_id").lean();
const all = await FacturaCompra.find({ numeroFacturaProveedor: { $nin: [null, ""] } })
  .populate("proveedor", "nombre nif")
  .select("numeroFacturaProveedor fechaExpedicion baseImponible cuotaIva total divisa totalDivisa estado origen ocr.ficheroUrl proveedor")
  .lean();
const wanted = new Set(numbers.filter(Boolean).map(key));
const matches = all.filter((f) => wanted.has(key(f.numeroFacturaProveedor)));
const proveedores = await Proveedor.find({ nif: { $in: ["B91554824", "52267428C", "B30542849", "B85049435", "A82009812", "B84414796", "EU440000220"] } })
  .select("_id nombre nif alias")
  .lean();
console.log(JSON.stringify({ matches, proveedores }, null, 2));
await mongoose.disconnect();
