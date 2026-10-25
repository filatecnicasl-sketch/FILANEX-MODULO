// Recorre todas las BDs filanex_* y cuenta autofacturas del módulo de
// energía (colección autofacturaenergias) y de la nueva sección de Ventas
// (facturaventas con tipoDocumento "autofactura").
import mongoose from "mongoose";
import "dotenv/config";

const uri = (process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017").replace(/\/+$/, "");
await mongoose.connect(uri);
try {
  const { databases } = await mongoose.connection.db.admin().listDatabases();
  const tenants = databases
    .map((d) => d.name)
    .filter((n) => n.startsWith("filanex_") && n !== "filanex_plataforma")
    .sort();
  const resumen = [];
  for (const dbName of tenants) {
    const conn = mongoose.connection.useDb(dbName, { useCache: true });
    const energia = await conn.collection("autofacturaenergias").countDocuments();
    const ventas = await conn
      .collection("facturaventas")
      .countDocuments({ tipoDocumento: "autofactura" });
    if (energia > 0 || ventas > 0) {
      const detalleEnergia = energia > 0
        ? await conn.collection("autofacturaenergias").find().sort({ createdAt: -1 }).limit(20).toArray()
        : [];
      resumen.push({
        dbName,
        energia,
        ventas,
        detalleEnergia: detalleEnergia.map((a) => ({
          comercializadora: a.comercializadoraNombre,
          numero: a.numero,
          periodo: a.periodo,
          base: a.base,
          iva: a.iva,
          total: a.total,
          estado: a.estado,
          fechaCobro: a.fechaCobro,
          createdAt: a.createdAt,
        })),
      });
    } else {
      resumen.push({ dbName, energia: 0, ventas: 0 });
    }
  }
  console.log(JSON.stringify(resumen, null, 2));
} finally {
  await mongoose.disconnect();
}
