import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Tipos de aparato habituales en un SAT de informática/electrónica.
export const TIPOS_APARATO = [
  "pc_sobremesa",
  "portatil",
  "movil",
  "tablet",
  "monitor",
  "impresora",
  "otro",
];

const aparatoSchema = new Schema(
  {
    // Código interno auto (AP-000001): identifica el aparato aunque no tenga
    // nº de serie (habitual en equipos de empresa o montados a piezas).
    codigo: { type: String, unique: true },
    tipo: { type: String, enum: TIPOS_APARATO, default: "otro" },
    marca: String,
    modelo: String,
    numeroSerie: { type: String, trim: true }, // S/N del fabricante
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    clienteNombre: String, // desnormalizado para listados rápidos
    accesorios: String, // "cable de carga, funda, mando…"
    estadoFisico: String, // desperfectos visibles declarados en el alta
    garantiaHasta: Date,
    notas: String,
    // Historial del aparato: una entrada por cada recepción (orden de
    // servicio), con las fotos del estado tomadas al entrar.
    historial: {
      type: [
        {
          fecha: Date,
          numeroOrden: String,
          orden: { type: Schema.Types.ObjectId, ref: "OrdenServicio" },
          motivo: String,
          fotos: { type: [String], default: [] }, // rutas /uploads/servicio/...
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

aparatoSchema.index({ numeroSerie: 1 });

export default modeloTenant("Aparato", aparatoSchema);
