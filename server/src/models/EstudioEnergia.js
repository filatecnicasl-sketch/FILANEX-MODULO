import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Estudio de ahorro: la herramienta comercial del canal. Se parte de la
// factura del cliente (consumo y potencias actuales) y se le presenta una
// propuesta con una de nuestras comercializadoras. El coste anual se calcula
// con los componentes (energía + potencia) o se teclea directamente; el
// ahorro sale de la diferencia. Si el cliente acepta, el estudio abre solo
// el trámite de alta/cambio.
const estudioEnergiaSchema = new Schema(
  {
    suministro: { type: Schema.Types.ObjectId, ref: "Suministro" },
    cups: String, // desnormalizado (puede no existir aún como suministro)
    tipo: { type: String, enum: ["luz", "gas"], default: "luz" },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    clienteNombre: String,

    // Situación actual.
    comercializadoraActual: String,
    tarifaActual: String,
    consumoAnual: { type: Number, default: 0 }, // kWh/año
    potenciaPunta: { type: Number, default: 0 }, // kW (luz)
    potenciaValle: { type: Number, default: 0 }, // kW (luz)
    precioEnergiaActual: { type: Number, default: 0 }, // €/kWh
    precioPotenciaPuntaActual: { type: Number, default: 0 }, // €/kW·año
    precioPotenciaValleActual: { type: Number, default: 0 }, // €/kW·año
    costeAnualActual: { type: Number, default: 0 }, // calculado o manual

    // Propuesta.
    comercializadora: { type: Schema.Types.ObjectId, ref: "Comercializadora" },
    comercializadoraNombre: String,
    tarifaPropuesta: String,
    precioEnergiaPropuesta: { type: Number, default: 0 },
    precioPotenciaPuntaPropuesta: { type: Number, default: 0 },
    precioPotenciaVallePropuesta: { type: Number, default: 0 },
    costeAnualPropuesta: { type: Number, default: 0 }, // calculado o manual

    ahorroAnual: { type: Number, default: 0 }, // actual - propuesta
    ahorroPorcentaje: { type: Number, default: 0 },

    estado: {
      type: String,
      enum: ["borrador", "enviado", "aceptado", "rechazado"],
      default: "borrador",
    },
    fechaEnvio: Date,
    fechaRespuesta: Date,
    tramite: { type: Schema.Types.ObjectId, ref: "Tramite" }, // el que abrió al aceptar
    notas: String,
  },
  { timestamps: true }
);

estudioEnergiaSchema.index({ estado: 1 });
estudioEnergiaSchema.index({ cliente: 1 });
estudioEnergiaSchema.index({ createdAt: -1 });

// Coste anual: término de energía + término de potencia (punta y valle).
// Gas: solo término de energía (el fijo va dentro del precio de potencia
// punta si se quiere desglosar, o se teclea el coste manual).
export function calcularCosteAnual(consumoAnual, precioEnergia, potenciaPunta, precioPotenciaPunta, potenciaValle, precioPotenciaValle) {
  const e = (Number(consumoAnual) || 0) * (Number(precioEnergia) || 0);
  const p1 = (Number(potenciaPunta) || 0) * (Number(precioPotenciaPunta) || 0);
  const p2 = (Number(potenciaValle) || 0) * (Number(precioPotenciaValle) || 0);
  return Math.round((e + p1 + p2) * 100) / 100;
}

export default modeloTenant("EstudioEnergia", estudioEnergiaSchema);
