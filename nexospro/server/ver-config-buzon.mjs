// Muestra la configuración actual del buzón entrante.
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;
const empresa = await db.collection("empresas").findOne({}, { projection: { correoEntrante: 1 } });
console.log(JSON.stringify(empresa?.correoEntrante, null, 2));
await mongoose.disconnect();
