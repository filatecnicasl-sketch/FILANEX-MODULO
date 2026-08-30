// Semilla de la asesoría de demostración "Gasen Asesores".
//
// Crea el tenant `gasen` (módulo Asesoría) con una cartera completa:
//  - vínculos FILANEX firmados con las empresas cliente pasadas por CLI
//    (aparecen en la cartera con insignia FILANEX y documentos importados);
//  - clientes de cartera manuales (SL y autónomos) con documentos de los
//    tres primeros trimestres del año en curso;
//  - solicitudes de documentos y cierres trimestrales realistas.
//
// Uso:
//   node scripts/semilla-gasen.mjs [slugEmpresaCliente ...]
// Ejemplo local:  node scripts/semilla-gasen.mjs demo demo-limitado talleresjmontiel
// Ejemplo nube:   node scripts/semilla-gasen.mjs demofilanex local
//
// La ejecución es idempotente: si Gasen ya existe, se borra y se regenera.
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";
import Cuenta from "../src/models/plataforma/Cuenta.js";
import VinculoAsesoria from "../src/models/plataforma/VinculoAsesoria.js";
import Empresa from "../src/models/Empresa.js";
import ClienteAsesoria from "../src/models/ClienteAsesoria.js";
import DocumentoFiscal from "../src/models/DocumentoFiscal.js";
import SolicitudDocumento from "../src/models/SolicitudDocumento.js";
import CierreTrimestral from "../src/models/CierreTrimestral.js";
import { crearTenant } from "../src/services/tenant.js";
import { conexionTenant, conContexto } from "../src/models/tenant.js";
import {
  codigoDeAsesoria,
  asegurarClienteEnCartera,
  documentosDeVinculo,
  tipoIvaEfectivo,
} from "../src/services/vinculos-asesoria.js";

const SLUGS_CLIENTES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["demo", "demo-limitado", "talleresjmontiel"];

const HOY = new Date();
const ANO = HOY.getFullYear();
const TRIMESTRE_ACTUAL = Math.floor(HOY.getMonth() / 3) + 1;

const redondear = (n) => Math.round(n * 100) / 100;
const aleatorio = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const elegir = (arr) => arr[Math.floor(Math.random() * arr.length)];
let contadorNif = 100;
function nifEmpresa() {
  contadorNif += 7;
  return `B${String(43000000 + contadorNif * 13).slice(0, 8)}`;
}
function nifPersona() {
  contadorNif += 3;
  return `${String(51000000 + contadorNif * 11).slice(0, 8)}${elegir("TRWAGMYFPDXBNJZSQVHLCKE".split(""))}`;
}
function fechaAleatoria(trimestre) {
  const mesIni = (trimestre - 1) * 3;
  const mes = mesIni + aleatorio(0, trimestre === TRIMESTRE_ACTUAL ? Math.max(0, HOY.getMonth() - mesIni) : 2);
  const ultimoDia = new Date(ANO, mes + 1, 0).getDate();
  const dia = Math.min(aleatorio(1, 28), ultimoDia);
  const f = new Date(ANO, mes, dia, aleatorio(9, 19), aleatorio(0, 59));
  return f > HOY ? new Date(HOY) : f;
}
const isoCorta = (f) => f.toISOString().slice(0, 10);

// ------------------------------------------------------------- conexión ---

await connectDB();

// Limpieza idempotente de ejecuciones anteriores.
const gasenViejo = await Tenant.findOne({ slug: "gasen" });
if (gasenViejo) {
  await VinculoAsesoria.deleteMany({ $or: [{ asesoria: gasenViejo._id }, { cliente: gasenViejo._id }] });
  await Cuenta.deleteMany({ tenant: gasenViejo._id });
  await Tenant.deleteOne({ _id: gasenViejo._id });
  await mongoose.connection.useDb(gasenViejo.dbName).dropDatabase();
  console.log("Gasen anterior eliminado para regenerarlo.");
}

// ---------------------------------------------------------- tenant Gasen ---

const gasen = await crearTenant({
  slug: "gasen",
  nombre: "Gasen Asesores",
  email: "demo@gasen.es",
  password: "Demo@2026",
  adminNombre: "Marcos Gasen",
});
gasen.estado = "demo";
gasen.plan = "profesional";
gasen.nif = "B87345921";
gasen.ciudad = "Madrid";
gasen.telefono = "910 234 567";
gasen.modulos = ["asesoria"];
await gasen.save();
const codigoGasen = await codigoDeAsesoria(gasen);

const ctxGasen = { conn: conexionTenant(gasen.dbName), slug: gasen.slug, dbName: gasen.dbName };

await conContexto(ctxGasen, async () => {
  await Empresa.create({
    nombre: "Gasen Asesores S.L.P.",
    nif: "B87345921",
    telefono: "910 234 567",
    email: "info@gasenasesores.es",
    direccion: { calle: "Calle Serrano 21, 3ºB", cp: "28001", ciudad: "Madrid", provincia: "Madrid" },
    modulos: ["asesoria"],
  });
});
console.log(`Tenant Gasen creado (BD ${gasen.dbName}) · código ${codigoGasen}`);

// ------------------------------------------ vínculos con empresas Filanex ---

const vinculosCreados = [];
for (const slug of SLUGS_CLIENTES) {
  const cliente = await Tenant.findOne({ slug }); // eslint-disable-line no-await-in-loop
  if (!cliente) {
    console.log(`  · Aviso: no existe el tenant "${slug}", se omite el vínculo.`);
    continue;
  }
  const admin = await Cuenta.findOne({ tenant: cliente._id, rol: "admin" }).lean(); // eslint-disable-line no-await-in-loop
  const empCliente = await conexionTenant(cliente.dbName).model("Empresa").findOne().lean(); // eslint-disable-line no-await-in-loop

  const firmadoHaceDias = aleatorio(30, 120);
  const vinculo = await VinculoAsesoria.create({ // eslint-disable-line no-await-in-loop
    asesoria: gasen._id,
    cliente: cliente._id,
    estado: "activo",
    compartir: { ventas: true, compras: true, tickets: true },
    autorizacion: {
      versionTexto: "v1",
      fechaAceptacion: new Date(HOY.getTime() - firmadoHaceDias * 86400000),
      usuarioEmail: admin?.email ?? "admin",
      ip: "85.57.112.48",
    },
    origen: "codigo",
  });
  vinculo.clienteCarteraId = await asegurarClienteEnCartera(vinculo, gasen, { // eslint-disable-line no-await-in-loop
    nombre: empCliente?.nombre ?? cliente.nombre,
    nif: empCliente?.nif ?? cliente.nif ?? "",
    email: empCliente?.email ?? cliente.emailContacto ?? "",
    telefono: empCliente?.telefono ?? cliente.telefono ?? "",
  });
  await vinculo.save(); // eslint-disable-line no-await-in-loop
  vinculosCreados.push({ vinculo, tenant: cliente });
  console.log(`  Vínculo firmado: ${cliente.nombre} (${slug})`);
}

// ---------------------------------------------- cartera de clientes manual ---

const CLIENTES_MANUALES = [
  { nombre: "Restaurante La Marina S.L.", forma: "sl", actividad: "Restauración", epigrafe: "671.1", ivaHabitual: 10, empleados: 6, cuota: 180, areas: { fiscal: true, contable: true, laboral: true }, modelos: ["303", "390", "111", "190"] },
  { nombre: "Construcciones Hermanos Ruiz S.L.", forma: "sl", actividad: "Construcción", epigrafe: "501.3", ivaHabitual: 21, empleados: 12, cuota: 260, areas: { fiscal: true, contable: true, laboral: true }, modelos: ["303", "390", "111", "190", "347"] },
  { nombre: "Peluquería Estilo Norte", forma: "autonomo", regimen: "estimacion_objetiva", actividad: "Peluquería", epigrafe: "972.1", ivaHabitual: 21, empleados: 2, cuota: 75, areas: { fiscal: true, contable: false, laboral: true }, modelos: ["303", "390", "131"] },
  { nombre: "Farmacia San Antón", forma: "autonomo", regimen: "estimacion_directa_simplificada", actividad: "Farmacia", epigrafe: "644.1", ivaHabitual: 4, empleados: 3, cuota: 150, areas: { fiscal: true, contable: true, laboral: true }, modelos: ["303", "390", "130", "111"] },
  { nombre: "Autocares del Valle S.L.U.", forma: "slu", actividad: "Transporte de viajeros", epigrafe: "722.3", ivaHabitual: 21, empleados: 8, cuota: 220, areas: { fiscal: true, contable: true, laboral: true }, modelos: ["303", "390", "111", "190"] },
  { nombre: "Clínica Dental Sonrisa S.L.P.", forma: "sl", actividad: "Clínica dental", epigrafe: "833.2", ivaHabitual: 21, empleados: 5, cuota: 210, areas: { fiscal: true, contable: true, laboral: true }, modelos: ["303", "390", "111"] },
  { nombre: "Óptica Visión Clara S.L.", forma: "sl", actividad: "Comercio óptica", epigrafe: "659.4", ivaHabitual: 21, empleados: 2, cuota: 140, areas: { fiscal: true, contable: true, laboral: false }, modelos: ["303", "390"] },
  { nombre: "Javier Molina Pardo", forma: "autonomo", regimen: "estimacion_directa_simplificada", actividad: "Diseñador freelance", epigrafe: "844.1", ivaHabitual: 21, empleados: 0, cuota: 60, areas: { fiscal: true, contable: false, laboral: false }, modelos: ["303", "390", "130", "100"], retencion: 7 },
  { nombre: "Papelería El Lápiz C.B.", forma: "cb", actividad: "Comercio papelería", epigrafe: "659.1", ivaHabitual: 21, empleados: 1, cuota: 90, areas: { fiscal: true, contable: true, laboral: false }, modelos: ["303", "390"] },
  { nombre: "Taller de Bicicletas Rueda Libre", forma: "autonomo", regimen: "estimacion_directa_simplificada", actividad: "Reparación bicicletas", epigrafe: "977.4", ivaHabitual: 21, empleados: 0, cuota: 65, areas: { fiscal: true, contable: false, laboral: false }, modelos: ["303", "390", "130"] },
];

const PROVEEDORES = [
  { nombre: "Iberdrola Clientes S.A.U.", tipo: 21 },
  { nombre: "Telefónica de España S.A.U.", tipo: 21 },
  { nombre: "Recambios del Sur S.L.", tipo: 21 },
  { nombre: "Distribuciones Alimentarias Ortega S.L.", tipo: 10 },
  { nombre: "Makro Cash & Carry", tipo: 21 },
  { nombre: "Alquileres Urbanos Centro S.L.", tipo: 21 },
  { nombre: "Seguros Mapfre", tipo: 0 },
  { nombre: "Papelería Mayorista Central S.A.", tipo: 21 },
];
const CLIENTES_FINALES = [
  "Ayuntamiento de Getafe", "Comunidad de Propietarios Alcalá 44", "Eventos y Congresos Madrileños S.L.",
  "Inversiones Panorama S.L.", "Colegio San Patricio", "Hotel Prado Real", "Cafetería El Rincón",
  "Logística Peninsular S.A.", "Clínica Veterinaria Ciudad", "Asociación de Vecinos El Pilar",
];
const COMERCIOS_TICKET = [
  { nombre: "Repsol Estación A-2", categoria: "vehiculo_combustible", pct: 100 },
  { nombre: "Restaurante El Fogón", categoria: "dietas_comidas", pct: 100 },
  { nombre: "Ferretería Industrial Losa", categoria: "herramientas", pct: 100 },
  { nombre: "Parking Centro", categoria: "vehiculo_otros", pct: 100 },
  { nombre: "Vodafone Tienda", categoria: "comunicaciones", pct: 100 },
];

const clientesCartera = await conContexto(ctxGasen, async () => {
  const creados = [];
  for (const [i, c] of CLIENTES_MANUALES.entries()) {
    const esAutonomo = c.forma === "autonomo";
    const doc = await ClienteAsesoria.create({ // eslint-disable-line no-await-in-loop
      codigo: `GAS-${String(i + 1).padStart(3, "0")}`,
      nombre: c.nombre,
      nif: esAutonomo ? nifPersona() : nifEmpresa(),
      formaJuridica: c.forma,
      regimenIrpf: c.regimen,
      actividad: c.actividad,
      epigrafe: c.epigrafe,
      telefono: `6${aleatorio(10, 99)} ${aleatorio(100, 999)} ${aleatorio(100, 999)}`,
      email: `gestion${i + 1}@${c.nombre.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12)}.es`,
      personaContacto: c.nombre.split(" ")[0] + " (gerente)",
      areas: c.areas,
      modelos: c.modelos,
      numeroEmpleados: c.empleados,
      cuotaMensual: c.cuota,
      fechaAlta: new Date(HOY.getTime() - aleatorio(60, 540) * 86400000),
    });
    creados.push({ doc, conf: c });
  }
  return creados;
});
console.log(`Cartera: ${clientesCartera.length} clientes manuales + ${vinculosCreados.length} vinculados`);

// ----------------------------------------------------------- documentos ---

let totalImportados = 0;
let totalManuales = 0;

// 1) Importados desde las empresas vinculadas (igual que haría el asesor).
for (const { vinculo, tenant } of vinculosCreados) {
  const docs = await documentosDeVinculo(vinculo, tenant, { tipo: "todos" }); // eslint-disable-line no-await-in-loop
  await conContexto(ctxGasen, async () => { // eslint-disable-line no-await-in-loop
    for (const d of docs) {
      try {
        await DocumentoFiscal.create({ // eslint-disable-line no-await-in-loop
          clienteAsesoria: vinculo.clienteCarteraId,
          tipo: d.tipo,
          fecha: d.fecha,
          numero: d.numero,
          tercero: d.tercero,
          nifTercero: d.nifTercero,
          base: d.base,
          tipoIva: tipoIvaEfectivo(d.base, d.cuotaIva),
          cuotaIva: d.cuotaIva,
          total: d.total,
          origen: "filanex",
          origenRef: { vinculo: vinculo._id, coleccion: d.coleccion, documentoId: d.documentoId },
          estado: "revisado",
        });
        totalImportados += 1;
      } catch (e) {
        if (e?.code !== 11000) throw e;
      }
    }
  });
  console.log(`  Importados de ${tenant.nombre}: ${docs.length}`);
}

// 2) Documentos manuales/OCR de la cartera para los trimestres ya pasados.
await conContexto(ctxGasen, async () => {
  for (const { doc, conf } of clientesCartera) {
    const trimestres = [];
    for (let t = 1; t < TRIMESTRE_ACTUAL; t++) trimestres.push(t);
    trimestres.push(TRIMESTRE_ACTUAL); // trimestre en curso, parcial
    for (const t of trimestres) {
      const nEmitidas = aleatorio(3, 6);
      const nRecibidas = aleatorio(3, 6);
      const nGastos = aleatorio(1, 3);
      for (let i = 0; i < nEmitidas; i++) {
        const base = aleatorio(150, 4800);
        const tipo = conf.ivaHabitual;
        const cuota = redondear((base * tipo) / 100);
        const esUltimoTrimestre = t === TRIMESTRE_ACTUAL;
        await DocumentoFiscal.create({ // eslint-disable-line no-await-in-loop
          clienteAsesoria: doc._id,
          tipo: "emitida",
          fecha: fechaAleatoria(t),
          numero: `${doc.codigo.replace("GAS", "F")}-${ANO}-${String(i + 1 + t * 10).padStart(3, "0")}`,
          tercero: elegir(CLIENTES_FINALES),
          nifTercero: nifEmpresa(),
          base,
          tipoIva: tipo,
          cuotaIva: cuota,
          total: redondear(base + cuota - (conf.retencion ? redondear((base * conf.retencion) / 100) : 0)),
          retencion: conf.retencion ?? 0,
          origen: elegir(["ocr", "manual"]),
          estado: esUltimoTrimestre && Math.random() < 0.4 ? "pendiente" : "revisado",
        });
      }
      for (let i = 0; i < nRecibidas; i++) {
        const prov = elegir(PROVEEDORES);
        const base = aleatorio(60, 2200);
        const cuota = redondear((base * prov.tipo) / 100);
        await DocumentoFiscal.create({ // eslint-disable-line no-await-in-loop
          clienteAsesoria: doc._id,
          tipo: "recibida",
          fecha: fechaAleatoria(t),
          numero: `${isoCorta(fechaAleatoria(t)).slice(2, 7).replace("-", "")}-${aleatorio(1000, 9999)}`,
          tercero: prov.nombre,
          nifTercero: nifEmpresa(),
          base,
          tipoIva: prov.tipo,
          cuotaIva: cuota,
          total: redondear(base + cuota),
          origen: "ocr",
          estado: t === TRIMESTRE_ACTUAL && Math.random() < 0.35 ? "pendiente" : "revisado",
        });
      }
      for (let i = 0; i < nGastos; i++) {
        const comercio = elegir(COMERCIOS_TICKET);
        const total = redondear(aleatorio(15, 180) + Math.random());
        const base = redondear(total / 1.21);
        await DocumentoFiscal.create({ // eslint-disable-line no-await-in-loop
          clienteAsesoria: doc._id,
          tipo: "gasto",
          fecha: fechaAleatoria(t),
          tercero: comercio.nombre,
          base,
          tipoIva: 21,
          cuotaIva: redondear(total - base),
          total,
          origen: "ocr",
          estado: "revisado",
        });
      }
      totalManuales += nEmitidas + nRecibidas + nGastos;
    }
  }
});
console.log(`Documentos creados: ${totalImportados} importados + ${totalManuales} de cartera`);

// ------------------------------------------- solicitudes y cierres ---

const DESCRIPCIONES_PENDIENTE = [
  "Factura del alquiler del local",
  "Tickets de gasoil del trimestre",
  "Facturas de compra de mercancía",
  "Justificante del seguro del vehículo",
  "Factura de la reparación de maquinaria",
  "Nóminas y seguros sociales del mes pasado",
];

await conContexto(ctxGasen, async () => {
  let nSolicitudes = 0;
  for (const { doc } of clientesCartera) {
    // Una o dos solicitudes pendientes del trimestre en curso.
    const n = aleatorio(1, 2);
    for (let i = 0; i < n; i++) {
      await SolicitudDocumento.create({ // eslint-disable-line no-await-in-loop
        clienteAsesoria: doc._id,
        descripcion: elegir(DESCRIPCIONES_PENDIENTE),
        periodo: `${TRIMESTRE_ACTUAL}T ${ANO}`,
        estado: Math.random() < 0.75 ? "pendiente" : "recibida",
      });
      nSolicitudes += 1;
    }
    // Cierres de trimestres pasados y del actual.
    for (let t = 1; t <= TRIMESTRE_ACTUAL; t++) {
      let estado;
      let presentadoEn;
      if (t < TRIMESTRE_ACTUAL) {
        estado = Math.random() < 0.8 ? "presentado" : "listo";
        presentadoEn = estado === "presentado" ? new Date(ANO, t * 3, aleatorio(5, 19)) : undefined;
      } else {
        estado = elegir(["pendiente_docs", "pendiente_docs", "en_revision"]);
      }
      await CierreTrimestral.create({ // eslint-disable-line no-await-in-loop
        clienteAsesoria: doc._id,
        ano: ANO,
        trimestre: t,
        estado,
        presentadoEn,
        notas: estado === "presentado" ? "303 presentado telemáticamente" : "",
      });
    }
  }
  console.log(`Solicitudes: ${nSolicitudes} · Cierres: ${clientesCartera.length * TRIMESTRE_ACTUAL}`);
});

console.log("\nGasen listo para la demo:");
console.log("  Usuario:     demo@gasen.es");
console.log("  Contraseña:  Demo@2026");
console.log(`  Código:      ${codigoGasen}`);
console.log(`  Clientes:    ${clientesCartera.length + vinculosCreados.length} en cartera (${vinculosCreados.length} conectados por FILANEX)`);
console.log(`  Documentos:  ${totalImportados + totalManuales}`);

await mongoose.disconnect();
