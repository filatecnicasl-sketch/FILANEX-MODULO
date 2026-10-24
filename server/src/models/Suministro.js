import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Normaliza un CUPS: mayúsculas, sin espacios ni guiones.
export function normalizarCups(cups) {
  return String(cups ?? "").replace(/[\s-]/g, "").toUpperCase();
}

// Punto de suministro (luz o gas). Es al módulo de energía lo que el
// vehículo al taller: el "activo" del cliente, identificado por su CUPS.
const suministroSchema = new Schema(
  {
    cups: {
      type: String,
      required: true,
      trim: true,
      set: normalizarCups,
    },
    tipo: { type: String, enum: ["luz", "gas"], required: true },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    clienteNombre: String, // desnormalizado para listados rápidos
    comercializadora: { type: Schema.Types.ObjectId, ref: "Comercializadora" },
    comercializadoraNombre: String, // desnormalizado
    canalDistribucion: { type: Schema.Types.ObjectId, ref: "CanalDistribucion" },
    canalDistribucionNombre: String, // desnormalizado
    // Dirección del suministro (puede ser distinta a la fiscal del cliente).
    direccion: {
      calle: String,
      cp: String,
      ciudad: String,
      provincia: String,
    },
    tarifa: String, // 2.0TD, 3.0TD, RL1… (luz) o peaje 3.1/3.2/3.3/3.4 (gas)
    potenciaPunta: { type: Number, default: 0 }, // kW contratados (luz 2.0TD: P1)
    potenciaValle: { type: Number, default: 0 }, // kW contratados (luz 2.0TD: P2)
    // Tarifas de alta tensión (3.0TD, 6.XTD): 6 periodos de potencia que
    // pueden ser distintos (propuesta ROLUSUR 16/10). En 2.0TD se siguen
    // usando punta/valle.
    potencias: [
      { type: Number, min: 0 }, // P1…P6 en kW
    ],
    consumoAnual: { type: Number, default: 0 }, // kWh/año (dato del estudio)
    presupuestoAnual: { type: Number, default: 0 }, // €/año objetivo: alimenta la desviación
    // Ciclo del suministro (propuesta ROLUSUR 15/10): "en_tramite" mientras
    // el alta/cambio de comercializadora está en proceso; cuando ya está
    // activo en la comercializadora se pasa a "activo" y se pone la fecha de
    // alta. "baja" cuando el suministro deja de existir.
    estado: { type: String, enum: ["activo", "en_tramite", "baja"], default: "activo" },
    fechaAlta: Date, // fecha de alta con la comercializadora actual
    fechaFin: Date, // fin del contrato: alimenta las alertas de renovación
    // Documentación adjunta del suministro: contrato, factura que motivó el
    // alta, burofax de la distribuidora… (igual que los adjuntos de citas).
    documentos: [
      {
        url: String,
        nombre: String,
        fecha: { type: Date, default: Date.now },
      },
    ],
    notas: String,
  },
  { timestamps: true }
);

suministroSchema.index({ cups: 1 }, { unique: true });
// Búsqueda habitual: por cliente o por comercializadora.
suministroSchema.index({ cliente: 1 });
suministroSchema.index({ comercializadora: 1 });

export default modeloTenant("Suministro", suministroSchema);
