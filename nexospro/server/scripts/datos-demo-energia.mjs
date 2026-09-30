// Datos de demostración del módulo Energía en filanex_local:
// comercializadoras con condiciones, clientes agrupados y suministros
// variados. Idempotente: se puede ejecutar varias veces sin duplicar.
import mongoose from "mongoose";

const BASE = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";
const DB = process.argv[2] || "filanex_local";

await mongoose.connect(`${BASE}/${DB}`);
const { default: Comercializadora } = await import("../src/models/Comercializadora.js");
const { default: Suministro } = await import("../src/models/Suministro.js");
const { default: Cliente } = await import("../src/models/Cliente.js");
const { default: Empresa } = await import("../src/models/Empresa.js");

// --- 1. Activar el módulo en la empresa ---
const act = await Empresa.updateMany({}, { $addToSet: { modulos: "energia" } });
console.log("modulo energia activado en", act.modifiedCount, "empresa(s)");

// --- 2. Comercializadoras ---
const comercializadoras = [
  {
    nombre: "Iberdrola Clientes", nif: "A99118511", ciudad: "Bilbao",
    contacto: "Delegado zona levante", telefono: "900 225 235",
    condiciones: { luz: { alta: 60, mensual: 2.5, anual: 12 }, gas: { alta: 40, mensual: 1.5, anual: 8 } },
  },
  {
    nombre: "Endesa Energía", nif: "A81948077", ciudad: "Madrid",
    contacto: "Dpto. canal directo", telefono: "800 760 906",
    condiciones: { luz: { alta: 55, mensual: 2, anual: 10 }, gas: { alta: 35, mensual: 1, anual: 6 } },
  },
  {
    nombre: "Naturgy Iberia", nif: "A08005051", ciudad: "Madrid",
    condiciones: { luz: { alta: 50, mensual: 3, anual: 15 }, gas: { alta: 45, mensual: 2, anual: 9 } },
  },
  {
    nombre: "Repsol Energía", nif: "A78372725", ciudad: "Madrid",
    condiciones: { luz: { alta: 45, mensual: 2, anual: 10 }, gas: { alta: 50, mensual: 2.5, anual: 12 } },
  },
  {
    nombre: "Holaluz", nif: "B67242658", ciudad: "Barcelona",
    condiciones: { luz: { alta: 40, mensual: 1.5, anual: 8 }, gas: { alta: 0, mensual: 0, anual: 0 } },
  },
];
const comPorNombre = {};
for (const c of comercializadoras) {
  const existente = await Comercializadora.findOne({ nombre: c.nombre });
  if (existente) {
    Object.assign(existente, c);
    await existente.save();
    comPorNombre[c.nombre] = existente;
  } else {
    comPorNombre[c.nombre] = await Comercializadora.create(c);
  }
}
console.log("comercializadoras:", Object.keys(comPorNombre).length);

// --- 3. Clientes (dos grupos de empresas + uno suelto) ---
const clientes = [
  { nombre: "TALLERES VEGA SL", nif: "B12345674", grupo: "Grupo Vega", calle: "Pol. Ind. Fuente del Jarro, C/ Isla Corfu 12", cp: "46988", ciudad: "Paterna", provincia: "Valencia", telefono: "961 111 111" },
  { nombre: "AUTOVEGA COMERCIAL SL", nif: "B12345675", grupo: "Grupo Vega", calle: "Av. del Puerto 88", cp: "46022", ciudad: "Valencia", provincia: "Valencia", telefono: "961 222 222" },
  { nombre: "SUPERMERCADOS ANA SL", nif: "B98765432", grupo: "Grupo Ana", calle: "C/ Mayor 45", cp: "46001", ciudad: "Valencia", provincia: "Valencia", telefono: "963 333 333" },
  { nombre: "FRUTAS ANA SL", nif: "B98765433", grupo: "Grupo Ana", calle: "Mercado Central, Puesto 21", cp: "46001", ciudad: "Valencia", provincia: "Valencia", telefono: "963 444 444" },
  { nombre: "PANADERIA LA ESPIGA SL", nif: "B45678901", calle: "C/ Colón 3", cp: "46004", ciudad: "Valencia", provincia: "Valencia", telefono: "963 555 555" },
];
const cliPorNombre = {};
for (const c of clientes) {
  let cli = await Cliente.findOne({ nif: c.nif });
  if (!cli) cli = await Cliente.create(c);
  else if (cli.grupo !== c.grupo) {
    cli.grupo = c.grupo;
    await cli.save();
  }
  cliPorNombre[c.nombre] = cli;
}
console.log("clientes:", Object.keys(cliPorNombre).length);

// --- 4. Suministros ---
const suministros = [
  // Grupo Vega (taller: mucha potencia)
  { cups: "ES0021000000000001AB", tipo: "luz", cliente: "TALLERES VEGA SL", com: "Iberdrola Clientes", calle: "Pol. Ind. Fuente del Jarro, C/ Isla Corfu 12", cp: "46988", ciudad: "Paterna", tarifa: "3.0TD", p1: 45, p2: 45, consumo: 68000, estado: "activo" },
  { cups: "ES0021000000000002CD", tipo: "gas", cliente: "TALLERES VEGA SL", com: "Naturgy Iberia", calle: "Pol. Ind. Fuente del Jarro, C/ Isla Corfu 12", cp: "46988", ciudad: "Paterna", tarifa: "3.4", consumo: 22000, estado: "activo" },
  { cups: "ES0021000000000003EF", tipo: "luz", cliente: "AUTOVEGA COMERCIAL SL", com: "Endesa Energía", calle: "Av. del Puerto 88", cp: "46022", ciudad: "Valencia", tarifa: "2.0TD", p1: 9.2, p2: 9.2, consumo: 7400, estado: "activo" },
  // Grupo Ana (supermercados: refrigeración, mucho consumo)
  { cups: "ES0021000000000004GH", tipo: "luz", cliente: "SUPERMERCADOS ANA SL", com: "Iberdrola Clientes", calle: "C/ Mayor 45", cp: "46001", ciudad: "Valencia", tarifa: "3.0TD", p1: 30, p2: 30, consumo: 51000, estado: "activo" },
  { cups: "ES0021000000000005IJ", tipo: "luz", cliente: "SUPERMERCADOS ANA SL", com: "Repsol Energía", calle: "C/ Cádiz 9 (sucursal 2)", cp: "46005", ciudad: "Valencia", tarifa: "2.0TD", p1: 13.8, p2: 13.8, consumo: 12500, estado: "activo" },
  { cups: "ES0021000000000006KL", tipo: "gas", cliente: "FRUTAS ANA SL", com: "Repsol Energía", calle: "Mercado Central, Puesto 21", cp: "46001", ciudad: "Valencia", tarifa: "3.2", consumo: 9800, estado: "activo" },
  { cups: "ES0021000000000007MN", tipo: "luz", cliente: "FRUTAS ANA SL", com: "Holaluz", calle: "Mercado Central, Puesto 21", cp: "46001", ciudad: "Valencia", tarifa: "2.0TD", p1: 5.7, p2: 5.7, consumo: 4200, estado: "activo" },
  // Panadería (horno: consumo alto de madrugada)
  { cups: "ES0021000000000008OP", tipo: "luz", cliente: "PANADERIA LA ESPIGA SL", com: "Endesa Energía", calle: "C/ Colón 3", cp: "46004", ciudad: "Valencia", tarifa: "3.0TD", p1: 17.2, p2: 17.2, consumo: 28000, estado: "activo" },
  { cups: "ES0021000000000009QR", tipo: "gas", cliente: "PANADERIA LA ESPIGA SL", com: "Naturgy Iberia", calle: "C/ Colón 3", cp: "46004", ciudad: "Valencia", tarifa: "3.3", consumo: 31000, estado: "activo" },
  // Uno inactivo (baja del cliente, para que se vea el filtro de estado)
  { cups: "ES0021000000000010ST", tipo: "luz", cliente: "AUTOVEGA COMERCIAL SL", com: "Endesa Energía", calle: "C/ Ruzafa 101 (local cerrado)", cp: "46006", ciudad: "Valencia", tarifa: "2.0TD", p1: 4.6, p2: 4.6, consumo: 3200, estado: "inactivo" },
];

let creados = 0;
let actualizados = 0;
for (const s of suministros) {
  const cliente = cliPorNombre[s.cliente];
  const com = comPorNombre[s.com];
  const datos = {
    cups: s.cups,
    tipo: s.tipo,
    cliente: cliente._id,
    clienteNombre: cliente.nombre,
    comercializadora: com._id,
    comercializadoraNombre: com.nombre,
    direccion: { calle: s.calle, cp: s.cp, ciudad: s.ciudad, provincia: "Valencia" },
    tarifa: s.tarifa,
    potenciaPunta: s.p1 ?? 0,
    potenciaValle: s.p2 ?? 0,
    consumoAnual: s.consumo,
    estado: s.estado,
    fechaAlta: new Date("2026-01-15"),
  };
  const existente = await Suministro.findOne({ cups: s.cups });
  if (existente) {
    Object.assign(existente, datos);
    await existente.save();
    actualizados++;
  } else {
    await Suministro.create(datos);
    creados++;
  }
}
console.log(`suministros: ${creados} creados, ${actualizados} actualizados`);

const total = await Suministro.countDocuments();
console.log("total suministros en", DB, ":", total);
await mongoose.disconnect();
process.exit(0);
