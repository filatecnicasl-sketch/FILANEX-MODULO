// Facturas del cliente LA FACTORIA BOTANICO S.L. en filanex_local.
import "dotenv/config";
import mongoose from "mongoose";

const base = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
const conn = await mongoose.createConnection(`${base}/filanex_local`).asPromise();
const Factura = conn.model("F", new mongoose.Schema({}, { strict: false, collection: "facturaventas" }));
const facturas = await Factura.find({ cliente: new mongoose.Types.ObjectId("6a8e1b29fda70c7bc6701160") }).lean();
console.log(`facturas del cliente: ${facturas.length}`);
for (const f of facturas) {
  const cobrado = (f.cobros ?? []).reduce((s, x) => s + (x.importe ?? 0), 0);
  console.log(JSON.stringify({
    id: f._id,
    serieNumero: f.serieNumero,
    numero: f.numero,
    estado: f.estado,
    fecha: f.fechaExpedicion,
    total: f.total,
    cobrado,
    cobros: f.cobros,
  }));
}
await conn.close();
