import "dotenv/config";
import mongoose from "mongoose";
import { existeArchivo } from "./src/services/storage.js";
const c = await mongoose.createConnection("mongodb://localhost:27017/filanex_montiel").asPromise();
const f = await c.db.collection("formatos").findOne({ tipoDocumento: "contrato-cortesia", porDefecto: true });
const emp = await c.db.collection("empresas").findOne({});
console.log("EMPRESA logoUrl", emp?.logoUrl || "(sin logo)", "existe:", await existeArchivo((emp?.logoUrl || "").replace(/^\//, "")));
console.log("PLANTILLA", f?._id, f?.nombre, "updated", f?.updatedAt);
for (const [i,e] of (f?.elements ?? []).entries()) {
  if (i < 8 || e.type === "table" || (e.y >= 100 && e.y < 140) || e.y >= 260) console.log(i, JSON.stringify(e));
}
await c.close();
