import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const base = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
const tpl = JSON.parse(fs.readFileSync(process.argv[2] || "/tmp/recepcion-vehiculo.json", "utf8"));

// Actualiza la plantilla "Recepción de Vehículo" (hoja de entrada de taller)
// en todas las bases filanex_*: nueva distribución con el bloque amplio de
// descripción de la avería. Si el tenant no la tiene, se crea.
const admin = await mongoose.createConnection(`${base}/admin`).asPromise();
const dbs = await admin.db.admin().listDatabases();
const destinos = dbs.databases.map((d) => d.name).filter((n) => n.startsWith("filanex_") && n !== "filanex_plataforma");
await admin.close();

for (const dbName of destinos) {
  const conn = await mongoose.createConnection(`${base}/${dbName}`).asPromise();
  const col = conn.db.collection("formatos");
  const existe = await col.findOne({ tipoDocumento: "entrada-taller" });
  if (existe) {
    await col.updateOne(
      { _id: existe._id },
      { $set: { nombre: tpl.nombre, page: tpl.page, elements: tpl.elements, updatedAt: new Date() } }
    );
    console.log(dbName, "-> hoja de entrada actualizada");
  } else {
    await col.insertOne({ ...tpl, porDefecto: true, createdAt: new Date(), updatedAt: new Date() });
    console.log(dbName, "-> hoja de entrada creada");
  }
  await conn.close();
}
