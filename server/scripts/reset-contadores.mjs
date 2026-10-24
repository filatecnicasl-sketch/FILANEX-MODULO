import mongoose from "mongoose";
import "dotenv/config";

async function main() {
  const uriBase = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
  const dbName = process.argv[2] || "nexospro";
  await mongoose.connect(`${uriBase}/${dbName}`);
  await mongoose.connection.collection("contadors").deleteMany({});
  console.log("Contadores borrados de", dbName);
  await mongoose.disconnect();
}

main();
