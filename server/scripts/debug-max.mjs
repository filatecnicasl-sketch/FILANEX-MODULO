import mongoose from "mongoose";
import "dotenv/config";

async function main() {
  const uriBase = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
  await mongoose.connect(`${uriBase}/nexospro`);
  const { default: OrdenTrabajo } = await import("../src/models/OrdenTrabajo.js");
  const docs = await OrdenTrabajo.find({ numero: { $exists: true } }).select("numero").lean();
  console.log("Docs:", docs.length);
  const nums = docs.map((d) => d.numero);
  console.log(nums);
  function extraerNumero(cadena) {
    const match = String(cadena).match(/(\d+)$/);
    return match ? Number(match[1]) : 0;
  }
  const max = docs.reduce((m, d) => Math.max(m, extraerNumero(d.numero)), 0);
  console.log("Max:", max);
  await mongoose.disconnect();
}

main();
