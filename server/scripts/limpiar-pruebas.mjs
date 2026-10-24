/* Limpia los datos generados por las pruebas de estrés y la cuenta temporal. */

import mongoose from "mongoose";
import "dotenv/config";
import Tenant from "../src/models/plataforma/Tenant.js";
import Cuenta from "../src/models/plataforma/Cuenta.js";
import { conexionTenant } from "../src/models/tenant.js";

const EMAIL = "stress.test@filanex.local";

async function main() {
  const uriBase = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
  const bdPlataforma = process.env.BD_PLATAFORMA || "filanex_plataforma";
  await mongoose.connect(`${uriBase}/${bdPlataforma}`);

  const tenant = await Tenant.findOne({ slug: "local" });
  const conn = conexionTenant(tenant?.dbName || "nexospro");

  // Cargar modelos de negocio sobre la conexión del tenant.
  const FacturaVenta = conn.model("FacturaVenta", (await import("../src/models/FacturaVenta.js")).default.schema);
  const OrdenTrabajo = conn.model("OrdenTrabajo", (await import("../src/models/OrdenTrabajo.js")).default.schema);

  const facturas = await FacturaVenta.deleteMany({ "lineas.descripcion": "Prueba estrés" });
  const ordenes = await OrdenTrabajo.deleteMany({ matricula: "STRESS-TEST" });
  const cuenta = await Cuenta.deleteOne({ email: EMAIL });

  console.log(`Facturas de prueba borradas: ${facturas.deletedCount}`);
  console.log(`Órdenes de prueba borradas: ${ordenes.deletedCount}`);
  console.log(`Cuenta temporal borrada: ${cuenta.deletedCount}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
