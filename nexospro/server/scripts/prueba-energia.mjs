// Prueba funcional del módulo Energía contra la BD local: crea una
// comercializadora y un suministro, los lista y los borra.
import { MongoClient } from "mongodb";

const BASE = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";

async function main() {
  // 1. Arrancar contexto de tenant (AsyncLocalStorage) requiere el servidor;
  //    aquí se prueba a nivel de BD que los modelos compilan y las colecciones
  //    se crean con los índices correctos usando mongoose directamente.
  const { connect } = await import("../src/models/tenant.js").catch(() => ({}));
  const mongoose = (await import("mongoose")).default;
  await mongoose.connect(BASE + "/filanex_local");
  const { default: Comercializadora } = await import("../src/models/Comercializadora.js");
  const { default: Suministro } = await import("../src/models/Suministro.js");
  const { default: Cliente } = await import("../src/models/Cliente.js");

  // Limpieza de prueba previa
  await Promise.all([
    Comercializadora.deleteMany({ nombre: "PRUEBA ENERGIA SL" }),
    Suministro.deleteMany({ cups: "ES0021000000000000AB" }),
  ]);

  const com = await Comercializadora.create({
    nombre: "PRUEBA ENERGIA SL",
    condiciones: { luz: { alta: 50, mensual: 2, anual: 10 }, gas: { alta: 30, mensual: 1, anual: 5 } },
  });
  console.log("comercializadora creada:", com.nombre, JSON.stringify(com.condiciones));

  const cli = await Cliente.findOne({});
  if (!cli) throw new Error("No hay clientes en filanex_local para la prueba");

  const sum = await Suministro.create({
    cups: "es0021 0000 0000 000a b", // con espacios y minúsculas a propósito
    tipo: "luz",
    cliente: cli._id,
    clienteNombre: cli.nombre,
    comercializadora: com._id,
    comercializadoraNombre: com.nombre,
    tarifa: "2.0TD",
    potenciaPunta: 5.5,
    potenciaValle: 5.5,
    consumoAnual: 4000,
  });
  console.log("suministro creado. CUPS normalizado:", sum.cups, "| cliente:", sum.clienteNombre);

  // Validación de CUPS duplicado
  try {
    await Suministro.create({ cups: "ES0021000000000000AB", tipo: "gas" });
    console.log("ERROR: dejó crear duplicado");
  } catch (e) {
    console.log("duplicado rechazado OK:", e.code === 11000 ? "índice único" : e.message);
  }

  // Validación de CUPS mal formado (a nivel de esquema/ruta se valida en la
  // ruta; aquí se comprueba la normalización).
  console.log("total suministros:", await Suministro.countDocuments());

  await Suministro.deleteMany({ cups: "ES0021000000000000AB" });
  await Comercializadora.deleteMany({ nombre: "PRUEBA ENERGIA SL" });
  console.log("limpieza OK");
  await mongoose.disconnect();
  const c = new MongoClient(BASE);
  await c.connect();
  await c.close();
}

main().catch((e) => {
  console.error("FALLO:", e.message);
  process.exit(1);
});
