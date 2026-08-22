import mongoose from "mongoose";
import "dotenv/config";

async function main() {
  const uriBase = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
  await mongoose.connect(`${uriBase}/nexospro`);
  const docs = await mongoose.connection.collection("contadors").find({}).toArray();
  console.log("Contadores:", docs);
  await mongoose.disconnect();
}

main();
