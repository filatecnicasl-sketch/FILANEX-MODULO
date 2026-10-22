import mongoose from "mongoose";
const c = await mongoose.createConnection("mongodb://localhost:27017/filanex_montiel").asPromise();
for (const id of ["6ad7599be2623ebb3cd30b5f","6ad75969e2623ebb3cd30aeb","6ad75892e2623ebb3cd30a21"]) {
  const p = await c.db.collection("propuestas").findOne({ _id: new mongoose.Types.ObjectId(id) });
  console.log("----", id, "|", p?.usuarioNombre, "| adjuntos:", JSON.stringify(p?.adjuntos ?? []));
}
await c.close();
