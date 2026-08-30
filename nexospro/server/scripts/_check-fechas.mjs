import mongoose from "mongoose";

const uriBase = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
await mongoose.connect(`${uriBase}/filanex_local`);
const F = mongoose.connection.collection("facturaventas");

const docs = await F.find({ serieNumero: { $in: ["3-2026-24", "3-2026-25", "3-2026-26", "3-2026-27", "3-2026-28"] } })
  .project({ serieNumero: 1, fechaExpedicion: 1, createdAt: 1, updatedAt: 1, total: 1 })
  .toArray();
for (const d of docs.sort((a, b) => a.serieNumero.localeCompare(b.serieNumero))) {
  console.log(d.serieNumero, "| fecha:", d.fechaExpedicion, "| createdAt:", d.createdAt, "| total:", d.total);
}
await mongoose.disconnect();
