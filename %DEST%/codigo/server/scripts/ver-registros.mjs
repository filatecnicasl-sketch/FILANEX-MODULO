import mongoose from "mongoose";
import "dotenv/config";
import RegistroFacturacion from "../src/models/RegistroFacturacion.js";

await mongoose.connect(process.env.MONGODB_URI);
const registros = await RegistroFacturacion.find().sort({ _id: 1 });
for (const r of registros) {
  console.log(`--- ${r.tipo} ${r.numSerieFactura} | huella ${r.huella.slice(0, 12)}... | anterior ${r.huellaAnterior ? r.huellaAnterior.slice(0, 12) + "..." : "(primer registro)"}`);
  const m = r.xml.match(/<sf:Encadenamiento>[\s\S]*?<\/sf:Encadenamiento>/);
  console.log(m ? m[0] : "(sin bloque Encadenamiento)");
}
await mongoose.disconnect();
