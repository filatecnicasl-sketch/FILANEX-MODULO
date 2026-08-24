import mongoose from "mongoose";
import "dotenv/config";
import { conexionTenant, conContexto } from "../src/models/tenant.js";
import { uriBase, nombreBdPlataforma, prefijoBd } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";
import Cuenta from "../src/models/plataforma/Cuenta.js";
import { crearTenant } from "../src/services/tenant.js";

// Modelos de negocio (se resolverán contra el contexto de demo).
import Cliente from "../src/models/Cliente.js";
import Proveedor from "../src/models/Proveedor.js";
import Articulo from "../src/models/Articulo.js";
import FacturaVenta from "../src/models/FacturaVenta.js";
import FacturaCompra from "../src/models/FacturaCompra.js";
import Presupuesto from "../src/models/Presupuesto.js";
import PedidoCompra from "../src/models/PedidoCompra.js";
import AlbaranVenta from "../src/models/AlbaranVenta.js";
import AlbaranCompra from "../src/models/AlbaranCompra.js";
import Vehiculo from "../src/models/Vehiculo.js";
import OrdenTrabajo from "../src/models/OrdenTrabajo.js";
import Cita from "../src/models/Cita.js";
import Valoracion from "../src/models/Valoracion.js";
import Aseguradora from "../src/models/Aseguradora.js";
import Operario from "../src/models/Operario.js";
import Gasto from "../src/models/Gasto.js";
import Aparato from "../src/models/Aparato.js";
import OrdenServicio from "../src/models/OrdenServicio.js";
import PrestamoCortesia from "../src/models/PrestamoCortesia.js";
import PresupuestoCompra from "../src/models/PresupuestoCompra.js";
import Llamada from "../src/models/Llamada.js";
import Recurrencia from "../src/models/Recurrencia.js";
import Remesa from "../src/models/Remesa.js";
import Empresa from "../src/models/Empresa.js";

const SLUG_DEMO_ADMIN = "demo";
const DB_DEMO_ADMIN = `${prefijoBd()}${SLUG_DEMO_ADMIN}`;
const EMAIL_DEMO_ADMIN = "demo@filanex.local";

const SLUG_DEMO_LIMITADO = "demo-limitado";
const DB_DEMO_LIMITADO = `${prefijoBd()}${SLUG_DEMO_LIMITADO}`;
const EMAIL_DEMO_LIMITADO = "demolimitado@filanex.local";

const PASS_DEMO = "Demo1234!";

async function conectar() {
  const base = uriBase();
  await mongoose.connect(`${base}/${nombreBdPlataforma()}`);
  console.log("Conectado a plataforma:", nombreBdPlataforma());
}

async function borrarLocal() {
  const local = await Tenant.findOne({ slug: "local" });
  if (local) {
    await Cuenta.deleteMany({ tenant: local._id });
    await Tenant.deleteOne({ _id: local._id });
    console.log("Tenant 'local' y su cuenta eliminados.");
  } else {
    console.log("No existía tenant 'local'.");
  }
  try {
    await mongoose.connection.useDb("nexospro").dropDatabase();
    console.log("Base de datos nexospro eliminada.");
  } catch (e) {
    console.log("No se pudo eliminar nexospro:", e.message);
  }
}

async function crearDemoUnico({ slug, dbName, nombre, email, adminNombre, rol }) {
  const existe = await Tenant.findOne({ slug });
  if (existe) {
    await Cuenta.deleteMany({ tenant: existe._id });
    await Tenant.deleteOne({ _id: existe._id });
    try {
      await mongoose.connection.useDb(dbName).dropDatabase();
      console.log(`Base de datos ${dbName} anterior eliminada.`);
    } catch (e) {
      console.log(`No se pudo eliminar ${dbName}:`, e.message);
    }
  }
  const tenant = await crearTenant({
    slug,
    nombre,
    email,
    password: PASS_DEMO,
    adminNombre,
    rol,
  });
  tenant.estado = "demo";
  tenant.plan = "empresarial";
  tenant.limiteUsuarios = 999;
  tenant.limiteFacturasMes = 99999;
  tenant.limiteAlmacenamientoMB = 51200;
  await tenant.save();
  console.log(`Tenant ${slug} creado:`, tenant.dbName, "- rol:", rol);
  return tenant;
}

async function crearDemos() {
  const admin = await crearDemoUnico({
    slug: SLUG_DEMO_ADMIN,
    dbName: DB_DEMO_ADMIN,
    nombre: "Empresa Demo S.L.",
    email: EMAIL_DEMO_ADMIN,
    adminNombre: "Administrador Demo",
    rol: "admin",
  });
  const limitado = await crearDemoUnico({
    slug: SLUG_DEMO_LIMITADO,
    dbName: DB_DEMO_LIMITADO,
    nombre: "Demo Limitada S.L.",
    email: EMAIL_DEMO_LIMITADO,
    adminNombre: "Usuario Demo Limitado",
    rol: "usuario",
  });
  return { admin, limitado };
}

function ctx(tenant) {
  return {
    conn: conexionTenant(tenant.dbName),
    slug: tenant.slug,
    dbName: tenant.dbName,
  };
}

async function seedDemo(tenant) {
  await conContexto(ctx(tenant), async () => {
    // Empresa maestra
    const empresa = await Empresa.create({
      nombre: "Empresa Demo S.L.",
      nif: "B12345678",
      direccion: { calle: "Calle Demo 123", cp: "28001", ciudad: "Madrid", provincia: "Madrid" },
      telefono: "910000000",
      email: "info@empresademo.es",
    });

    // Clientes
    const clientes = [];
    for (let i = 1; i <= 15; i++) {
      clientes.push(await Cliente.create({
        empresa: empresa._id,
        codigo: `CLI-${String(i).padStart(3, "0")}`,
        nombre: `Cliente Demo ${i} S.L.`,
        nif: `B${10000000 + i}`,
        email: `cliente${i}@demo.es`,
        telefono: `600000${String(i).padStart(2, "0")}`,
        direccion: { calle: `Calle ${i}`, cp: "28001", ciudad: "Madrid", provincia: "Madrid" },
      }));
    }

    // Proveedores
    const proveedores = [];
    for (let i = 1; i <= 15; i++) {
      proveedores.push(await Proveedor.create({
        empresa: empresa._id,
        codigo: `PRO-${String(i).padStart(3, "0")}`,
        nombre: `Proveedor Demo ${i} S.A.`,
        nif: `A${20000000 + i}`,
        email: `proveedor${i}@demo.es`,
        telefono: `610000${String(i).padStart(2, "0")}`,
      }));
    }

    // Artículos y servicios
    const articulos = [];
    for (let i = 1; i <= 15; i++) {
      articulos.push(await Articulo.create({
        empresa: empresa._id,
        tipo: i <= 10 ? "articulo" : "servicio",
        codigo: `ART-${String(i).padStart(3, "0")}`,
        descripcion: i <= 10 ? `Artículo demo ${i}` : `Servicio demo ${i}`,
        unidad: i <= 10 ? "ud" : "h",
        precioCompra: i * 5,
        precioVenta: i * 10,
        iva: 21,
        proveedor: proveedores[i % proveedores.length]._id,
      }));
    }

    // Facturas de venta (borradores)
    for (let i = 1; i <= 15; i++) {
      const base = i * 100;
      await FacturaVenta.create({
        empresa: empresa._id,
        serie: "A",
        numero: i,
        serieNumero: `A-${i}`,
        cliente: clientes[i % clientes.length]._id,
        estado: i % 3 === 0 ? "emitida" : "borrador",
        lineas: [{
          descripcion: `Línea factura venta ${i}`,
          cantidad: 1,
          precioUnitario: base,
          iva: 21,
        }],
        baseImponible: base,
        cuotaIva: Math.round(base * 0.21 * 100) / 100,
        total: Math.round(base * 1.21 * 100) / 100,
        metodoPago: "Transferencia",
      });
    }

    // Facturas de compra
    for (let i = 1; i <= 15; i++) {
      await FacturaCompra.create({
        empresa: empresa._id,
        numero: `FC-${i}`,
        proveedor: proveedores[i % proveedores.length]._id,
        lineas: [{ descripcion: `Compra demo ${i}`, cantidad: 1, precioUnitario: i * 50, iva: 21 }],
        baseImponible: i * 50,
        cuotaIva: Math.round(i * 50 * 0.21 * 100) / 100,
        total: Math.round(i * 50 * 1.21 * 100) / 100,
        estado: ["pendiente_revision", "validada", "rechazada"][i % 3],
      });
    }

    // Presupuestos
    for (let i = 1; i <= 15; i++) {
      const base = i * 75;
      await Presupuesto.create({
        empresa: empresa._id,
        cliente: clientes[i % clientes.length]._id,
        numero: i,
        serieNumero: `P-${i}`,
        lineas: [{ descripcion: `Concepto presupuesto ${i}`, cantidad: 1, precioUnitario: base, iva: 21 }],
        baseImponible: base,
        cuotaIva: Math.round(base * 0.21 * 100) / 100,
        total: Math.round(base * 1.21 * 100) / 100,
        estado: ["borrador", "enviado", "aceptado", "rechazado"][i % 4],
      });
    }

    // Pedidos de compra
    for (let i = 1; i <= 15; i++) {
      await PedidoCompra.create({
        empresa: empresa._id,
        proveedor: proveedores[i % proveedores.length]._id,
        numero: `PED-${i}`,
        lineas: [{ descripcion: `Pedido demo ${i}`, cantidad: i, precioUnitario: 10, iva: 21 }],
        total: Math.round(i * 10 * 1.21 * 100) / 100,
        estado: i % 3 === 0 ? "recibido" : "borrador",
      });
    }

    // Albaranes de venta
    for (let i = 1; i <= 15; i++) {
      const base = i * 30;
      await AlbaranVenta.create({
        empresa: empresa._id,
        cliente: clientes[i % clientes.length]._id,
        numero: i,
        serieNumero: `AV-${i}`,
        lineas: [{ descripcion: `Entrega demo ${i}`, cantidad: 1, precioUnitario: base, iva: 21 }],
        baseImponible: base,
        cuotaIva: Math.round(base * 0.21 * 100) / 100,
        total: Math.round(base * 1.21 * 100) / 100,
      });
    }

    // Albaranes de compra
    for (let i = 1; i <= 15; i++) {
      await AlbaranCompra.create({
        empresa: empresa._id,
        proveedor: proveedores[i % proveedores.length]._id,
        numero: `AC-${i}`,
        lineas: [{ descripcion: `Recepción demo ${i}`, cantidad: 1, precioUnitario: i * 25, iva: 21 }],
        total: Math.round(i * 25 * 1.21 * 100) / 100,
      });
    }

    // Vehículos
    const vehiculos = [];
    const marcas = ["Seat", "Volkswagen", "Ford", "Renault", "Toyota", "Peugeot", "Citroën", "BMW", "Mercedes", "Audi"];
    for (let i = 1; i <= 15; i++) {
      vehiculos.push(await Vehiculo.create({
        matricula: `000${i} AAA`,
        marca: marcas[i % marcas.length],
        modelo: `Modelo ${i}`,
        color: ["Rojo", "Azul", "Blanco", "Negro", "Gris"][i % 5],
        cliente: clientes[i % clientes.length]._id,
        clienteNombre: clientes[i % clientes.length].nombre,
        km: i * 10000,
      }));
    }

    // Órdenes de trabajo
    for (let i = 1; i <= 15; i++) {
      await OrdenTrabajo.create({
        numero: `OT-${String(i).padStart(3, "0")}`,
        matricula: vehiculos[i % vehiculos.length].matricula,
        vehiculo: vehiculos[i % vehiculos.length]._id,
        cliente: clientes[i % clientes.length]._id,
        clienteNombre: clientes[i % clientes.length].nombre,
        motivo: `Revisión demo ${i}`,
        estado: ["recepcion", "en_curso", "finalizado", "entregado"][i % 4],
        lineas: [{ descripcion: `Trabajo demo ${i}`, cantidad: 1, precioUnitario: i * 40, iva: 21 }],
        total: Math.round(i * 40 * 1.21 * 100) / 100,
      });
    }

    // Citas
    const hoy = new Date();
    for (let i = 1; i <= 15; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() + (i - 8));
      await Cita.create({
        ambito: "taller",
        cliente: clientes[i % clientes.length]._id,
        clienteNombre: clientes[i % clientes.length].nombre,
        matricula: vehiculos[i % vehiculos.length].matricula,
        vehiculo: vehiculos[i % vehiculos.length]._id,
        motivo: `Cita demo ${i}`,
        fecha: new Date(fecha.setHours(0, 0, 0, 0)),
        hora: `${8 + (i % 10)}:00`,
        duracion: 60,
        estado: ["pendiente", "confirmada", "realizada"][i % 3],
      });
    }

    // Valoraciones
    for (let i = 1; i <= 15; i++) {
      await Valoracion.create({
        numero: `VAL-${String(i).padStart(3, "0")}`,
        clienteNombre: clientes[i % clientes.length].nombre,
        matricula: vehiculos[i % vehiculos.length].matricula,
        vehiculo: vehiculos[i % vehiculos.length]._id,
        compania: `Aseguradora demo ${(i % 5) + 1}`,
        numeroSiniestro: `SIN-${1000 + i}`,
        lineas: [{ descripcion: `Daño demo ${i}`, importe: i * 60 }],
        total: i * 60,
        estado: ["pendiente", "valorado", "aprobado", "rechazado"][i % 4],
      });
    }

    // Aseguradoras
    for (let i = 1; i <= 15; i++) {
      await Aseguradora.create({
        nombre: `Aseguradora Demo ${i}`,
        cif: `A${30000000 + i}`,
        telefono: `620000${String(i).padStart(2, "0")}`,
        email: `siniestros${i}@aseguradora.demo`,
      });
    }

    // Operarios
    for (let i = 1; i <= 15; i++) {
      await Operario.create({
        nombre: `Operario Demo ${i}`,
        especialidad: ["Chapa", "Pintura", "Mecánica", "Electrónica"][i % 4],
        costeHora: 15 + i,
      });
    }

    // Gastos
    for (let i = 1; i <= 15; i++) {
      const base = i * 20;
      await Gasto.create({
        fecha: new Date(),
        comercio: `Comercio Demo ${i}`,
        concepto: `Gasto demo ${i}`,
        categoria: ["combustible", "peaje_parking", "transporte", "material", "dietas", "atenciones", "suministros", "reparaciones", "alojamiento", "otros"][i % 10],
        base,
        tipoIva: 21,
        cuotaIva: Math.round(base * 0.21 * 100) / 100,
        total: Math.round(base * 1.21 * 100) / 100,
        pagadoCon: ["efectivo", "tarjeta_empresa", "tarjeta_personal", "transferencia"][i % 4],
      });
    }

    // Aparatos (telefonía/SAT)
    for (let i = 1; i <= 15; i++) {
      await Aparato.create({
        codigo: `AP-${String(i).padStart(3, "0")}`,
        tipo: ["pc_sobremesa", "portatil", "movil", "tablet", "monitor", "impresora", "otro"][i % 7],
        marca: ["HP", "Dell", "Lenovo", "Apple", "Samsung"][i % 5],
        modelo: `Modelo ${i}`,
        numeroSerie: `SN${1000 + i}`,
        cliente: clientes[i % clientes.length]._id,
        clienteNombre: clientes[i % clientes.length].nombre,
      });
    }

    // Órdenes de servicio técnico
    for (let i = 1; i <= 15; i++) {
      await OrdenServicio.create({
        numero: `SAT-${String(i).padStart(3, "0")}`,
        aparatoDescripcion: `Aparato demo ${i}`,
        cliente: clientes[i % clientes.length]._id,
        clienteNombre: clientes[i % clientes.length].nombre,
        telefono: clientes[i % clientes.length].telefono,
        averia: `Avería descripta ${i}`,
        diagnostico: `Diagnóstico realizado ${i}`,
        estado: ["recepcion", "en_curso", "finalizado", "entregado"][i % 4],
        lineas: [{ descripcion: `Reparación demo ${i}`, cantidad: 1, precioUnitario: i * 35, iva: 21 }],
        total: Math.round(i * 35 * 1.21 * 100) / 100,
      });
    }

    // Préstamos de cortesía
    for (let i = 1; i <= 15; i++) {
      const fechaPrevista = new Date();
      fechaPrevista.setDate(fechaPrevista.getDate() + i);
      await PrestamoCortesia.create({
        vehiculo: vehiculos[i % vehiculos.length]._id,
        matricula: vehiculos[i % vehiculos.length].matricula,
        clienteNombre: clientes[i % clientes.length].nombre,
        telefono: clientes[i % clientes.length].telefono,
        fechaPrevista,
        kmSalida: i * 1000,
        estado: i % 3 === 0 ? "devuelto" : "activo",
      });
    }

    // Presupuestos de compra
    for (let i = 1; i <= 15; i++) {
      const base = i * 40;
      await PresupuestoCompra.create({
        numero: `PR-${String(i).padStart(3, "0")}`,
        proveedor: proveedores[i % proveedores.length]._id,
        numeroPresupuestoProveedor: `OF-${1000 + i}`,
        lineas: [{ descripcion: `Oferta proveedor ${i}`, cantidad: 1, precioUnitario: base, iva: 21 }],
        baseImponible: base,
        cuotaIva: Math.round(base * 0.21 * 100) / 100,
        total: Math.round(base * 1.21 * 100) / 100,
        estado: ["pendiente", "aceptado", "rechazado"][i % 3],
      });
    }

    // Llamadas
    for (let i = 1; i <= 15; i++) {
      await Llamada.create({
        numero: `600000${String(i).padStart(2, "0")}`,
        numeroNormalizado: `600000${String(i).padStart(2, "0")}`,
        direccion: ["entrante", "saliente"][i % 2],
        estado: ["sonando", "en-curso", "atendida", "perdida"][i % 4],
        duracionSeg: i * 60,
        cliente: clientes[i % clientes.length]._id,
      });
    }

    // Recurrencias
    for (let i = 1; i <= 15; i++) {
      const proxima = new Date();
      proxima.setDate(proxima.getDate() + i);
      await Recurrencia.create({
        empresa: empresa._id,
        cliente: clientes[i % clientes.length]._id,
        concepto: `Recurrencia demo ${i}`,
        lineas: [{ descripcion: `Cuota demo ${i}`, cantidad: 1, precioUnitario: i * 30, iva: 21 }],
        periodicidad: ["mensual", "trimestral", "anual"][i % 3],
        proximaEmision: proxima,
      });
    }

    // Remesas
    for (let i = 1; i <= 15; i++) {
      const fechaCargo = new Date();
      fechaCargo.setDate(fechaCargo.getDate() + i);
      await Remesa.create({
        empresa: empresa._id,
        fechaCargo,
        total: i * 500,
        estado: ["generada", "presentada", "cerrada"][i % 3],
      });
    }

    console.log("Datos de demo creados correctamente.");
  });
}

async function main() {
  await conectar();
  await borrarLocal();
  const { admin, limitado } = await crearDemos();
  await seedDemo(admin);
  await seedDemo(limitado);
  console.log("\n=================================");
  console.log("Demos listas:");
  console.log("  Admin:     ", EMAIL_DEMO_ADMIN, "/", PASS_DEMO);
  console.log("  Limitado:  ", EMAIL_DEMO_LIMITADO, "/", PASS_DEMO);
  console.log("  Bases:     ", DB_DEMO_ADMIN, "+", DB_DEMO_LIMITADO);
  console.log("=================================");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
