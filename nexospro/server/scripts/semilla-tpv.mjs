/**
 * Semilla demo del módulo TPV: artículos de tienda, caja abierta y tickets
 * de hoy con VeriFactu (F2). Se ejecuta una sola vez por entorno.
 *
 * Uso: node scripts/semilla-tpv.mjs [slugTenant]
 * Por defecto: demo
 */
import mongoose from "mongoose";
import "dotenv/config";
import { connectDB } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";
import Cuenta from "../src/models/plataforma/Cuenta.js";
import { conContexto, modeloTenant, conexionTenant } from "../src/models/tenant.js";
import { tomarNumeroFacturaVentaAtomico } from "../src/services/numeracion.js";
import { calcularTotales, limpiarLineas } from "../src/services/totales.js";
import {
  huellaAlta,
  contenidoQr,
  xmlRegistroAlta,
  sobreSoap,
  remitirAeat,
  fechaDDMMYYYY,
  timestampRegistro,
} from "../src/services/verifactu.js";
import { certificadoActual } from "../src/services/certificadoEmpresa.js";
// Importar los modelos registra sus esquemas en las conexiones tenant.
import "../src/models/Empresa.js";
import "../src/models/Articulo.js";
import "../src/models/Cliente.js";
import "../src/models/FacturaVenta.js";
import "../src/models/CajaSesion.js";
import "../src/models/RegistroFacturacion.js";
import "../src/models/Usuario.js";

const slug = process.argv[2] || "demo";

const ARTICULOS = [
  { codigo: "AGUA", descripcion: "Agua mineral 1,5 L", precioVenta: 0.90, iva: 10 },
  { codigo: "COCA", descripcion: "Coca-Cola 33 cl", precioVenta: 1.50, iva: 21 },
  { codigo: "CAFE", descripcion: "Café solo", precioVenta: 1.20, iva: 10 },
  { codigo: "CROI", descripcion: "Croissant", precioVenta: 1.40, iva: 10 },
  { codigo: "PAN", descripcion: "Barra de pan", precioVenta: 0.80, iva: 4 },
  { codigo: "LECHE", descripcion: "Leche entera 1 L", precioVenta: 1.10, iva: 4 },
  { codigo: "HUEV", descripcion: "Docena de huevos", precioVenta: 2.60, iva: 4 },
  { codigo: "QUES", descripcion: "Queso semicurado 250 g", precioVenta: 3.90, iva: 4 },
  { codigo: "JAMON", descripcion: "Jamón serrano 100 g", precioVenta: 2.80, iva: 10 },
  { codigo: "VINO", descripcion: "Vino tinto crianza", precioVenta: 6.50, iva: 21 },
  { codigo: "CERV", descripcion: "Cerveza lata 33 cl", precioVenta: 1.10, iva: 21 },
  { codigo: "CHOC", descripcion: "Chocolate con leche 100 g", precioVenta: 1.60, iva: 10 },
  { codigo: "PATA", descripcion: "Patatas fritas 150 g", precioVenta: 1.30, iva: 10 },
  { codigo: "GALL", descripcion: "Galletas maría 400 g", precioVenta: 1.50, iva: 10 },
  { codigo: "ARRO", descripcion: "Arroz redondo 1 kg", precioVenta: 1.80, iva: 4 },
];

async function main() {
  await connectDB();
  const tenant = await Tenant.findOne({ slug }).lean();
  if (!tenant) throw new Error(`No existe el tenant "${slug}"`);

  await conContexto({ conn: conexionTenant(tenant.dbName), slug: tenant.slug, dbName: tenant.dbName }, async () => {
    const Empresa = modeloTenant("Empresa");
    const Articulo = modeloTenant("Articulo");
    const Cliente = modeloTenant("Cliente");
    const FacturaVenta = modeloTenant("FacturaVenta");
    const CajaSesion = modeloTenant("CajaSesion");
    const RegistroFacturacion = modeloTenant("RegistroFacturacion");
    const Usuario = modeloTenant("Usuario");

    // Activar módulo tpv si no está
    const empresa = await Empresa.findOne();
    if (!empresa) throw new Error("No hay empresa en el tenant");
    if (!(empresa.modulos ?? []).includes("tpv")) {
      empresa.modulos = [...(empresa.modulos ?? []), "tpv"];
      await empresa.save();
      console.log("Módulo TPV activado en la empresa");
    }

    // Serie T en seriesVenta
    if (!(empresa.seriesVenta ?? []).some((s) => s.nombre === "T")) {
      empresa.seriesVenta = [...(empresa.seriesVenta ?? []), { nombre: "T", defecto: false }];
      await empresa.save();
      console.log("Serie T creada");
    }

    // Cliente mostrador
    let mostrador = await Cliente.findOne({ mostrador: true });
    if (!mostrador) {
      mostrador = await Cliente.create({
        nombre: "Consumidor final",
        nif: "MOSTRADOR",
        mostrador: true,
      });
      console.log("Cliente mostrador creado");
    }

    // Usuario para apertura/cobros (las cuentas viven en la BD plataforma)
    const cuenta = await Cuenta.findOne({ tenant: tenant._id, rol: "admin" }).lean()
      ?? await Cuenta.findOne({ tenant: tenant._id }).lean();
    const usuarioEmail = cuenta?.email ?? "demo@filanex.local";

    // Artículos
    const existentes = await Articulo.countDocuments({ codigo: { $in: ARTICULOS.map((a) => a.codigo) } });
    if (existentes === 0) {
      await Articulo.insertMany(
        ARTICULOS.map((a) => ({
          tipo: "articulo",
          codigo: a.codigo,
          descripcion: a.descripcion,
          unidad: "ud",
          precioCompra: +(a.precioVenta * 0.6).toFixed(2),
          precioVenta: a.precioVenta,
          iva: a.iva,
        }))
      );
      console.log(`${ARTICULOS.length} artículos creados`);
    } else {
      console.log("Artículos ya existen, se saltan");
    }

    // Caja abierta
    let caja = await CajaSesion.findOne({ estado: "abierta" });
    if (!caja) {
      caja = await CajaSesion.create({
        apertura: { fecha: new Date(), fondo: 100, usuario: usuarioEmail },
        estado: "abierta",
      });
      console.log("Caja abierta con fondo 100 €");
    } else {
      console.log("Ya hay una caja abierta");
    }

    // Tickets de hoy (8-10)
    const hayTickets = await FacturaVenta.countDocuments({ tipoFactura: "F2" });
    if (hayTickets >= 8) {
      console.log("Ya hay tickets TPV, se saltan");
    } else {
      const articulos = await Articulo.find({ codigo: { $in: ARTICULOS.map((a) => a.codigo) } }).lean();
      const porCodigo = Object.fromEntries(articulos.map((a) => [a.codigo, a]));
      const metodos = ["efectivo", "tarjeta", "efectivo", "tarjeta", "efectivo", "otro", "efectivo", "tarjeta", "efectivo", "tarjeta"];
      const ventas = [
        [{ codigo: "CAFE", cantidad: 2 }, { codigo: "CROI", cantidad: 1 }],
        [{ codigo: "AGUA", cantidad: 1 }, { codigo: "COCA", cantidad: 1 }],
        [{ codigo: "PAN", cantidad: 2 }, { codigo: "LECHE", cantidad: 1 }],
        [{ codigo: "HUEV", cantidad: 1 }, { codigo: "QUES", cantidad: 1 }],
        [{ codigo: "VINO", cantidad: 1 }],
        [{ codigo: "CERV", cantidad: 6 }],
        [{ codigo: "CHOC", cantidad: 2 }, { codigo: "PATA", cantidad: 1 }],
        [{ codigo: "JAMON", cantidad: 2 }, { codigo: "PAN", cantidad: 1 }],
        [{ codigo: "ARRO", cantidad: 1 }, { codigo: "GALL", cantidad: 1 }],
        [{ codigo: "CAFE", cantidad: 1 }],
      ];

      const empresaDoc = await Empresa.findOne();
      const cert = await certificadoActual();
      const ahora = new Date();

      for (let i = 0; i < ventas.length; i++) {
        const lineas = ventas[i].map((v) => {
          const a = porCodigo[v.codigo];
          return {
            articulo: a._id,
            descripcion: a.descripcion,
            cantidad: v.cantidad,
            precioUnitario: a.precioVenta,
            iva: a.iva,
            descuento: 0,
          };
        });
        const totales = calcularTotales(limpiarLineas(lineas));
        const fecha = new Date(ahora);
        fecha.setHours(9 + i, 15 + (i * 7) % 60, 0, 0);

        // Mismo flujo que POST /api/tpv/cobrar (numeración atómica, huella
        // encadenada, registro VeriFactu y QR). El script es secuencial, así
        // que la cadena queda íntegra sin necesidad de la cola HTTP.
        const numero = await tomarNumeroFacturaVentaAtomico(empresaDoc, { serieNombre: "T" });
        const fechaExpedicion = fechaDDMMYYYY(fecha);
        const fechaHoraGen = timestampRegistro();

        const ultimo = await RegistroFacturacion.findOne({ empresa: empresaDoc._id }).sort({ _id: -1 }); // eslint-disable-line no-await-in-loop
        const huellaAnterior = ultimo?.huella ?? "";

        const huella = huellaAlta({
          nifEmisor: empresaDoc.nif,
          numSerie: numero.serieNumero,
          fechaExpedicion,
          tipoFactura: "F2",
          cuotaTotal: totales.cuotaIva,
          importeTotal: totales.total,
          huellaAnterior,
          fechaHoraGen,
        });

        const registroAnterior = ultimo
          ? { emisor: empresaDoc.nif, numSerie: ultimo.numSerieFactura, fecha: ultimo.fechaExpedicionFactura, huella: ultimo.huella }
          : null;

        const xmlRegistro = xmlRegistroAlta({
          empresa: empresaDoc,
          factura: {
            serieNumero: numero.serieNumero,
            fechaExpedicion: fecha,
            lineas: limpiarLineas(lineas),
            cuotaIva: totales.cuotaIva,
            total: totales.total,
            descripcion: "Ticket de venta TPV",
          },
          huella,
          fechaHoraGen,
          registroAnterior,
          tipoFactura: "F2",
        });
        const xml = sobreSoap(empresaDoc, xmlRegistro);

        const factura = await FacturaVenta.create({
          empresa: empresaDoc._id,
          cliente: mostrador._id,
          tipoFactura: "F2",
          serie: numero.serie,
          numero: numero.numero,
          serieNumero: numero.serieNumero,
          fechaExpedicion: fecha,
          lineas: limpiarLineas(lineas),
          baseImponible: totales.baseImponible,
          cuotaIva: totales.cuotaIva,
          total: totales.total,
          estado: "emitida",
          descripcion: "Ticket de venta TPV",
          cobros: [{ importe: totales.total, fecha, metodo: metodos[i] }],
          cajaSesion: caja._id,
          verifactu: {
            huella,
            huellaAnterior,
            qrContenido: contenidoQr({
              nif: empresaDoc.nif,
              numSerie: numero.serieNumero,
              fechaExpedicion,
              total: totales.total,
            }),
            enviada: false,
            estadoEnvio: "pendiente",
            fechaRegistro: new Date(),
          },
        });

        const registro = await RegistroFacturacion.create({
          empresa: empresaDoc._id,
          facturaVenta: factura._id,
          tipo: "alta",
          numSerieFactura: numero.serieNumero,
          fechaExpedicionFactura: fechaExpedicion,
          huella,
          huellaAnterior,
          xml,
        });

        // Envío AEAT en segundo plano (igual que facturas normales)
        if (cert) {
          remitirAeat(xml, cert)
            .then(async (resp) => {
              const aceptado = /EstadoEnvio>Correcto</.test(resp.cuerpo);
              const conErrores = /AceptadoConErrores/.test(resp.cuerpo);
              registro.estadoEnvio = aceptado ? "aceptado" : conErrores ? "aceptado_con_errores" : "rechazado";
              registro.respuestaAeat = { httpStatus: resp.httpStatus, cuerpo: resp.cuerpo.slice(0, 4000) };
              await registro.save();
            })
            .catch(async (err) => {
              registro.respuestaAeat = { error: String(err.message || err) };
              await registro.save().catch(() => {});
            });
        }

        console.log(`Ticket ${numero.serieNumero} · ${euros(totales.total)} · ${metodos[i]}`);
      }
      console.log("Tickets creados");
    }
  });

  await mongoose.disconnect();
  console.log("Semilla TPV terminada");
}

function euros(n) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n ?? 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
