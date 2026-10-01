/* Cambia la fecha de expedición de una factura YA EMITIDA cuyo registro
   VeriFactu todavía no se ha remitido a la AEAT (estado "no_remitido"):
   - factura.fechaExpedicion (y vencimiento/plazos si quedarían anteriores),
   - el QR de la factura,
   - el registro de facturación (fecha y, si ningún registro posterior cuelga
     de su huella, huella y XML recalculados).

   Uso:
     node scripts/arreglar-fecha-factura.mjs <serieNumero> <AAAA-MM-DD> [--aplicar]
   Ejemplo:
     node scripts/arreglar-fecha-factura.mjs 3-2026-34 2026-10-01 --aplicar
   Sin --aplicar solo muestra el estado actual (simulación).
*/
import mongoose from "mongoose";
import "dotenv/config";

const [serieNumero, fechaArg, aplicar] = process.argv.slice(2);
if (!serieNumero || !fechaArg || !/^\d{4}-\d{2}-\d{2}$/.test(fechaArg)) {
  console.error("Uso: node scripts/arreglar-fecha-factura.mjs <serieNumero> <AAAA-MM-DD> [--aplicar]");
  process.exit(1);
}
const NUEVA_FECHA = new Date(`${fechaArg}T12:00:00`); // mediodía local: sin sustos de huso
const uriBase = process.env.MONGODB_URI_BASE || "mongodb://127.0.0.1:27017";

const { default: FacturaVenta } = await import("../src/models/FacturaVenta.js");
const { default: RegistroFacturacion } = await import("../src/models/RegistroFacturacion.js");
const { default: Empresa } = await import("../src/models/Empresa.js");
const { huellaAlta, contenidoQr, xmlRegistroAlta, sobreSoap, fechaDDMMYYYY, timestampRegistro } =
  await import("../src/services/verifactu.js");

// Descubre las bases de datos de empresa (excluye plataforma y copias).
const admin = await mongoose.createConnection(`${uriBase}/admin`).asPromise();
const { databases } = await admin.db.admin().listDatabases();
await admin.close();
const dbs = databases
  .map((d) => d.name)
  .filter((n) => n.startsWith("filanex_") && n !== "filanex_plataforma" && !n.includes("restore") && !n.includes("backup"));

let encontradas = 0;
for (const dbName of dbs) {
  await mongoose.connect(`${uriBase}/${dbName}`);
  const factura = await FacturaVenta.findOne({ serieNumero });
  if (!factura) {
    await mongoose.disconnect();
    continue;
  }
  encontradas++;
  const registro = await RegistroFacturacion.findOne({ facturaVenta: factura._id });
  const empresa = (await Empresa.findById(factura.empresa)) ?? (await Empresa.findOne());
  const posteriores = registro
    ? await RegistroFacturacion.countDocuments({ huellaAnterior: registro.huella })
    : 0;

  console.log(`\n=== ${dbName} ===`);
  console.log(`factura ${serieNumero} · estado ${factura.estado} · total ${factura.total} €`);
  console.log(`fecha actual: ${fechaDDMMYYYY(factura.fechaExpedicion)} → nueva: ${fechaDDMMYYYY(NUEVA_FECHA)}`);
  console.log(`vencimiento: ${factura.vencimiento ? fechaDDMMYYYY(factura.vencimiento) : "—"}`);
  console.log(`registro VeriFactu: ${registro ? `${registro.tipo} · envío ${registro.estadoEnvio}` : "NO EXISTE"}`);
  console.log(`registros que cuelgan de su huella: ${posteriores}`);

  if (!registro || registro.estadoEnvio !== "no_remitido") {
    console.log("PARA: el registro ya está remitido o pendiente de envío a la AEAT; no se puede tocar.");
    await mongoose.disconnect();
    continue;
  }
  if (!aplicar) {
    console.log("(simulación: vuelve a lanzar con --aplicar para cambiar la fecha)");
    await mongoose.disconnect();
    continue;
  }

  // 1) Fecha de expedición (y vencimiento/plazos si quedarían anteriores).
  const delta = NUEVA_FECHA.getTime() - new Date(factura.fechaExpedicion).getTime();
  factura.fechaExpedicion = NUEVA_FECHA;
  if (factura.vencimiento && new Date(factura.vencimiento).getTime() < NUEVA_FECHA.getTime()) {
    factura.vencimiento = new Date(new Date(factura.vencimiento).getTime() + delta);
    console.log(`vencimiento movido a ${fechaDDMMYYYY(factura.vencimiento)} (quedaría anterior a la factura)`);
  }
  for (const plazo of factura.plazos ?? []) {
    if (new Date(plazo.fecha).getTime() < NUEVA_FECHA.getTime()) {
      plazo.fecha = new Date(new Date(plazo.fecha).getTime() + delta);
    }
  }

  const fechaNuevaTxt = fechaDDMMYYYY(NUEVA_FECHA);

  // 2) QR de la factura (visible para el cliente).
  factura.verifactu.qrContenido = contenidoQr({
    nif: empresa.nif,
    numSerie: factura.serieNumero,
    fechaExpedicion: fechaNuevaTxt,
    total: factura.total,
  });

  // 3) Registro de facturación. Si ningún registro posterior encadena desde
  //    esta huella, se recalcula huella y XML limpios; si hay posteriores, se
  //    conserva la huella (la cadena manda) y solo se corrige la fecha.
  registro.fechaExpedicionFactura = fechaNuevaTxt;
  if (posteriores === 0) {
    const fechaHoraGen = timestampRegistro();
    const huella = huellaAlta({
      nifEmisor: empresa.nif,
      numSerie: registro.numSerieFactura,
      fechaExpedicion: fechaNuevaTxt,
      tipoFactura: "F1",
      cuotaTotal: factura.cuotaIva,
      importeTotal: factura.total,
      huellaAnterior: registro.huellaAnterior,
      fechaHoraGen,
    });
    const anterior = await RegistroFacturacion.findOne({
      empresa: empresa._id,
      _id: { $lt: registro._id },
    }).sort({ _id: -1 });
    const registroAnterior = anterior
      ? { emisor: empresa.nif, numSerie: anterior.numSerieFactura, fecha: anterior.fechaExpedicionFactura, huella: anterior.huella }
      : null;
    registro.huella = huella;
    registro.xml = sobreSoap(
      empresa,
      xmlRegistroAlta({
        empresa,
        factura: { ...factura.toObject(), serieNumero: factura.serieNumero, descripcion: factura.descripcion },
        huella,
        fechaHoraGen,
        registroAnterior,
      })
    );
    factura.verifactu.huella = huella;
    console.log("huella y XML del registro recalculados con la nueva fecha");
  } else {
    console.log("AVISO: hay registros posteriores encadenados; se conserva la huella y solo se corrige la fecha");
  }

  await registro.save();
  await factura.save();
  console.log(`APLICADO: ${serieNumero} con fecha ${fechaNuevaTxt} en ${dbName}`);
  await mongoose.disconnect();
}
await mongoose.disconnect();

if (encontradas === 0) {
  console.log(`No se ha encontrado ninguna factura ${serieNumero} en ${dbs.length} empresas`);
  process.exit(1);
}
