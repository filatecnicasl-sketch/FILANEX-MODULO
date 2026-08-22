import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";
import { lineaSchema } from "./FacturaVenta.js";

export const ESTADOS_OS = ["recepcion", "en_curso", "finalizado", "entregado"];

const ordenServicioSchema = new Schema(
  {
    numero: { type: String, required: true, unique: true }, // SAT-000001
    aparato: { type: Schema.Types.ObjectId, ref: "Aparato" },
    aparatoDescripcion: String, // "HP Pavilion 15 · S/N ABC123" (desnormalizado)
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    clienteNombre: String,
    telefono: String,
    // Dónde se hace el servicio: el cliente trae el aparato a la tienda o el
    // técnico se desplaza al domicilio/local del cliente.
    tipoServicio: { type: String, enum: ["tienda", "domicilio"], default: "tienda" },
    direccionIntervencion: {
      calle: String,
      cp: String,
      ciudad: String,
      provincia: String,
    },
    averia: String, // síntoma/avería descrita por el cliente
    diagnostico: String, // diagnóstico y trabajo realizado por el técnico
    notasInternas: String, // no salen en impresos
    // Copia de los datos del aparato en el momento de la recepción (editables).
    accesorios: String,
    estadoFisico: String,
    garantia: { type: String, enum: ["sin_garantia", "en_garantia"], default: "sin_garantia" },
    garantiaHasta: Date,
    // Recepción digital: fotos del estado del aparato y firma del cliente
    // en tableta/móvil. Sustituye al resguardo firmado en papel.
    recepcionDigital: {
      fotos: { type: [String], default: [] }, // rutas /uploads/servicio/...
      firma: {
        nombre: String,
        dni: String,
        imagen: String, // ruta /uploads/firmas/...
        fecha: Date,
      },
    },
    estado: { type: String, enum: ESTADOS_OS, default: "recepcion" },
    fechaEntrada: { type: Date, default: Date.now },
    fechaEntregaPrevista: Date,
    // Presupuesto de venta del que nace la orden: sus líneas se cargan en
    // la orden al vincularlo y queda marcado aceptado/facturado con ella.
    presupuesto: { type: Schema.Types.ObjectId, ref: "Presupuesto" },
    presupuestoNumero: String, // desnormalizado (p.ej. "P-3") para listados
    lineas: { type: [lineaSchema], default: [] }, // mano de obra y piezas a facturar
    total: { type: Number, default: 0 }, // total con IVA de las líneas
    factura: { type: Schema.Types.ObjectId, ref: "FacturaVenta" },
    numeroFactura: String, // se rellena al generar la factura (borrador)
  },
  { timestamps: true }
);

export default modeloTenant("OrdenServicio", ordenServicioSchema);
