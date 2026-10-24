// Datos mínimos para probar el flujo VeriFactu end-to-end.
import mongoose from "mongoose";
import "dotenv/config";
import Empresa from "../src/models/Empresa.js";
import Cliente from "../src/models/Cliente.js";

await mongoose.connect(process.env.MONGODB_URI);

const empresa = await Empresa.findOneAndUpdate(
  { nif: "B75418350" },
  {
    nombre: "FILA TECNICA SL",
    nif: "B75418350",
    series: [{ nombre: "General", prefijo: "A-", siguienteNumero: 1 }],
    verifactu: { modalidad: "VERIFACTU" },
  },
  { upsert: true, new: true }
);

const cliente = await Cliente.findOneAndUpdate(
  { nif: "B12345674" },
  { nombre: "CLIENTE DE PRUEBA SL", nif: "B12345674", empresa: empresa._id },
  { upsert: true, new: true }
);

console.log(JSON.stringify({ empresaId: empresa._id, clienteId: cliente._id }, null, 2));
await mongoose.disconnect();
