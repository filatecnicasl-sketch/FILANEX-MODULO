import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Campaña de precios de una comercializadora (la "tarifa" que ofrecen al
// canal para vender en los estudios de ahorro). Las campañas nacen
// normalmente del OCR del PDF que manda la comercializadora y quedan
// "pendientes" hasta que alguien las revisa y las publica: solo las
// publicadas se pueden usar en los estudios.
//
// Los precios siguen la misma estructura que la propuesta del estudio:
// energía en €/kWh (precio único o promedio de los tramos) y potencia en
// €/kW·año. Si la campaña los trae en €/kW·día, el OCR los convierte
// (× 365) al leerlos.
const campanaPreciosSchema = new Schema(
  {
    comercializadora: { type: Schema.Types.ObjectId, ref: "Comercializadora" },
    comercializadoraNombre: String,
    tipo: { type: String, enum: ["luz", "gas"], default: "luz" },
    nombre: String, // nombre comercial de la campaña
    tarifa: String, // 2.0TD, 3.0TD, RL.2...
    vigenciaDesde: Date,
    vigenciaHasta: Date,

    // Término de energía (€/kWh). precioEnergia es el que usan los
    // estudios; los tramos quedan como detalle informativo.
    precioEnergia: { type: Number, default: 0 },
    precioEnergiaPunta: { type: Number, default: 0 },
    precioEnergiaLlano: { type: Number, default: 0 },
    precioEnergiaValle: { type: Number, default: 0 },

    // Término de potencia (€/kW·año), solo luz.
    precioPotenciaPunta: { type: Number, default: 0 },
    precioPotenciaValle: { type: Number, default: 0 },

    mantenimiento: { type: Number, default: 0 }, // €/mes, informativo
    descuento: String, // texto libre: "10 % en el término de energía"

    estado: {
      type: String,
      enum: ["pendiente", "publicada", "descartada"],
      default: "pendiente",
    },
    origen: { type: String, enum: ["manual", "ocr", "correo"], default: "manual" },
    // Cuando la campaña llegó por correo: de qué mensaje salió (para poder
    // localizarlo en el buzón si hay que revisarlo).
    correo: {
      messageId: String,
      asunto: String,
      remitente: String,
      fecha: Date,
      fichero: String, // nombre del adjunto del que se leyó
    },
    notas: String,
  },
  { timestamps: true }
);

campanaPreciosSchema.index({ estado: 1 });
campanaPreciosSchema.index({ comercializadora: 1 });

export default modeloTenant("CampanaPrecios", campanaPreciosSchema);
