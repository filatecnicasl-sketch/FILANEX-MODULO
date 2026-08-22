import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";
import { lineaSchema } from "./FacturaVenta.js";

export const ESTADOS_OT = ["recepcion", "en_curso", "finalizado", "entregado"];

const ordenTrabajoSchema = new Schema(
  {
    numero: { type: String, required: true, unique: true }, // OT-000001
    vehiculo: { type: Schema.Types.ObjectId, ref: "Vehiculo", index: true },
    matricula: { type: String, required: true, uppercase: true, trim: true, index: true },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente", index: true },
    clienteNombre: String,
    telefono: String,
    trabajos: { type: [String], default: [] }, // Chapa, Pintura, Mecánica...
    motivo: String, // descripción del trabajo
    notasInternas: String, // no salen en impresos
    km: Number,
    // Recepción digital: fotos del estado del vehículo y firma del cliente
    // en tableta/móvil. Sustituye al resguardo firmado en papel.
    recepcionDigital: {
      fotos: { type: [String], default: [] }, // rutas /uploads/taller/...
      firma: {
        nombre: String,
        dni: String,
        imagen: String, // ruta /uploads/firmas/...
        fecha: Date,
      },
    },
    estado: { type: String, enum: ESTADOS_OT, default: "recepcion", index: true },
    fechaEntrada: { type: Date, default: Date.now, index: true },
    fechaEntregaPrevista: Date,
    // Presupuesto de venta del que nace la orden: sus líneas se cargan en
    // la OT al vincularlo y queda marcado aceptado/facturado con ella.
    presupuesto: { type: Schema.Types.ObjectId, ref: "Presupuesto", index: true },
    presupuestoNumero: String, // desnormalizado (p.ej. "P-3") para listados
    lineas: { type: [lineaSchema], default: [] }, // mano de obra y materiales a facturar
    total: { type: Number, default: 0 }, // total con IVA de las líneas
    // Trabajo de compañía de seguros: la aseguradora lleva las condiciones
    // negociadas (precio hora MO, descuentos) que se aplican al facturar.
    aseguradora: { type: Schema.Types.ObjectId, ref: "Aseguradora", index: true },
    numeroSiniestro: String,
    facturarA: { type: String, enum: ["cliente", "aseguradora"], default: "cliente" },
    factura: { type: Schema.Types.ObjectId, ref: "FacturaVenta", index: true },
    numeroFactura: String, // se rellena al emitir la factura
    // Materiales cargados desde albaranes de compra (trazabilidad cruzada
    // con AlbaranCompra.ordenesTaller).
    albaranesCompra: [
      {
        albaran: { type: Schema.Types.ObjectId, ref: "AlbaranCompra" },
        numero: String,
        fecha: { type: Date, default: Date.now },
      },
    ],
    // Horas invertidas por operario en esta orden. Alimentan el informe
    // "horas facturadas vs invertidas" (Taller → Operarios).
    tiempos: {
      type: [
        {
          operario: { type: Schema.Types.ObjectId, ref: "Operario" },
          operarioNombre: String, // copia por si se borra el operario
          fecha: { type: Date, default: Date.now },
          horas: { type: Number, default: 0 },
          nota: String,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Índices compuestos para los listados más frecuentes.
ordenTrabajoSchema.index({ estado: 1, createdAt: -1 });
ordenTrabajoSchema.index({ cliente: 1, createdAt: -1 });
ordenTrabajoSchema.index({ matricula: 1, createdAt: -1 });

export default modeloTenant("OrdenTrabajo", ordenTrabajoSchema);
