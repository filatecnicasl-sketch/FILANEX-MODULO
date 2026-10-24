// Rellena la base de datos de un tenant DEMO con datos de ejemplo realistas
// en todas las opciones del programa (más de 10 registros por cada una).
//
//   node scripts/sembrar-demo.mjs [slug]      (por defecto: demofilanex)
//
// Es idempotente: vacía las colecciones de negocio del tenant indicado y las
// vuelve a crear. NO toca la ficha de empresa, los usuarios ni el tenant, y
// se niega a ejecutarse sobre un tenant que no esté en estado "demo" para no
// borrar datos reales de un cliente por error.
import mongoose from "mongoose";
import "dotenv/config";
import { conexionTenant, conContexto } from "../src/models/tenant.js";
import { uriBase, nombreBdPlataforma } from "../src/config/db.js";
import Tenant from "../src/models/plataforma/Tenant.js";
import { calcularTotales } from "../src/services/totales.js";
import {
  huellaAlta,
  contenidoQr,
  xmlRegistroAlta,
  fechaDDMMYYYY,
  timestampRegistro,
} from "../src/services/verifactu.js";

import Empresa from "../src/models/Empresa.js";
import Cliente from "../src/models/Cliente.js";
import Proveedor from "../src/models/Proveedor.js";
import Articulo from "../src/models/Articulo.js";
import Vehiculo from "../src/models/Vehiculo.js";
import Operario from "../src/models/Operario.js";
import Aseguradora from "../src/models/Aseguradora.js";
import Aparato from "../src/models/Aparato.js";
import Presupuesto from "../src/models/Presupuesto.js";
import AlbaranVenta from "../src/models/AlbaranVenta.js";
import FacturaVenta from "../src/models/FacturaVenta.js";
import PresupuestoCompra from "../src/models/PresupuestoCompra.js";
import PedidoCompra from "../src/models/PedidoCompra.js";
import AlbaranCompra from "../src/models/AlbaranCompra.js";
import FacturaCompra from "../src/models/FacturaCompra.js";
import OrdenTrabajo from "../src/models/OrdenTrabajo.js";
import OrdenServicio from "../src/models/OrdenServicio.js";
import Valoracion from "../src/models/Valoracion.js";
import PrestamoCortesia from "../src/models/PrestamoCortesia.js";
import Cita from "../src/models/Cita.js";
import Llamada from "../src/models/Llamada.js";
import Gasto from "../src/models/Gasto.js";
import Recurrencia from "../src/models/Recurrencia.js";
import Remesa from "../src/models/Remesa.js";
import RegistroFacturacion from "../src/models/RegistroFacturacion.js";
import Contador from "../src/models/Contador.js";
import ClienteAsesoria from "../src/models/ClienteAsesoria.js";
import DocumentoFiscal from "../src/models/DocumentoFiscal.js";
import SolicitudDocumento from "../src/models/SolicitudDocumento.js";
import CierreTrimestral from "../src/models/CierreTrimestral.js";
import { Auditoria } from "../src/models/Auditoria.js";

// ---------------------------------------------------------------- utilidades

const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";

// DNI válido a partir de un número de 8 cifras.
function dni(numero) {
  const n = String(numero).padStart(8, "0");
  return n + LETRAS_DNI[Number(n) % 23];
}

// CIF válido: calcula el dígito/letra de control real.
function cif(letra, numero) {
  const d = String(numero).padStart(7, "0");
  let pares = 0;
  let impares = 0;
  for (let i = 0; i < 7; i++) {
    const v = Number(d[i]);
    if (i % 2 === 1) pares += v;
    else {
      const doble = v * 2;
      impares += Math.floor(doble / 10) + (doble % 10);
    }
  }
  const control = (10 - ((pares + impares) % 10)) % 10;
  const conLetra = "PQSNW".includes(letra);
  return letra + d + (conLetra ? "JABCDEFGHI"[control] : String(control));
}

const LETRAS_MATRICULA = "BCDFGHJKLMNPRSTVWXYZ";

function matricula(i) {
  const n = String(1000 + i * 137).slice(-4);
  const l = LETRAS_MATRICULA;
  return `${n} ${l[i % 20]}${l[(i * 3) % 20]}${l[(i * 7) % 20]}`;
}

const HOY = new Date();

// Fecha a N días de hoy, con la hora a cero.
function dia(offset) {
  const f = new Date(HOY);
  f.setDate(f.getDate() + offset);
  f.setHours(9, 0, 0, 0);
  return f;
}

const dos = (n) => Math.round(n * 100) / 100;
const elige = (arr, i) => arr[i % arr.length];

// ------------------------------------------------------------ datos de base

const CLIENTES = [
  ["Transportes Guadalquivir S.L.", cif("B", 4102301), "administracion@tguadalquivir.es", "954213380", "Avenida de la Innovación 14", "41020", "Sevilla"],
  ["Panadería La Espiga Dorada S.L.", cif("B", 4102302), "pedidos@laespigadorada.es", "954118742", "Calle Feria 88", "41003", "Sevilla"],
  ["Construcciones Alcalá 2000 S.L.", cif("B", 4102303), "obras@alcala2000.es", "955610233", "Polígono La Red Norte 22", "41500", "Alcalá de Guadaíra"],
  ["Clínica Dental Sonrisa Plena S.L.P.", cif("B", 4102304), "recepcion@sonrisaplena.es", "954559001", "Calle Asunción 45", "41011", "Sevilla"],
  ["Hostelería Triana Centro S.L.", cif("B", 4102305), "gerencia@trianacentro.es", "954334410", "Calle Betis 12", "41010", "Sevilla"],
  ["Distribuciones Frigoríficas del Sur S.A.", cif("A", 4102306), "logistica@frisur.es", "954670012", "Ctra. Sevilla-Málaga km 4", "41016", "Sevilla"],
  ["Antonio Ruiz Delgado", dni(28441203), "antonio.ruiz@gmail.com", "611223344", "Calle Amor de Dios 7", "41002", "Sevilla"],
  ["María Fernanda Ortega Pino", dni(52118409), "mf.ortega@hotmail.com", "622889100", "Avenida Kansas City 30", "41007", "Sevilla"],
  ["Asesoría Fiscal Bermejo e Hijos S.L.", cif("B", 4102307), "info@asesoriabermejo.es", "954902277", "Calle San Fernando 4", "41004", "Sevilla"],
  ["Jardinería y Paisajismo Aljarafe S.L.", cif("B", 4102308), "presupuestos@jardinesaljarafe.es", "955712840", "Calle Olivar 3", "41940", "Tomares"],
  ["Autoescuela Progreso S.L.", cif("B", 4102309), "matriculas@autoescuelaprogreso.es", "954455612", "Calle Luis Montoto 120", "41005", "Sevilla"],
  ["Ferretería Industrial Macarena S.L.", cif("B", 4102310), "ventas@ferremacarena.es", "954371190", "Ronda de Capuchinos 55", "41003", "Sevilla"],
  ["José Manuel Cabrera Lozano", dni(30772154), "jm.cabrera@yahoo.es", "600774411", "Calle Virgen de Luján 18", "41011", "Sevilla"],
  ["Excmo. Ayuntamiento de Camas", cif("P", 4102100), "contratacion@camas.es", "954391111", "Plaza Nuestra Señora de los Dolores 1", "41900", "Camas"],
  ["Talleres Metálicos Dos Hermanas S.L.", cif("B", 4102311), "taller@metalicos2h.es", "954721503", "Polígono La Isla, Nave 9", "41700", "Dos Hermanas"],
  ["Carmen Vega Nieto", dni(45900318), "carmenvega@gmail.com", "633001299", "Calle Rioja 9", "41001", "Sevilla"],
];

const PROVEEDORES = [
  ["Recambios del Sur S.A.", cif("A", 4190001), "pedidos@recambiosdelsur.es", "954901100", "Polígono Store, Calle A 12", "41008", "Sevilla"],
  ["Neumáticos Andalucía S.L.", cif("B", 4190002), "ventas@neumaticosandalucia.es", "954882200", "Ctra. Amarilla 45", "41007", "Sevilla"],
  ["Lubricantes Ibéricos S.L.", cif("B", 4190003), "comercial@lubricantesibericos.es", "955330011", "Polígono El Pino, Nave 3", "41016", "Sevilla"],
  ["Pinturas y Barnices Guadaíra S.L.", cif("B", 4190004), "info@pinturasguadaira.es", "955612200", "Calle Ferrocarril 8", "41500", "Alcalá de Guadaíra"],
  ["Suministros Eléctricos Betis S.A.", cif("A", 4190005), "pedidos@sebetis.es", "954442100", "Calle Torneo 90", "41002", "Sevilla"],
  ["Herramientas Profesionales Hispalis S.L.", cif("B", 4190006), "ventas@hphispalis.es", "954550099", "Polígono Calonge, Nave 22", "41007", "Sevilla"],
  ["Informática y Componentes Nervión S.L.", cif("B", 4190007), "compras@icnervion.es", "954600788", "Avenida Eduardo Dato 60", "41005", "Sevilla"],
  ["Gestoría y Servicios Triana S.L.", cif("B", 4190008), "administracion@gstriana.es", "954331177", "Calle San Jacinto 30", "41010", "Sevilla"],
  ["Endesa Energía S.A.U.", "A81948077", "grandes.cuentas@endesa.es", "800760909", "Ribera del Loira 60", "28042", "Madrid"],
  ["Telefónica de España S.A.U.", "A82018474", "empresas@telefonica.es", "900101010", "Gran Vía 28", "28013", "Madrid"],
  ["Papelería y Consumibles Alameda S.L.", cif("B", 4190009), "pedidos@palameda.es", "954902244", "Alameda de Hércules 15", "41002", "Sevilla"],
  ["Vestuario Laboral Aljarafe S.L.", cif("B", 4190010), "ventas@vlaljarafe.es", "955710600", "Calle Industria 4", "41940", "Tomares"],
  ["Gases Técnicos del Guadalquivir S.L.", cif("B", 4190011), "servicio@gasesguadalquivir.es", "954673300", "Polígono La Chaparrilla 7", "41016", "Sevilla"],
  ["Transportes Urgentes Hispalis S.L.", cif("B", 4190012), "trafico@tuhispalis.es", "954120099", "Ctra. Nacional IV km 550", "41700", "Dos Hermanas"],
];

const ARTICULOS = [
  ["articulo", "Filtro de aceite universal", "ud", 4.2, 9.5, 21],
  ["articulo", "Filtro de aire motor", "ud", 6.8, 15.9, 21],
  ["articulo", "Filtro de habitáculo con carbón activo", "ud", 7.4, 18.5, 21],
  ["articulo", "Aceite motor 5W30 sintético (litro)", "l", 4.9, 11.9, 21],
  ["articulo", "Pastillas de freno delanteras", "jgo", 22.5, 54.0, 21],
  ["articulo", "Discos de freno delanteros (par)", "par", 38.0, 89.0, 21],
  ["articulo", "Batería 12V 70Ah 640A", "ud", 62.0, 129.0, 21],
  ["articulo", "Neumático 205/55 R16 91V", "ud", 48.0, 89.0, 21],
  ["articulo", "Amortiguador trasero", "ud", 41.0, 92.0, 21],
  ["articulo", "Correa de distribución con kit", "jgo", 78.0, 165.0, 21],
  ["articulo", "Bujía de encendido iridio", "ud", 6.1, 14.5, 21],
  ["articulo", "Líquido refrigerante G12 (5 l)", "gf", 9.8, 21.5, 21],
  ["articulo", "Escobilla limpiaparabrisas 60 cm", "ud", 5.2, 12.9, 21],
  ["articulo", "Lámpara halógena H7 55W", "ud", 2.4, 6.9, 21],
  ["articulo", "Disco duro SSD 1 TB", "ud", 54.0, 99.0, 21],
  ["articulo", "Memoria RAM DDR4 16 GB", "ud", 32.0, 62.0, 21],
  ["articulo", "Fuente de alimentación ATX 650W", "ud", 45.0, 84.0, 21],
  ["servicio", "Mano de obra mecánica (hora)", "h", 0, 42.0, 21],
  ["servicio", "Mano de obra chapa y pintura (hora)", "h", 0, 48.0, 21],
  ["servicio", "Mano de obra electricidad del automóvil (hora)", "h", 0, 45.0, 21],
  ["servicio", "Diagnosis electrónica con equipo", "ud", 0, 35.0, 21],
  ["servicio", "Alineación de dirección", "ud", 0, 45.0, 21],
  ["servicio", "Cambio de aceite y filtros", "ud", 0, 59.0, 21],
  ["servicio", "Revisión pre-ITV completa", "ud", 0, 39.0, 21],
  ["servicio", "Recarga de aire acondicionado", "ud", 0, 69.0, 21],
  ["servicio", "Mano de obra informática (hora)", "h", 0, 38.0, 21],
  ["servicio", "Instalación y configuración de equipo", "ud", 0, 55.0, 21],
  ["servicio", "Recuperación de datos de disco", "ud", 0, 120.0, 21],
];

const VEHICULOS = [
  ["Seat", "León 1.5 TSI", "Gris", "Gasolina", 2019, 84200],
  ["Volkswagen", "Golf 2.0 TDI", "Azul", "Diésel", 2018, 132400],
  ["Renault", "Clio 1.0 TCe", "Blanco", "Gasolina", 2021, 41800],
  ["Peugeot", "308 1.5 BlueHDi", "Negro", "Diésel", 2020, 96300],
  ["Ford", "Focus 1.0 EcoBoost", "Rojo", "Gasolina", 2017, 118700],
  ["Toyota", "Corolla 1.8 Hybrid", "Blanco", "Híbrido", 2022, 33900],
  ["Citroën", "Berlingo 1.5 BlueHDi", "Blanco", "Diésel", 2019, 165200],
  ["Mercedes-Benz", "Sprinter 314 CDI", "Blanco", "Diésel", 2018, 248500],
  ["BMW", "Serie 3 320d", "Azul", "Diésel", 2020, 78400],
  ["Audi", "A4 Avant 35 TDI", "Negro", "Diésel", 2021, 62100],
  ["Opel", "Corsa 1.2", "Naranja", "Gasolina", 2022, 28600],
  ["Nissan", "Qashqai 1.3 DIG-T", "Gris", "Gasolina", 2020, 71200],
  ["Kia", "Sportage 1.6 CRDi", "Verde", "Diésel", 2021, 54700],
  ["Hyundai", "Tucson 1.6 HEV", "Blanco", "Híbrido", 2023, 21400],
  ["Fiat", "Ducato 2.3 MultiJet", "Blanco", "Diésel", 2017, 289000],
  ["Dacia", "Sandero 1.0 TCe", "Gris", "Gasolina", 2022, 37500],
];

const CORTESIA = [
  ["Seat", "Ibiza 1.0 MPI", "Blanco"],
  ["Renault", "Twingo 1.0 SCe", "Rojo"],
  ["Fiat", "Panda 1.2", "Azul"],
  ["Citroën", "C3 1.2 PureTech", "Gris"],
];

const OPERARIOS = [
  ["Miguel Ángel Ponce Ríos", "Mecánica general", 21.5],
  ["Rafael Ortiz Marín", "Mecánica general", 20.0],
  ["Juan Carlos Bermúdez Gil", "Chapa", 22.0],
  ["Francisco Javier Rueda Peña", "Pintura", 22.5],
  ["Alberto Sánchez Domínguez", "Electricidad del automóvil", 23.0],
  ["David Moreno Cuesta", "Diagnosis electrónica", 24.0],
  ["Sergio Lara Ibáñez", "Neumáticos y alineación", 19.5],
  ["Manuel Jesús Prieto Casas", "Aire acondicionado", 21.0],
  ["Iván Redondo Herrera", "Informática y SAT", 20.5],
  ["Laura Espinosa Bravo", "Informática y SAT", 21.0],
  ["Cristina Molina Arjona", "Recepción y calidad", 18.5],
  ["Pedro Luis Gámez Soler", "Mecánica de vehículo industrial", 25.0],
];

const ASEGURADORAS = [
  ["Mapfre España Compañía de Seguros y Reaseguros S.A.", "A28141935", "915811000", "peritaciones@mapfre.com", "Ana Belén Torres", 38.5, 10, 20],
  ["Allianz Compañía de Seguros y Reaseguros S.A.", "A28007748", "913255000", "siniestros.auto@allianz.es", "Roberto Gil", 37.0, 8, 18],
  ["AXA Seguros Generales S.A.", "A60917978", "902404084", "peritos@axa.es", "Marta Sáez", 39.0, 10, 22],
  ["Generali España S.A. de Seguros y Reaseguros", "A28007268", "915147500", "auto@generali.es", "Luis Cañete", 38.0, 9, 20],
  ["Zurich Insurance Europe AG", "W0072130H", "902101060", "talleres@zurich.es", "Elena Prados", 40.0, 10, 20],
  ["Línea Directa Aseguradora S.A.", "A80871031", "902123344", "reparaciones@lineadirecta.es", "Javier Ondo", 36.5, 7, 15],
  ["Mutua Madrileña Automovilista", "V28027118", "915922000", "peritacion@mutua.es", "Sonia Pérez", 38.0, 8, 18],
  ["Pelayo Mutua de Seguros", "V28027191", "918366800", "auto@pelayo.com", "Andrés Vela", 37.5, 8, 17],
  ["Reale Seguros Generales S.A.", "A78520293", "915916100", "siniestros@reale.es", "Nuria Camino", 37.0, 8, 16],
  ["Santa Lucía S.A. Compañía de Seguros", "A28018182", "915666000", "auto@santalucia.es", "Ismael Prats", 36.0, 7, 15],
  ["Catalana Occidente S.A. de Seguros", "A28119220", "935820500", "peritos@catalanaoccidente.com", "Pilar Nogués", 38.5, 9, 19],
  ["Verti Aseguradora S.A.", cif("A", 8589141), "911239900", "talleres@verti.es", "Óscar Ibarra", 36.0, 6, 14],
];

const APARATOS = [
  ["portatil", "HP", "ProBook 450 G8", "Windows 11 Pro, sin batería de repuesto"],
  ["portatil", "Lenovo", "ThinkPad E15", "Cargador original incluido"],
  ["portatil", "Apple", "MacBook Air M1", "Sin funda, con cargador USB-C"],
  ["pc_sobremesa", "Dell", "OptiPlex 7090", "Torre, sin monitor ni teclado"],
  ["pc_sobremesa", "HP", "EliteDesk 800 G6", "Con teclado y ratón"],
  ["pc_sobremesa", "Ensamblado", "Equipo a medida i5", "Torre con lector DVD"],
  ["movil", "Samsung", "Galaxy A54", "Con funda y protector de pantalla"],
  ["movil", "Xiaomi", "Redmi Note 12", "Sin cargador"],
  ["movil", "Apple", "iPhone 13", "Con cable Lightning"],
  ["tablet", "Samsung", "Galaxy Tab A8", "Con funda tipo libro"],
  ["tablet", "Apple", "iPad 9ª generación", "Sin accesorios"],
  ["monitor", "LG", "24MK430H", "Con cable HDMI"],
  ["monitor", "BenQ", "GW2480", "Sin cable de alimentación"],
  ["impresora", "Brother", "MFC-L2710DW", "Con tóner instalado"],
  ["impresora", "Epson", "EcoTank L3250", "Con botes de tinta"],
];

const AVERIAS_SAT = [
  ["No enciende, no da señal de vídeo", "Fuente de alimentación averiada, se sustituye"],
  ["Muy lento al arrancar Windows", "Disco mecánico degradado, se clona a SSD"],
  ["Pantalla azul aleatoria", "Módulo de memoria RAM defectuoso"],
  ["No conecta al wifi de la oficina", "Tarjeta de red desactualizada, se actualiza controlador"],
  ["Se apaga solo tras 10 minutos", "Ventilador obstruido y pasta térmica seca"],
  ["No carga la batería", "Conector de carga con soldadura fría"],
  ["Pantalla rota tras caída", "Sustitución de módulo de pantalla completo"],
  ["No imprime, atasca el papel", "Rodillo de arrastre desgastado"],
  ["Ha perdido las fotos y documentos", "Recuperación de datos desde el disco"],
  ["Muestra publicidad y ventanas emergentes", "Infección por adware, se limpia y actualiza"],
  ["Teclado no responde en varias teclas", "Sustitución del teclado completo"],
  ["No detecta el disco duro externo", "Puerto USB dañado en placa"],
];

const MOTIVOS_TALLER = [
  ["Revisión de los 100.000 km", "Cambio de aceite, filtros y revisión general"],
  ["Ruido en tren delantero", "Sustitución de rótulas y bieletas"],
  ["Frenos con vibración", "Discos y pastillas delanteras"],
  ["Testigo de motor encendido", "Diagnosis y sustitución de sonda lambda"],
  ["Pre-ITV", "Revisión completa antes de pasar la ITV"],
  ["Aire acondicionado no enfría", "Carga de gas y detección de fuga"],
  ["Cambio de neumáticos", "Cuatro neumáticos y alineación"],
  ["Correa de distribución", "Kit de distribución y bomba de agua"],
  ["Batería descargada", "Sustitución de batería y comprobación del alternador"],
  ["Golpe en aleta delantera derecha", "Chapa y pintura de aleta y paragolpes"],
  ["Embrague patina", "Sustitución del kit de embrague"],
  ["Suspensión trasera hundida", "Amortiguadores traseros"],
  ["Fuga de aceite", "Sustitución de junta de cárter"],
  ["Mantenimiento de flota", "Revisión programada de vehículo comercial"],
];

const CATEGORIAS_GASTO = [
  ["combustible", "Repostaje furgoneta de taller", "Repsol Estación Sevilla Este", 62.4],
  ["combustible", "Repostaje vehículo de empresa", "Cepsa Ronda del Tamarguillo", 55.1],
  ["peaje_parking", "Parking centro para gestión bancaria", "Aparcamiento Plaza Nueva", 8.5],
  ["peaje_parking", "Peaje AP-4 desplazamiento a Cádiz", "Autopistas del Sur", 12.3],
  ["transporte", "Envío urgente de recambio", "MRW Sevilla Este", 18.9],
  ["dietas", "Comida de trabajo con proveedor", "Restaurante La Raza", 46.0],
  ["dietas", "Almuerzo desplazamiento a Córdoba", "Mesón El Choto", 24.5],
  ["atenciones", "Detalle de Navidad para cliente", "Bodegas Góngora", 89.0],
  ["material", "Consumibles de taller (guantes y trapos)", "Ferretería Industrial Macarena", 74.3],
  ["material", "Tornillería y abrazaderas", "Suministros Calonge", 33.8],
  ["suministros", "Factura de electricidad del taller", "Endesa Energía", 412.6],
  ["suministros", "Factura de fibra y móviles", "Telefónica de España", 118.4],
  ["reparaciones", "Reparación del compresor de aire", "Neumática Hispalis", 210.0],
  ["alojamiento", "Hotel curso de formación técnica", "Hotel Ribera de Triana", 96.0],
  ["otros", "Cuota anual de asociación de talleres", "Asociación Provincial de Talleres", 145.0],
];

// ---------------------------------------------------------------- siembra

const COLECCIONES = [
  Cliente, Proveedor, Articulo, Vehiculo, Operario, Aseguradora, Aparato,
  Presupuesto, AlbaranVenta, FacturaVenta, PresupuestoCompra, PedidoCompra,
  AlbaranCompra, FacturaCompra, OrdenTrabajo, OrdenServicio, Valoracion,
  PrestamoCortesia, Cita, Llamada, Gasto, Recurrencia, Remesa,
  RegistroFacturacion, Contador, ClienteAsesoria, DocumentoFiscal,
  SolicitudDocumento, CierreTrimestral,
];

async function vaciar() {
  for (const Modelo of COLECCIONES) await Modelo.deleteMany({});
  await Auditoria.deleteMany({});
}

// Prepara la ficha de empresa: series y contadores desde los que seguirá
// numerando la aplicación cuando el usuario cree documentos nuevos.
async function prepararEmpresa() {
  const empresa = await Empresa.findOne();
  if (!empresa) throw new Error("La empresa demo no tiene ficha creada.");
  empresa.seriesVenta = [
    { nombre: "A", defecto: true, proxPresupuesto: 1, proxAlbaran: 1, proxFactura: 1 },
  ];
  empresa.seriesCompra = [
    { nombre: "C", defecto: true, proxPresupuesto: 1, proxPedido: 1, proxAlbaran: 1 },
  ];
  if (!empresa.metodosPago?.length) {
    empresa.metodosPago = [
      { nombre: "Transferencia", plazos: [30], defecto: true },
      { nombre: "Contado", plazos: [0] },
      { nombre: "Domiciliación 30/60", plazos: [30, 60] },
      { nombre: "Tarjeta", plazos: [0] },
    ];
  }
  return empresa;
}

async function crearFichas(empresa) {
  const clientes = [];
  for (let i = 0; i < CLIENTES.length; i++) {
    const [nombre, nif, email, telefono, calle, cp, ciudad] = CLIENTES[i];
    clientes.push(await Cliente.create({
      empresa: empresa._id,
      codigo: String(i + 1),
      fechaAlta: dia(-360 + i * 12),
      nombre,
      nif,
      email,
      telefono,
      iban: `ES${String(7000 + i).slice(0, 2)} 2100 ${String(4000 + i)} ${String(20 + i).padStart(2, "0")} ${String(1000000 + i * 7)}`,
      banco: elige(["CaixaBank", "Banco Santander", "BBVA", "Unicaja", "Cajasur"], i),
      direccion: { calle, cp, ciudad, provincia: ciudad === "Madrid" ? "Madrid" : "Sevilla" },
      esAdministracionPublica: nif.startsWith("P"),
      notas: i % 4 === 0 ? "Cliente con condiciones especiales de pago a 60 días." : "",
    }));
  }

  const proveedores = [];
  for (let i = 0; i < PROVEEDORES.length; i++) {
    const [nombre, nif, email, telefono, calle, cp, ciudad] = PROVEEDORES[i];
    proveedores.push(await Proveedor.create({
      empresa: empresa._id,
      codigo: String(i + 1),
      fechaAlta: dia(-400 + i * 15),
      nombre,
      nif,
      email,
      telefono,
      direccion: { calle, cp, ciudad, provincia: ciudad === "Madrid" ? "Madrid" : "Sevilla" },
    }));
  }

  const articulos = [];
  for (let i = 0; i < ARTICULOS.length; i++) {
    const [tipo, descripcion, unidad, precioCompra, precioVenta, iva] = ARTICULOS[i];
    articulos.push(await Articulo.create({
      empresa: empresa._id,
      tipo,
      codigo: `ART-${String(i + 1).padStart(6, "0")}`,
      descripcion,
      unidad,
      precioCompra,
      precioVenta,
      iva,
      proveedor: tipo === "articulo" ? elige(proveedores, i)._id : undefined,
      referenciaProveedor: tipo === "articulo" ? `REF-${8000 + i * 13}` : undefined,
    }));
  }
  empresa.contadores.articulo = ARTICULOS.length + 1;

  const vehiculos = [];
  for (let i = 0; i < VEHICULOS.length; i++) {
    const [marca, modelo, color, combustible, anio, km] = VEHICULOS[i];
    const cliente = elige(clientes, i);
    vehiculos.push(await Vehiculo.create({
      matricula: matricula(i + 1),
      marca,
      modelo,
      color,
      combustible,
      anio,
      km,
      bastidor: `VF1${String(100000000000 + i * 7919)}`,
      tipo: "cliente",
      cliente: cliente._id,
      clienteNombre: cliente.nombre,
    }));
  }

  const cortesia = [];
  for (let i = 0; i < CORTESIA.length; i++) {
    const [marca, modelo, color] = CORTESIA[i];
    cortesia.push(await Vehiculo.create({
      matricula: matricula(90 + i),
      marca,
      modelo,
      color,
      combustible: "Gasolina",
      anio: 2021,
      km: 45000 + i * 8000,
      tipo: "cortesia",
      notas: "Vehículo de cortesía de la casa.",
    }));
  }

  for (const [nombre, especialidad, costeHora] of OPERARIOS) {
    await Operario.create({ nombre, especialidad, costeHora, activo: true });
  }

  const aseguradoras = [];
  for (const [nombre, nif, telefono, email, contacto, precioHoraMO, dtoManoObra, dtoMateriales] of ASEGURADORAS) {
    aseguradoras.push(await Aseguradora.create({
      nombre, nif, telefono, email, contacto,
      calle: "Departamento de peritación",
      ciudad: "Sevilla",
      cp: "41001",
      precioHoraMO,
      dtoManoObra,
      dtoMateriales,
      dtoTotal: 0,
    }));
  }

  const aparatos = [];
  for (let i = 0; i < APARATOS.length; i++) {
    const [tipo, marca, modelo, accesorios] = APARATOS[i];
    const cliente = elige(clientes, i + 3);
    aparatos.push(await Aparato.create({
      codigo: `AP-${String(i + 1).padStart(6, "0")}`,
      tipo,
      marca,
      modelo,
      numeroSerie: `SN${marca.slice(0, 2).toUpperCase()}${String(500000 + i * 137)}`,
      cliente: cliente._id,
      clienteNombre: cliente.nombre,
      accesorios,
      estadoFisico: elige(["Buen estado general", "Carcasa con marcas de uso", "Golpe en una esquina", "Como nuevo"], i),
      garantiaHasta: i % 3 === 0 ? dia(200 + i * 10) : undefined,
    }));
  }
  empresa.contadores.aparato = APARATOS.length + 1;

  return { clientes, proveedores, articulos, vehiculos, cortesia, aseguradoras, aparatos };
}

// Genera entre 2 y 4 líneas de documento a partir del catálogo.
function lineasDesdeCatalogo(articulos, semilla, cuantas = 3) {
  const lineas = [];
  for (let k = 0; k < cuantas; k++) {
    const a = elige(articulos, semilla * 3 + k * 5);
    const cantidad = a.tipo === "servicio" ? 1 + ((semilla + k) % 3) : 1 + ((semilla + k) % 4);
    lineas.push({
      descripcion: a.descripcion,
      cantidad,
      precioUnitario: a.precioVenta,
      descuento: (semilla + k) % 5 === 0 ? 5 : 0,
      iva: a.iva,
      tipo: a.tipo === "servicio" ? "mano_obra" : "material",
    });
  }
  return lineas;
}

function lineasCompra(articulos, semilla, cuantas = 3) {
  const lineas = [];
  for (let k = 0; k < cuantas; k++) {
    const a = elige(articulos.filter((x) => x.tipo === "articulo"), semilla * 2 + k * 3);
    lineas.push({
      descripcion: a.descripcion,
      cantidad: 5 + ((semilla + k) % 15),
      precioUnitario: a.precioCompra,
      descuento: (semilla + k) % 4 === 0 ? 10 : 0,
      iva: a.iva,
      tipo: "material",
    });
  }
  return lineas;
}

async function crearVentas(empresa, { clientes, articulos }) {
  // Presupuestos
  const presupuestos = [];
  for (let i = 1; i <= 14; i++) {
    const lineas = lineasDesdeCatalogo(articulos, i, 2 + (i % 3));
    const t = calcularTotales(lineas);
    presupuestos.push(await Presupuesto.create({
      empresa: empresa._id,
      numero: i,
      serieNumero: `A-${i}`,
      fecha: dia(-90 + i * 5),
      validezDias: 30,
      cliente: elige(clientes, i)._id,
      lineas,
      baseImponible: t.baseImponible,
      cuotaIva: t.cuotaIva,
      total: t.total,
      estado: elige(["borrador", "enviado", "enviado", "aceptado", "rechazado"], i),
    }));
  }
  empresa.seriesVenta[0].proxPresupuesto = presupuestos.length + 1;

  // Albaranes de venta
  const albaranes = [];
  for (let i = 1; i <= 14; i++) {
    const cliente = elige(clientes, i + 2);
    albaranes.push(await AlbaranVenta.create({
      empresa: empresa._id,
      numero: i,
      serieNumero: `A-${i}`,
      fecha: dia(-70 + i * 4),
      cliente: cliente._id,
      lineas: lineasDesdeCatalogo(articulos, i + 7, 2 + (i % 2)),
      estado: i % 3 === 0 ? "facturado" : "pendiente",
      firmaEntrega: i % 4 === 0
        ? { nombre: "Recibido en almacén", dni: dni(20000000 + i * 111), fecha: dia(-70 + i * 4) }
        : undefined,
    }));
  }
  empresa.seriesVenta[0].proxAlbaran = albaranes.length + 1;

  // Facturas de venta: unas cuantas en borrador y el resto emitidas con su
  // registro VeriFactu encadenado (entorno de pruebas, nunca se envían).
  const facturas = [];
  let registroAnterior = null;
  for (let i = 1; i <= 15; i++) {
    const cliente = elige(clientes, i + 1);
    const lineas = lineasDesdeCatalogo(articulos, i + 11, 2 + (i % 3));
    const t = calcularTotales(lineas);
    const emitida = i > 4;
    const fechaExpedicion = dia(-120 + i * 7);
    const vencimiento = new Date(fechaExpedicion);
    vencimiento.setDate(vencimiento.getDate() + 30);

    const cobros = [];
    if (emitida) {
      if (i % 3 === 0) {
        cobros.push({ fecha: vencimiento, importe: t.total, metodo: "transferencia" });
      } else if (i % 3 === 1) {
        cobros.push({ fecha: vencimiento, importe: dos(t.total / 2), metodo: "transferencia", notas: "Pago a cuenta" });
      }
    }

    const factura = await FacturaVenta.create({
      empresa: empresa._id,
      serie: "A",
      numero: emitida ? i - 4 : undefined,
      serieNumero: emitida ? `A-${i - 4}` : undefined,
      fechaExpedicion,
      cliente: cliente._id,
      descripcion: elige(
        ["Reparación de vehículo", "Mantenimiento programado", "Servicio técnico informático", "Suministro de material"],
        i
      ),
      lineas,
      baseImponible: t.baseImponible,
      cuotaIva: t.cuotaIva,
      total: t.total,
      estado: emitida ? "emitida" : "borrador",
      vencimiento,
      metodoPago: elige(["Transferencia", "Contado", "Domiciliación 30/60", "Tarjeta"], i),
      cobros,
    });

    if (emitida) {
      const fechaCorta = fechaDDMMYYYY(fechaExpedicion);
      const fechaHoraGen = timestampRegistro(fechaExpedicion);
      const huella = huellaAlta({
        nifEmisor: empresa.nif,
        numSerie: factura.serieNumero,
        fechaExpedicion: fechaCorta,
        tipoFactura: "F1",
        cuotaTotal: t.cuotaIva,
        importeTotal: t.total,
        huellaAnterior: registroAnterior?.huella ?? "",
        fechaHoraGen,
      });
      const xml = xmlRegistroAlta({
        empresa: { nombre: empresa.nombre, nif: empresa.nif },
        factura: {
          serieNumero: factura.serieNumero,
          fechaExpedicion,
          lineas,
          cuotaIva: t.cuotaIva,
          total: t.total,
          cliente: { nombre: cliente.nombre, nif: cliente.nif },
          descripcion: factura.descripcion,
        },
        huella,
        fechaHoraGen,
        registroAnterior,
      });
      await RegistroFacturacion.create({
        empresa: empresa._id,
        facturaVenta: factura._id,
        tipo: "alta",
        numSerieFactura: factura.serieNumero,
        fechaExpedicionFactura: fechaCorta,
        huella,
        huellaAnterior: registroAnterior?.huella ?? "",
        fechaHoraGeneracion: fechaExpedicion,
        xml,
        estadoEnvio: "pendiente",
      });
      factura.verifactu = {
        huella,
        huellaAnterior: registroAnterior?.huella ?? "",
        qrContenido: contenidoQr({
          nif: empresa.nif,
          numSerie: factura.serieNumero,
          fechaExpedicion: fechaCorta,
          total: t.total,
        }),
        enviada: false,
        estadoEnvio: "pendiente",
        fechaRegistro: fechaExpedicion,
      };
      await factura.save();
      registroAnterior = { emisor: empresa.nif, numSerie: factura.serieNumero, fecha: fechaCorta, huella };
    }
    facturas.push(factura);
  }

  const emitidas = facturas.filter((f) => f.estado === "emitida");
  empresa.seriesVenta[0].proxFactura = emitidas.length + 1;
  await Contador.create({ clave: "facturaVenta:A", valor: emitidas.length });

  return { presupuestos, albaranes, facturas };
}

async function crearCompras(empresa, { proveedores, articulos }) {
  for (let i = 1; i <= 12; i++) {
    const lineas = lineasCompra(articulos, i, 2 + (i % 3));
    const t = calcularTotales(lineas);
    await PresupuestoCompra.create({
      numero: `C-${i}`,
      proveedor: elige(proveedores, i)._id,
      numeroPresupuestoProveedor: `OF/${2026}/${1200 + i}`,
      fecha: dia(-100 + i * 6),
      lineas,
      baseImponible: t.baseImponible,
      cuotaIva: t.cuotaIva,
      total: t.total,
      estado: elige(["pendiente", "aceptado", "rechazado"], i),
      notas: i % 5 === 0 ? "Pendiente de confirmar plazo de entrega." : "",
    });
  }
  empresa.seriesCompra[0].proxPresupuesto = 13;

  for (let i = 1; i <= 12; i++) {
    const lineas = lineasCompra(articulos, i + 4, 2 + (i % 2));
    const t = calcularTotales(lineas);
    await PedidoCompra.create({
      numero: `C-${i}`,
      proveedor: elige(proveedores, i + 1)._id,
      fecha: dia(-85 + i * 6),
      lineas,
      baseImponible: t.baseImponible,
      cuotaIva: t.cuotaIva,
      total: t.total,
      estado: elige(["borrador", "confirmado", "confirmado", "recibido", "cancelado"], i),
    });
  }
  empresa.seriesCompra[0].proxPedido = 13;

  const albaranesCompra = [];
  for (let i = 1; i <= 13; i++) {
    const lineas = lineasCompra(articulos, i + 9, 2 + (i % 3));
    const t = calcularTotales(lineas);
    albaranesCompra.push(await AlbaranCompra.create({
      numero: `C-${i}`,
      empresa: empresa._id,
      proveedor: elige(proveedores, i + 2)._id,
      numeroAlbaran: `ALB/${45000 + i * 17}`,
      fecha: dia(-75 + i * 5),
      lineas,
      baseImponible: t.baseImponible,
      cuotaIva: t.cuotaIva,
      total: t.total,
      estado: i % 4 === 0 ? "facturado" : "confirmado",
    }));
  }
  empresa.seriesCompra[0].proxAlbaran = 14;

  for (let i = 1; i <= 14; i++) {
    const lineas = lineasCompra(articulos, i + 15, 2 + (i % 3));
    const t = calcularTotales(lineas);
    const fechaExpedicion = dia(-110 + i * 7);
    const pagos = [];
    if (i % 3 === 0) pagos.push({ fecha: dia(-80 + i * 7), importe: t.total, metodo: "transferencia" });
    else if (i % 3 === 1) pagos.push({ fecha: dia(-80 + i * 7), importe: dos(t.total / 2), metodo: "domiciliacion", nota: "Primer vencimiento" });

    await FacturaCompra.create({
      empresa: empresa._id,
      proveedor: elige(proveedores, i + 3)._id,
      numeroFacturaProveedor: `FR${2026}/${3100 + i * 11}`,
      fechaExpedicion,
      lineas,
      baseImponible: t.baseImponible,
      cuotaIva: t.cuotaIva,
      total: t.total,
      estado: elige(["pendiente_revision", "validada", "validada", "rechazada"], i),
      origen: i % 3 === 0 ? "ocr" : "manual",
      ocr: i % 3 === 0 ? { confianza: 0.93 } : undefined,
      albaranes: i % 4 === 0 ? [elige(albaranesCompra, i)._id] : [],
      pagos,
      notas: i % 6 === 0 ? "Revisar el descuento aplicado en la última línea." : "",
    });
  }
}

async function crearTaller(empresa, { clientes, vehiculos, cortesia, articulos, aseguradoras }) {
  const operarios = await Operario.find().lean();

  const ordenes = [];
  for (let i = 1; i <= 15; i++) {
    const vehiculo = elige(vehiculos, i);
    const cliente = clientes.find((c) => String(c._id) === String(vehiculo.cliente)) ?? elige(clientes, i);
    const [motivo, trabajo] = elige(MOTIVOS_TALLER, i);
    const lineas = lineasDesdeCatalogo(articulos, i + 4, 2 + (i % 3));
    const t = calcularTotales(lineas);
    const porAseguradora = i % 5 === 0;
    const fechaEntrada = dia(-60 + i * 4);

    const orden = await OrdenTrabajo.create({
      numero: `OT-${String(i).padStart(6, "0")}`,
      vehiculo: vehiculo._id,
      matricula: vehiculo.matricula,
      cliente: cliente._id,
      clienteNombre: cliente.nombre,
      telefono: cliente.telefono,
      trabajos: [trabajo],
      motivo,
      km: vehiculo.km + i * 120,
      estado: elige(["recepcion", "en_curso", "en_curso", "finalizado", "entregado"], i),
      fechaEntrada,
      fechaEntregaPrevista: dia(-60 + i * 4 + 3),
      lineas,
      total: t.total,
      aseguradora: porAseguradora ? elige(aseguradoras, i)._id : undefined,
      numeroSiniestro: porAseguradora ? `SIN/${2026}/${7100 + i}` : undefined,
      facturarA: porAseguradora ? "aseguradora" : "cliente",
      tiempos: [
        {
          operario: elige(operarios, i)._id,
          operarioNombre: elige(operarios, i).nombre,
          fecha: fechaEntrada,
          horas: 1 + (i % 4),
          nota: "Diagnóstico y desmontaje",
        },
        {
          operario: elige(operarios, i + 3)._id,
          operarioNombre: elige(operarios, i + 3).nombre,
          fecha: dia(-60 + i * 4 + 1),
          horas: 1 + ((i + 2) % 3),
          nota: "Montaje y prueba en carretera",
        },
      ],
      notasInternas: i % 4 === 0 ? "Avisar al cliente antes de pedir la pieza." : "",
    });
    ordenes.push(orden);

    // Historial del vehículo
    await Vehiculo.updateOne(
      { _id: vehiculo._id },
      { $push: { historial: { fecha: fechaEntrada, numeroOrden: orden.numero, orden: orden._id, motivo, km: orden.km } } }
    );
  }
  await Contador.create({ clave: "ordenTrabajo", valor: 15 });

  // Valoraciones de siniestro
  for (let i = 1; i <= 12; i++) {
    const vehiculo = elige(vehiculos, i + 2);
    const cliente = clientes.find((c) => String(c._id) === String(vehiculo.cliente)) ?? elige(clientes, i);
    const aseguradora = elige(aseguradoras, i);
    const lineas = [
      { descripcion: "Mano de obra chapa (horas de baremo)", importe: dos(48 * (2 + (i % 5))) },
      { descripcion: "Mano de obra pintura (horas de baremo)", importe: dos(48 * (1 + (i % 4))) },
      { descripcion: "Material de pintura", importe: dos(38 + i * 7.5) },
      { descripcion: elige(["Aleta delantera", "Paragolpes trasero", "Puerta delantera izquierda", "Capó"], i), importe: dos(120 + i * 22) },
    ];
    await Valoracion.create({
      numero: `PER-${String(i).padStart(6, "0")}`,
      vehiculo: vehiculo._id,
      matricula: vehiculo.matricula,
      clienteNombre: cliente.nombre,
      telefono: cliente.telefono,
      compania: aseguradora.nombre,
      aseguradora: aseguradora._id,
      numeroSiniestro: `SIN/${2026}/${8200 + i}`,
      fechaSiniestro: dia(-50 + i * 3),
      lineas,
      total: dos(lineas.reduce((s, l) => s + l.importe, 0)),
      estado: elige(["pendiente", "valorado", "valorado", "aprobado", "rechazado"], i),
      observaciones: i % 3 === 0 ? "Pendiente de la autorización del perito." : "",
    });
  }
  empresa.contadores.valoracion = 13;

  // Préstamos de vehículo de cortesía
  for (let i = 1; i <= 12; i++) {
    const vehiculo = elige(cortesia, i);
    const cliente = elige(clientes, i + 4);
    const orden = elige(ordenes, i);
    const devuelto = i % 3 !== 0;
    const salida = dia(-40 + i * 3);
    await PrestamoCortesia.create({
      vehiculo: vehiculo._id,
      matricula: vehiculo.matricula,
      clienteNombre: cliente.nombre,
      telefono: cliente.telefono,
      orden: orden._id,
      numeroOrden: orden.numero,
      fechaSalida: salida,
      fechaPrevista: dia(-40 + i * 3 + 4),
      fechaDevolucion: devuelto ? dia(-40 + i * 3 + 3) : undefined,
      kmSalida: vehiculo.km,
      kmEntrada: devuelto ? vehiculo.km + 120 + i * 15 : undefined,
      estado: devuelto ? "devuelto" : "activo",
      notas: i % 4 === 0 ? "Entregado con el depósito lleno." : "",
    });
  }

  return ordenes;
}

async function crearServicioTecnico(empresa, { clientes, aparatos, articulos }) {
  for (let i = 1; i <= 14; i++) {
    const aparato = elige(aparatos, i);
    const cliente = clientes.find((c) => String(c._id) === String(aparato.cliente)) ?? elige(clientes, i);
    const [averia, diagnostico] = elige(AVERIAS_SAT, i);
    const lineas = lineasDesdeCatalogo(articulos.filter((a) => a.tipo === "servicio" || a.descripcion.includes("SSD") || a.descripcion.includes("RAM")), i, 2);
    const t = calcularTotales(lineas);
    const domicilio = i % 4 === 0;
    await OrdenServicio.create({
      numero: `SAT-${String(i).padStart(6, "0")}`,
      aparato: aparato._id,
      aparatoDescripcion: `${aparato.marca} ${aparato.modelo}`,
      cliente: cliente._id,
      clienteNombre: cliente.nombre,
      telefono: cliente.telefono,
      tipoServicio: domicilio ? "domicilio" : "tienda",
      direccionIntervencion: domicilio
        ? {
            calle: cliente.direccion?.calle,
            cp: cliente.direccion?.cp,
            ciudad: cliente.direccion?.ciudad,
            provincia: cliente.direccion?.provincia,
          }
        : undefined,
      averia,
      diagnostico,
      accesorios: aparato.accesorios,
      estadoFisico: aparato.estadoFisico,
      garantia: i % 5 === 0 ? "en_garantia" : "sin_garantia",
      garantiaHasta: i % 5 === 0 ? dia(180) : undefined,
      estado: elige(["recepcion", "en_curso", "en_curso", "finalizado", "entregado"], i),
      fechaEntrada: dia(-45 + i * 3),
      fechaEntregaPrevista: dia(-45 + i * 3 + 4),
      lineas,
      total: t.total,
      notasInternas: i % 3 === 0 ? "El cliente pide presupuesto antes de reparar." : "",
    });
  }
  empresa.contadores.ordenServicio = 15;
}

async function crearAgendaYTelefonia({ clientes, vehiculos, aparatos, proveedores }) {
  // Citas repartidas entre taller, servicio técnico y agenda general
  for (let i = 1; i <= 16; i++) {
    const ambito = elige(["taller", "taller", "servicio", "general"], i);
    const cliente = elige(clientes, i);
    const base = {
      ambito,
      fecha: dia(-5 + i),
      hora: `${String(7 + (i % 5)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
      duracion: elige([30, 60, 60, 90], i),
      cliente: cliente._id,
      clienteNombre: cliente.nombre,
      telefono: cliente.telefono,
      estado: elige(["pendiente", "confirmada", "confirmada", "realizada", "cancelada"], i),
      presupuesto: i % 4 === 0,
    };
    if (ambito === "taller") {
      const v = elige(vehiculos, i);
      Object.assign(base, { vehiculo: v._id, matricula: v.matricula, motivo: elige(MOTIVOS_TALLER, i)[0] });
    } else if (ambito === "servicio") {
      const a = elige(aparatos, i);
      Object.assign(base, {
        aparato: a._id,
        aparatoDescripcion: `${a.marca} ${a.modelo}`,
        motivo: elige(AVERIAS_SAT, i)[0],
      });
    } else {
      Object.assign(base, {
        motivo: elige(
          ["Visita comercial", "Reunión con la gestoría", "Entrega de documentación", "Formación interna", "Llamada de seguimiento"],
          i
        ),
        direccion: `${cliente.direccion?.calle}, ${cliente.direccion?.ciudad}`,
      });
    }
    await Cita.create(base);
  }

  // Llamadas
  for (let i = 1; i <= 18; i++) {
    const esCliente = i % 3 !== 0;
    const ficha = esCliente ? elige(clientes, i) : elige(proveedores, i);
    const entrante = i % 2 === 0;
    const estado = elige(["atendida", "atendida", "atendida", "perdida"], i);
    const inicio = new Date(dia(-Math.floor(i / 3)));
    inicio.setHours(8 + (i % 9), (i * 7) % 60, 0, 0);
    const duracionSeg = estado === "perdida" ? 0 : 45 + i * 23;
    const fin = new Date(inicio.getTime() + duracionSeg * 1000);
    await Llamada.create({
      numero: ficha.telefono,
      numeroNormalizado: String(ficha.telefono).replace(/\D/g, "").slice(-9),
      direccion: entrante ? "entrante" : "saliente",
      estado,
      extension: String(200 + (i % 6)),
      extId: `demo-${1000 + i}`,
      inicio,
      fin: estado === "perdida" ? undefined : fin,
      duracionSeg,
      cliente: esCliente ? ficha._id : undefined,
      proveedor: esCliente ? undefined : ficha._id,
      notas: elige(
        ["Pide cita para revisión", "Consulta el estado de su reparación", "Solicita presupuesto", "Confirma la recogida", ""],
        i
      ),
    });
  }
}

async function crearGastosYCobros(empresa, { clientes, proveedores, facturas }) {
  for (let i = 0; i < CATEGORIAS_GASTO.length; i++) {
    const [categoria, concepto, comercio, total] = CATEGORIAS_GASTO[i];
    const tipoIva = 21;
    const base = dos(total / (1 + tipoIva / 100));
    const proveedor = proveedores.find((p) => p.nombre.startsWith(comercio.split(" ")[0]));
    await Gasto.create({
      fecha: dia(-40 + i * 2),
      comercio,
      nifComercio: proveedor?.nif,
      proveedor: proveedor?._id,
      concepto,
      categoria,
      base,
      tipoIva,
      cuotaIva: dos(total - base),
      total,
      conDatosFiscales: i % 4 !== 0,
      pagadoCon: elige(["tarjeta_empresa", "tarjeta_empresa", "efectivo", "tarjeta_personal", "transferencia"], i),
      pagadoPor: elige(["Francisco Barroso", "Cristina Molina", "Miguel Ángel Ponce"], i),
      reembolsado: i % 5 === 0,
      origen: i % 3 === 0 ? "ocr" : "manual",
      ocr: i % 3 === 0 ? { confianza: 0.95 } : undefined,
      estado: i % 3 === 0 ? "pendiente_revision" : "validado",
    });
  }

  // Cuotas recurrentes (mantenimientos y contratos)
  const CONCEPTOS = [
    "Mantenimiento informático mensual",
    "Cuota de soporte remoto",
    "Contrato de mantenimiento de flota",
    "Alquiler de equipo de diagnosis",
    "Servicio de copias de seguridad",
    "Revisión periódica de vehículo comercial",
    "Cuota de hosting y correo corporativo",
    "Mantenimiento de aire acondicionado",
    "Contrato de asistencia en carretera",
    "Gestión de residuos del taller",
    "Cuota de licencia de software de gestión",
    "Limpieza de instalaciones",
  ];
  for (let i = 0; i < CONCEPTOS.length; i++) {
    const importe = dos(45 + i * 17.5);
    await Recurrencia.create({
      empresa: empresa._id,
      cliente: elige(clientes, i)._id,
      concepto: CONCEPTOS[i],
      lineas: [{ descripcion: CONCEPTOS[i], cantidad: 1, precioUnitario: importe, iva: 21, tipo: "mano_obra" }],
      periodicidad: elige(["mensual", "mensual", "trimestral", "anual"], i),
      diaEmision: 1 + (i % 28),
      proximaEmision: dia(5 + i * 2),
      activa: i % 6 !== 0,
    });
  }

  // Remesas SEPA con recibos de facturas emitidas
  const emitidas = facturas.filter((f) => f.estado === "emitida");
  for (let i = 1; i <= 12; i++) {
    const recibos = [];
    for (let k = 0; k < 3; k++) {
      const f = elige(emitidas, i + k);
      const cliente = clientes.find((c) => String(c._id) === String(f.cliente));
      recibos.push({ facturaVenta: f._id, cliente: f.cliente, iban: cliente?.iban, importe: f.total });
    }
    await Remesa.create({
      empresa: empresa._id,
      fechaCargo: dia(-60 + i * 7),
      recibos,
      total: dos(recibos.reduce((s, r) => s + r.importe, 0)),
      estado: elige(["generada", "presentada", "cerrada"], i),
    });
  }
}

// ------------------------------------------------------------------ asesoría

const CARTERA = [
  ["Autocares del Guadalquivir S.L.", cif("B", 5201101), "sl", ["303", "390", "200", "111", "190"], 240],
  ["Restaurante El Puerto de Triana S.L.", cif("B", 5201102), "sl", ["303", "390", "200", "111", "115", "190", "180"], 260],
  ["Comercial Textil Andaluza S.L.", cif("B", 5201103), "sl", ["303", "390", "200", "349"], 220],
  ["Promociones Inmobiliarias Aljarafe S.A.", cif("A", 5201104), "sa", ["303", "390", "200", "202", "347"], 480],
  ["Clínica Veterinaria San Bernardo S.L.P.", cif("B", 5201105), "sl", ["303", "390", "200", "111", "190"], 250],
  ["Frutas y Hortalizas La Vega S.Coop.", cif("F", 5201106), "cooperativa", ["303", "390", "200"], 300],
  ["Electricista: Juan Antonio Ramos Siles", dni(26884113), "autonomo", ["303", "390", "130", "100"], 90],
  ["Diseñadora gráfica: Lucía Parejo Sanz", dni(51662290), "autonomo", ["303", "390", "130", "100", "349"], 85],
  ["Fontanería: Andrés Márquez Rufo", dni(30445521), "autonomo", ["303", "390", "131", "100"], 80],
  ["Peluquería: Encarnación Vidal Cobo", dni(45339087), "autonomo", ["303", "390", "131", "100"], 75],
  ["Abogado: Rodrigo Sanz de Bremond", dni(28776640), "autonomo", ["303", "390", "130", "100"], 120],
  ["Gestor administrativo: Pilar Corrales Úbeda", dni(44112255), "autonomo", ["303", "390", "130", "100"], 95],
];

const TERCEROS_EMITIDAS = [
  "Ayuntamiento de Mairena del Aljarafe", "Colegio San Ignacio", "Hotel Doña María",
  "Inversiones Costa Ballena S.L.", "Grupo Obras Públicas del Sur", "Farmacia Central de Camas",
];
const TERCEROS_RECIBIDAS = [
  "Recambios del Sur S.A.", "Endesa Energía S.A.U.", "Telefónica de España S.A.U.",
  "Papelería y Consumibles Alameda S.L.", "Vestuario Laboral Aljarafe S.L.", "Gestoría y Servicios Triana S.L.",
];

// Fecha dentro de un trimestre del año en curso (o en curso pasado).
function fechaTrimestre(ano, trimestre, desplazamiento) {
  const f = new Date(ano, (trimestre - 1) * 3 + (desplazamiento % 3), 4 + (desplazamiento % 22));
  return f > HOY ? new Date(HOY.getTime() - 3 * 86400000) : f;
}

async function crearAsesoria(empresa) {
  const ano = HOY.getFullYear();
  const trimestreActual = Math.floor(HOY.getMonth() / 3) + 1;

  const cartera = [];
  for (let i = 0; i < CARTERA.length; i++) {
    const [nombre, nif, forma, modelos, cuota] = CARTERA[i];
    cartera.push(await ClienteAsesoria.create({
      codigo: String(i + 1),
      fechaAlta: dia(-300 + i * 11),
      nombre,
      nif,
      formaJuridica: forma,
      regimenIrpf: forma === "autonomo" ? (modelos.includes("131") ? "estimacion_objetiva" : "estimacion_directa_simplificada") : undefined,
      actividad: elige(["Comercio al por menor", "Hostelería", "Servicios profesionales", "Construcción", "Transporte", "Salud"], i),
      telefono: `6${String(10000000 + i * 137913).slice(0, 8)}`,
      email: `cliente${i + 1}@ejemplo-cartera.es`,
      direccion: { calle: `Calle Ejemplo ${i + 1}`, cp: "41001", ciudad: "Sevilla", provincia: "Sevilla" },
      personaContacto: elige(["El titular", "Su hijo, que lleva el tema", "La encargada de administración"], i),
      areas: { fiscal: true, contable: true, laboral: i % 3 === 0 },
      modelos,
      numeroEmpleados: forma === "autonomo" ? i % 3 : 4 + i,
      cuotaMensual: cuota,
    }));
  }
  empresa.contadores = empresa.contadores ?? {};
  empresa.contadores.clienteAsesoria = CARTERA.length + 1;

  // Documentos del año en curso para cada cliente de la cartera.
  const documentos = [];
  for (let i = 0; i < cartera.length; i++) {
    const cliente = cartera[i];
    const esAutonomoDirecta = (cliente.modelos ?? []).includes("130");
    for (let t = 1; t <= trimestreActual; t++) {
      const nEmitidas = 2 + ((i + t) % 2);
      for (let k = 0; k < nEmitidas; k++) {
        const base = dos(400 + i * 37 + t * 120 + k * 65);
        const retencion = esAutonomoDirecta && (i + k) % 2 === 0 ? (i % 4 === 0 ? 7 : 15) : 0;
        documentos.push(await DocumentoFiscal.create({
          clienteAsesoria: cliente._id,
          tipo: "emitida",
          fecha: fechaTrimestre(ano, t, i + k),
          numero: `${cliente.codigo}/${ano}-${String(t * 10 + k).padStart(3, "0")}`,
          tercero: elige(TERCEROS_EMITIDAS, i + k + t),
          base,
          tipoIva: 21,
          cuotaIva: dos(base * 0.21),
          total: dos(base * 1.21),
          retencion,
          estado: "revisado",
          origen: i % 3 === 0 ? "ocr" : "manual",
        }));
      }
      const nRecibidas = 2 + ((i + t) % 2);
      for (let k = 0; k < nRecibidas; k++) {
        const base = dos(90 + i * 13 + t * 40 + k * 27);
        documentos.push(await DocumentoFiscal.create({
          clienteAsesoria: cliente._id,
          tipo: "recibida",
          fecha: fechaTrimestre(ano, t, i + k + 1),
          numero: `PR${40000 + i * 100 + t * 10 + k}`,
          tercero: elige(TERCEROS_RECIBIDAS, i + k),
          base,
          tipoIva: 21,
          cuotaIva: dos(base * 0.21),
          total: dos(base * 1.21),
          estado: "revisado",
          origen: "ocr",
          ocr: { confianza: 0.94 },
        }));
      }
      const baseGasto = dos(35 + i * 6 + t * 11);
      documentos.push(await DocumentoFiscal.create({
        clienteAsesoria: cliente._id,
        tipo: "gasto",
        fecha: fechaTrimestre(ano, t, i + 2),
        tercero: elige(["Repsol", "Restaurante La Raza", "Aparcamiento Plaza Nueva", "MRW"], i + t),
        base: baseGasto,
        tipoIva: 21,
        cuotaIva: dos(baseGasto * 0.21),
        total: dos(baseGasto * 1.21),
        estado: "revisado",
        origen: "ocr",
        ocr: { confianza: 0.91 },
      }));
    }
  }

  // Algunos documentos del trimestre en curso quedan pendientes de revisar,
  // para enseñar la bandeja de trabajo.
  for (let k = 0; k < 9; k++) {
    const cliente = elige(cartera, k * 2);
    const base = dos(60 + k * 23);
    documentos.push(await DocumentoFiscal.create({
      clienteAsesoria: cliente._id,
      tipo: k % 3 === 0 ? "gasto" : "recibida",
      fecha: fechaTrimestre(ano, trimestreActual, k),
      numero: k % 3 === 0 ? undefined : `PD${77000 + k}`,
      tercero: elige(TERCEROS_RECIBIDAS, k),
      base,
      tipoIva: 21,
      cuotaIva: dos(base * 0.21),
      total: dos(base * 1.21),
      estado: "pendiente",
      origen: "ocr",
      ocr: { confianza: 0.88 },
    }));
  }

  // Solicitudes de documentación: pendientes, recibidas y canceladas.
  const TEXTOS = [
    "Factura de la reforma del local de marzo",
    "Tickets de gasoil del trimestre",
    "Factura del hosting anual",
    "Nóminas y seguros sociales del mes pasado",
    "Factura de compra del ordenador nuevo",
    "Recibo del alquiler del local",
    "Facturas de los viajes a feria",
    "Justificante de la cuota de la asociación",
    "Factura del gestor de redes sociales",
    "Tickets de comidas con clientes del mes",
    "Factura de la reparación de la furgoneta",
    "Extracto del préstamo para la deducción de intereses",
  ];
  for (let k = 0; k < TEXTOS.length; k++) {
    const cliente = elige(cartera, k + 1);
    const estado = k % 4 === 3 ? "cancelada" : k % 4 === 2 ? "recibida" : "pendiente";
    await SolicitudDocumento.create({
      clienteAsesoria: cliente._id,
      descripcion: TEXTOS[k],
      periodo: `${((k % trimestreActual) + 1)}T ${ano}`,
      estado,
      documento: estado === "recibida" ? documentos.find((d) => String(d.clienteAsesoria) === String(cliente._id))?._id : undefined,
      notas: k % 5 === 0 ? "El cliente dice que la enviará esta semana." : "",
    });
  }

  // Control de cierres: trimestres cerrados/presentados en los ya vencidos.
  for (let k = 0; k < cartera.length; k++) {
    for (let t = 1; t <= trimestreActual; t++) {
      const estado =
        t < trimestreActual
          ? "presentado"
          : ["pendiente_docs", "en_revision", "listo", "presentado"][(k + t) % 4];
      await CierreTrimestral.create({
        clienteAsesoria: cartera[k]._id,
        ano,
        trimestre: t,
        estado,
        presentadoEn: estado === "presentado" ? new Date(ano, t * 3, 15) : null,
        notas: estado === "listo" ? "Cuadrado con el cliente, pendiente de presentar." : "",
      });
    }
  }
}

// Actividad de ejemplo para el registro de auditoría.
async function crearAuditoria() {
  const RUTAS = [
    ["POST", "/api/auth/login", 200, "Inicio de sesión correcto"],
    ["POST", "/api/facturas-venta", 201, "Factura de venta creada"],
    ["POST", "/api/facturas-venta/emitir", 200, "Factura emitida y registrada en VeriFactu"],
    ["PUT", "/api/clientes", 200, "Ficha de cliente actualizada"],
    ["POST", "/api/taller/ordenes", 201, "Orden de trabajo creada desde recepción rápida"],
    ["PUT", "/api/taller/ordenes", 200, "Orden de trabajo finalizada"],
    ["POST", "/api/gastos/ticket", 201, "Ticket de gasto leído con IA"],
    ["POST", "/api/presupuestos", 201, "Presupuesto creado"],
    ["DELETE", "/api/presupuestos", 200, "Presupuesto eliminado"],
    ["POST", "/api/servicio/ordenes", 201, "Orden de servicio técnico creada"],
    ["POST", "/api/agenda/interpretar", 200, "Cita creada por dictado de voz"],
    ["POST", "/api/auth/login", 401, "Contraseña incorrecta"],
    ["GET", "/api/informes/ventas", 200, "Consulta del informe de ventas"],
    ["POST", "/api/remesas", 201, "Remesa SEPA generada"],
    ["PUT", "/api/articulos", 200, "Precio de artículo actualizado"],
    ["POST", "/api/compras/facturas", 201, "Factura de compra registrada por OCR"],
  ];
  const USUARIOS = [
    ["Administrador Demo", "info@filanex.es"],
    ["Cristina Molina Arjona", "recepcion@empresademo.es"],
    ["Miguel Ángel Ponce Ríos", "taller@empresademo.es"],
  ];
  for (let i = 0; i < RUTAS.length; i++) {
    const [metodo, ruta, resultado, detalle] = RUTAS[i];
    const [nombre, email] = elige(USUARIOS, i);
    const doc = await Auditoria.create({ nombre, email, metodo, ruta, resultado, detalle });
    const cuando = new Date(HOY.getTime() - (i * 3 + 1) * 3600 * 1000);
    await Auditoria.updateOne({ _id: doc._id }, { $set: { createdAt: cuando, updatedAt: cuando } });
  }
}

// ---------------------------------------------------------------- ejecución

async function main() {
  const slug = process.argv[2] || "demofilanex";
  await mongoose.connect(`${uriBase()}/${nombreBdPlataforma()}`);

  const tenant = await Tenant.findOne({ slug });
  if (!tenant) throw new Error(`No existe el tenant "${slug}".`);
  if (tenant.estado !== "demo") {
    throw new Error(
      `El tenant "${slug}" está en estado "${tenant.estado}", no en "demo". ` +
      `Este script borra datos, así que solo se ejecuta sobre tenants de demostración.`
    );
  }

  const contexto = { conn: conexionTenant(tenant.dbName), slug: tenant.slug, dbName: tenant.dbName };
  await conContexto(contexto, async () => {
    console.log(`Sembrando ${tenant.dbName} (${tenant.nombre})...`);
    await vaciar();
    const empresa = await prepararEmpresa();
    const fichas = await crearFichas(empresa);
    const ventas = await crearVentas(empresa, fichas);
    await crearCompras(empresa, fichas);
    await crearTaller(empresa, fichas);
    await crearServicioTecnico(empresa, fichas);
    await crearAgendaYTelefonia(fichas);
    await crearGastosYCobros(empresa, { ...fichas, facturas: ventas.facturas });
    await crearAsesoria(empresa);
    await crearAuditoria();
    await empresa.save();

    const resumen = [];
    for (const Modelo of [...COLECCIONES, Auditoria]) {
      resumen.push([Modelo.modelName ?? "Auditoria", await Modelo.countDocuments()]);
    }
    console.log("\nRegistros creados:");
    for (const [nombre, n] of resumen.sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`  ${nombre.padEnd(22)} ${String(n).padStart(3)}`);
    }
  });

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
