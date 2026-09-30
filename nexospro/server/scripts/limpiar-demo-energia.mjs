// Quita los datos de demostración del módulo Energía creados por
// datos-demo-energia.mjs (suministros, clientes y comercializadoras de
// prueba) y desactiva el módulo. Solo borra las entidades exactas del
// demo; los clientes solo se borran si no tienen facturas.
// Uso: node scripts/limpiar-demo-energia.mjs [dbName]
import mongoose from "mongoose";

const BASE = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";
const DB = process.argv[2] || "filanex_local";

const CUPS_DEMO = [
  "ES0021000000000001AB", "ES0021000000000002CD", "ES0021000000000003EF",
  "ES0021000000000004GH", "ES0021000000000005IJ", "ES0021000000000006KL",
  "ES0021000000000007MN", "ES0021000000000008OP", "ES0021000000000009QR",
  "ES0021000000000010ST",
];
const NIFS_DEMO = ["B12345674", "B12345675", "B98765432", "B98765433", "B45678901"];
const COMERCIALES_DEMO = [
  "Iberdrola Clientes", "Endesa Energía", "Naturgy Iberia",
  "Repsol Energía", "Holaluz",
];

await mongoose.connect(`${BASE}/${DB}`);
const { default: Comercializadora } = await import("../src/models/Comercializadora.js");
const { default: Suministro } = await import("../src/models/Suministro.js");
const { default: Cliente } = await import("../src/models/Cliente.js");
const { default: Empresa } = await import("../src/models/Empresa.js");
const { default: FacturaVenta } = await import("../src/models/FacturaVenta.js");

const rS = await Suministro.deleteMany({ cups: { $in: CUPS_DEMO } });
console.log("suministros borrados:", rS.deletedCount);

let clientesBorrados = 0;
let clientesConservados = [];
for (const nif of NIFS_DEMO) {
  const cli = await Cliente.findOne({ nif });
  if (!cli) continue;
  const facturas = await FacturaVenta.countDocuments({ cliente: cli._id });
  if (facturas > 0) {
    clientesConservados.push(`${cli.nombre} (${facturas} facturas)`);
    continue;
  }
  await cli.deleteOne();
  clientesBorrados++;
}
console.log("clientes de demo borrados:", clientesBorrados);
if (clientesConservados.length) console.log("conservados por tener datos:", clientesConservados.join(", "));

const rC = await Comercializadora.deleteMany({ nombre: { $in: COMERCIALES_DEMO } });
console.log("comercializadoras borradas:", rC.deletedCount);

const rE = await Empresa.updateMany({}, { $pull: { modulos: "energia" } });
console.log("modulo energia desactivado en", rE.modifiedCount, "empresa(s)");

console.log("total suministros restantes en", DB, ":", await Suministro.countDocuments());
await mongoose.disconnect();
process.exit(0);
