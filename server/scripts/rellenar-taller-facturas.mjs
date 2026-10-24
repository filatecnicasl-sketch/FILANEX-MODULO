// Rellena la copia de datos del taller (f.taller) en las facturas de venta
// que nacieron de una orden y aún no la tienen. Así, si la orden se borra,
// la factura se reimprime igual de completa.
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const base = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";

const admin = await mongoose.createConnection(`${base}/admin`).asPromise();
const dbs = await admin.db.admin().listDatabases();
await admin.close();

for (const dbName of dbs.databases.map((d) => d.name).filter((n) => n.startsWith("filanex_") && n !== "filanex_plataforma")) {
  const conn = await mongoose.createConnection(`${base}/${dbName}`).asPromise();
  const colecciones = (await conn.db.listCollections().toArray()).map((c) => c.name);
  if (!colecciones.includes("facturaventas") || !colecciones.includes("ordentrabajos")) {
    await conn.close();
    continue;
  }
  const facturas = conn.db.collection("facturaventas");
  const ordenes = conn.db.collection("ordentrabajos");
  const vehiculos = conn.db.collection("vehiculos");
  const aseguradoras = conn.db.collection("aseguradoras");

  const pendientes = await facturas
    .find({ "origen.ordenTrabajo": { $exists: true, $ne: null }, "taller.orden": { $exists: false } })
    .toArray();
  let n = 0;
  for (const f of pendientes) {
    const o = await ordenes.findOne({ _id: f.origen.ordenTrabajo });
    if (!o) continue;
    const v = o.vehiculo ? await vehiculos.findOne({ _id: o.vehiculo }) : null;
    const a = o.aseguradora ? await aseguradoras.findOne({ _id: o.aseguradora }) : null;
    await facturas.updateOne(
      { _id: f._id },
      {
        $set: {
          taller: {
            vehiculo: v ? [v.marca, v.modelo].filter(Boolean).join(" ") : undefined,
            orden: o.numero,
            aseguradora: a?.nombre || undefined,
            siniestro: o.numeroSiniestro || undefined,
            km: o.km ?? undefined,
            fechaEntrada: o.fechaEntrada ?? undefined,
          },
        },
      }
    );
    n += 1;
  }
  if (n > 0) console.log(dbName, "->", n, "factura(s) con copia de taller");
  await conn.close();
}
console.log("Listo");
process.exit(0);
