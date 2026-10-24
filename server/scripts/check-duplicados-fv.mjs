import mongoose from "mongoose";
import "dotenv/config";

async function main() {
  const uriBase = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
  await mongoose.connect(`${uriBase}/nexospro`);
  const docs = await mongoose.connection.collection("facturaventas").find({}, { projection: { serieNumero: 1 } }).toArray();
  const nums = docs.map((d) => d.serieNumero).filter(Boolean);
  const unicos = new Set(nums);
  console.log("Total facturas venta:", nums.length);
  console.log("Únicos:", unicos.size);
  if (nums.length !== unicos.size) {
    const vistos = new Set();
    const dup = [];
    for (const n of nums) {
      if (vistos.has(n)) dup.push(n);
      vistos.add(n);
    }
    console.log("Duplicados:", [...new Set(dup)]);
  } else {
    console.log("No hay duplicados.");
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
