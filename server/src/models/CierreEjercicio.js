import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Cierre de ejercicio contable. Al cerrar un año:
//  - se guarda el resumen fiscal (bases/cuotas por trimestre, emitidas y recibidas)
//  - el año queda bloqueado: no se pueden crear, modificar ni borrar
//    documentos fiscales con fecha de ese ejercicio (facturas, tickets TPV,
//    facturas de compra). Las correcciones se hacen con rectificativas del
//    ejercicio en curso, como manda la AEAT.
// Reabrir queda registrado con usuario y fecha (auditoría).
const totalesSchema = new Schema(
  {
    base: { type: Number, default: 0 },
    cuota: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    numero: { type: Number, default: 0 }, // nº de documentos
  },
  { _id: false }
);

const cierreEjercicioSchema = new Schema(
  {
    ano: { type: Number, required: true },
    estado: { type: String, enum: ["cerrado", "reabierto"], default: "cerrado", index: true },
    cerradoEn: { type: Date, default: Date.now },
    cerradoPor: String,
    reabiertoEn: Date,
    reabiertoPor: String,
    resumen: {
      trimestres: [
        {
          trimestre: Number,
          emitidas: totalesSchema,
          recibidas: totalesSchema,
        },
      ],
      emitidas: totalesSchema, // totales del año (incluye tickets TPV)
      recibidas: totalesSchema,
      // Detalle de la facturación de venta por tipo
      facturas: { type: Number, default: 0 }, // F1
      tickets: { type: Number, default: 0 }, // F2 (TPV)
      rectificativas: { type: Number, default: 0 },
    },
    notas: String,
  },
  { timestamps: true }
);

cierreEjercicioSchema.index({ ano: 1 }, { unique: true });

export default modeloTenant("CierreEjercicio", cierreEjercicioSchema);
