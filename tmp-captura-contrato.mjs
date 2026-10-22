import mongoose from "mongoose";
import fs from "node:fs";
import { formatoToHtml } from "./src/services/formatoToHtml.js";
import { chromium } from "playwright";

// Réplica del mapeo de imprimir-cortesia.js (cliente) con un préstamo REAL
const conn = await mongoose.createConnection("mongodb://localhost:27017/filanex_montiel").asPromise();
const plantilla = await conn.db.collection("formatos").findOne({ tipoDocumento: "contrato-cortesia", porDefecto: true });
const p = await conn.db.collection("prestamocortesias").findOne({}, { sort: { createdAt: -1 } });
const vehiculo = p?.vehiculo ? await conn.db.collection("vehiculos").findOne({ _id: p.vehiculo }) : null;
if (p && vehiculo) p.vehiculo = vehiculo;
const emp = await conn.db.collection("empresas").findOne({});
await conn.close();
if (!p) throw new Error("No hay préstamos");
if (process.argv[2] != null) p.combustibleSalida = Number(process.argv[2]);

const fechaEs = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "");
const horaEs = (f) => (f ? new Date(f).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "");
const n = (v) => (v != null && v !== "" ? Number(v).toLocaleString("es-ES") : "");
const eur = (v) => (v == null || v === "" ? "" : Number(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const dirTexto = (d) => [d?.calle, d?.cp, d?.ciudad, d?.provincia].filter(Boolean).join(", ");

const nombrePartes = String(p.clienteNombre || "").trim().split(/\s+/);
const formData = {
  "empresa.nombre": emp.nombre || "",
  "empresa.direccion": dirTexto(emp.direccion),
  "empresa.telefono": emp.telefono || "",
  "prestamo.numero": p.numeroOrden ? `OT ${p.numeroOrden}` : String(p._id || "").slice(-6).toUpperCase(),
  "cliente.apellidos": nombrePartes.slice(1).join(" ") || "",
  "cliente.nombre": nombrePartes[0] || "",
  "cliente.fechaNacimiento": fechaEs(p.clienteFechaNacimiento),
  "cliente.lugarNacimiento": p.clienteLugarNacimiento || "",
  "cliente.direccion": p.clienteDireccion || "",
  "cliente.telefono": p.telefono || "",
  "cliente.movil": p.telefono || "",
  "cliente.telefonoTrabajo": p.telefonoTrabajo || "",
  "cliente.permisoNumero": p.permisoConducirNumero || "",
  "cliente.permisoExpedicion": fechaEs(p.permisoConducirExpedicion),
  "cliente.permisoLugar": p.permisoConducirLugar || "",
  "cliente.otrosConductores": p.otroConductor || "",
  "vehiculo.marca": p.vehiculo?.marca || "",
  "vehiculo.modelo": p.vehiculo?.modelo || "",
  "vehiculo.matricula": p.matricula || "",
  "vehiculo.vin": p.vinCortesia || "",
  "vehiculo.forfaitDiaria": eur(p.participacionForfaitDiaria),
  "vehiculo.observaciones": p.notas || "",
  "seguro.asegurador": p.aseguradora || "",
  "seguro.numeroContrato": p.numeroContratoSeguro || "",
  "seguro.franquiciaTerceros": eur(p.franquiciaTerceros),
  "seguro.franquiciaVehiculo": eur(p.franquiciaVehiculo),
  "seguro.franquiciaRobo": eur(p.franquiciaRobo),
  "seguro.rescateSi": Boolean(p.rescateFranquicia),
  "seguro.rescateNo": !p.rescateFranquicia,
  "seguro.transferenciaSi": Boolean(p.transferenciaSeguro),
  "seguro.transferenciaNo": !p.transferenciaSeguro,
  "seguro.rescatePorDia": eur(p.rescatePorDia),
  "reparacion.modelo": p.vehiculoReparacionMarcaModelo || "",
  "reparacion.matricula": p.vehiculoReparacionMatricula || "",
  "reparacion.vin": p.vehiculoReparacionVIN || "",
  "reparacion.numeroOrden": p.numeroOrden || "",
  "reparacion.entregaPrevista": fechaEs(p.fechaPrevista),
};

const tabla = plantilla.elements.find((e) => e.type === "table");
if (tabla) {
  const nivelCombustible = Number(p.combustibleSalida);
  const combustibleVisual =
    p.combustibleSalida != null && p.combustibleSalida !== "" &&
    Number.isInteger(nivelCombustible) && nivelCombustible >= 0 && nivelCombustible <= 8
      ? `${"■".repeat(nivelCombustible)}${"□".repeat(8 - nivelCombustible)} ${nivelCombustible}/8`
      : "No indicado";
  const celdas = [
    ["Fecha y hora:", `${fechaEs(p.fechaSalida)} ${horaEs(p.fechaSalida)}`, fechaEs(p.fechaPrevista), ""],
    ["Km. En el contador:", n(p.kmSalida), "", ""],
    ["Nivel de carburante:", combustibleVisual, "", ""],
  ];
  celdas.forEach((fila, r) => fila.forEach((valor, c) => { formData[`tbl_${tabla.id}_${r}_${c}`] = valor; }));
}

let logoUrl = emp?.logoUrl ?? "";
if (logoUrl.startsWith("/")) logoUrl = "http://localhost:4700" + logoUrl;

const { html, css } = formatoToHtml(plantilla, formData, {}, { logoUrl });
const src = fs.readFileSync(new URL("./src/services/pdfRenderer.js", import.meta.url), "utf8");
const script = src.match(/<script>([\s\S]*?)<\/script>/)[1];
const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; color: #111; background: #fff; }
  ${css}
</style></head><body>${html}<script>${script}</script></body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await page.setContent(fullHtml, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/contrato-cortesia.png", fullPage: true });
await browser.close();
console.log("captura guardada - préstamo de", p.clienteNombre, "| combustible:", p.combustibleSalida);
