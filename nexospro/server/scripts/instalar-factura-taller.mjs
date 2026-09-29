import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const base = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
const tpl = JSON.parse(fs.readFileSync("/tmp/factura-taller.json", "utf8"));

// Lista las bases filanex_* que contengan "montiel" y les instala la
// plantilla "Factura Taller" como predeterminada de factura-venta.
const admin = await mongoose.createConnection(`${base}/admin`).asPromise();
const dbs = await admin.db.admin().listDatabases();
const destinos = dbs.databases.map((d) => d.name).filter((n) => n.startsWith("filanex_") && n.includes("montiel"));
await admin.close();

if (destinos.length === 0) {
  console.log("No se encontraron bases montiel");
  process.exit(1);
}

for (const dbName of destinos) {
  const conn = await mongoose.createConnection(`${base}/${dbName}`).asPromise();
  const col = conn.db.collection("formatos");
  await col.updateMany({ tipoDocumento: "factura-venta" }, { $set: { porDefecto: false } });
  const existe = await col.findOne({ tipoDocumento: "factura-venta", nombre: tpl.nombre });
  if (existe) {
    await col.updateOne({ _id: existe._id }, { $set: { porDefecto: true, elements: tpl.elements, page: tpl.page } });
    console.log(dbName, "-> ya existia: actualizada y predeterminada");
  } else {
    await col.insertOne({ ...tpl, porDefecto: true, createdAt: new Date(), updatedAt: new Date() });
    console.log(dbName, "-> creada y predeterminada");
  }
  await conn.close();
}
