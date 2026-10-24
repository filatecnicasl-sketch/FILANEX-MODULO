// Genera un informe completo de todas las conciliaciones del extracto bancario y lo guarda en /tmp.
import mongoose from "mongoose";
import { writeFileSync } from "fs";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/filanex_local");
const db = mongoose.connection.db;

const movimientos = await db.collection("movimientobancarios")
  .find({ "conciliadoCon.id": { $exists: true, $ne: null } })
  .sort({ fecha: 1 })
  .toArray();

let totalCargos = 0;
let totalIngresos = 0;
let lineas = [];
lineas.push(`INFORME DE CONCILIACIONES BANCARIAS - filanex_local`);
lineas.push(`Generado: ${new Date().toLocaleString("es-ES")}`);
lineas.push(`Total de conciliaciones: ${movimientos.length}\n`);
lineas.push("FECHA       | IMPORTE     | CONCEPTO                              | TIPO           | DOCUMENTO");
lineas.push("------------|-------------|---------------------------------------|----------------|----------------------------------------------");

for (const m of movimientos) {
  const tipo = m.conciliadoCon?.tipo || "desconocido";
  let docTexto = "";

  if (tipo === "factura_compra") {
    const doc = await db.collection("facturacompras").findOne({ _id: m.conciliadoCon.id });
    const proveedor = doc ? await db.collection("proveedors").findOne({ _id: doc.proveedor }) : null;
    docTexto = doc
      ? `Factura compra ${doc.numeroFacturaProveedor || "s/n"} - ${proveedor?.nombre || "?"} - ${doc.total?.toFixed(2)} €`
      : "Factura compra no encontrada";
  } else if (tipo === "factura_venta") {
    const doc = await db.collection("facturaventas").findOne({ _id: m.conciliadoCon.id });
    const cliente = doc ? await db.collection("clientes").findOne({ _id: doc.cliente }) : null;
    docTexto = doc
      ? `Factura venta ${doc.serieNumero || "s/n"} - ${cliente?.nombre || "?"} - ${doc.total?.toFixed(2)} €`
      : "Factura venta no encontrada";
  } else if (tipo === "facturas_venta") {
    docTexto = `Varias facturas de venta agrupadas (${m.conciliadoCon.ids?.length || "?"} facturas)`;
  } else {
    docTexto = `${tipo} (${m.conciliadoCon.id})`;
  }

  const fecha = m.fecha ? new Date(m.fecha).toISOString().slice(0, 10) : "????-??-??";
  const importe = m.importe.toFixed(2).padStart(11);
  const concepto = (m.concepto || "").slice(0, 40).padEnd(40);
  const tipoFmt = tipo.padEnd(15);

  lineas.push(`${fecha} | ${importe} € | ${concepto} | ${tipoFmt} | ${docTexto}`);

  if (m.importe < 0) totalCargos += Math.abs(m.importe);
  else totalIngresos += m.importe;
}

lineas.push("");
lineas.push(`TOTAL CARGOS CONCILIADOS:   ${totalCargos.toFixed(2)} €`);
lineas.push(`TOTAL INGRESOS CONCILIADOS: ${totalIngresos.toFixed(2)} €`);
lineas.push(`TOTAL MOVIMIENTOS:          ${(totalIngresos + totalCargos).toFixed(2)} €`);

const contenido = lineas.join("\n");
writeFileSync("/tmp/informe-conciliaciones.txt", contenido);
console.log("Informe guardado en /tmp/informe-conciliaciones.txt");
console.log(contenido);

await mongoose.disconnect();
