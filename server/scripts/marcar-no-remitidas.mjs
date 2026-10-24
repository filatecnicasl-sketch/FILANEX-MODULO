// Una sola vez: las facturas ya emitidas con el envío a la AEAT apagado pasan
// a "no remitidas", igual que las que se emitan a partir de ahora. Solo actúa
// en las empresas que NO tienen el envío activado.
import mongoose from "mongoose";
import "dotenv/config";

await mongoose.connect(process.env.MONGODB_URI_BASE || "mongodb://localhost:27017");
const cliente = mongoose.connection.getClient();
const { databases } = await cliente.db().admin().listDatabases();

for (const d of databases) {
  if (!d.name.startsWith("filanex_") || d.name === "filanex_plataforma" || d.name.includes("auditoria")) continue;
  const db = cliente.db(d.name);
  const emp = await db.collection("empresas").findOne({});
  if (!emp) continue;
  if (emp.verifactu?.envioActivo) {
    console.log(`${d.name}: envío ACTIVADO, no se toca`);
    continue;
  }
  const pendientes = await db
    .collection("registrofacturacions")
    .find({ estadoEnvio: { $in: ["pendiente", "rechazado"] } })
    .project({ facturaVenta: 1 })
    .toArray();
  if (!pendientes.length) {
    console.log(`${d.name}: nada pendiente`);
    continue;
  }
  await db
    .collection("registrofacturacions")
    .updateMany(
      { _id: { $in: pendientes.map((r) => r._id) } },
      { $set: { estadoEnvio: "no_remitido" } }
    );
  await db
    .collection("facturaventas")
    .updateMany(
      { _id: { $in: pendientes.map((r) => r.facturaVenta).filter(Boolean) } },
      { $set: { "verifactu.estadoEnvio": "no_remitido", "verifactu.enviada": false } }
    );
  console.log(`${d.name}: ${pendientes.length} pasadas a "no remitida"`);
}

console.log("hecho");
process.exit(0);
