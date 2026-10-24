import mongoose from "mongoose";
import "dotenv/config";

async function main() {
  const uriBase = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
  await mongoose.connect(`${uriBase}/nexospro`);
  const docs = await mongoose.connection.collection("ordentrabajos").find({}, { projection: { numero: 1 } }).toArray();
  console.log("Total OTs:", docs.length);
  const nums = docs.map((d) => d.numero).sort();
  console.log("Primeros 20:", nums.slice(0, 20));
  console.log("Últimos 20:", nums.slice(-20));
  await mongoose.disconnect();
}

main();
