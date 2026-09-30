import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Trámite de energía: alta, cambio de comercializadora, cambio de titular
// o baja de un punto de suministro. Refleja el circuito real de la agencia
// con la comercializadora: se abre con la documentación, se envía, queda en
// trámite con la distribuidora y termina activado (con efecto sobre el
// suministro), rechazado o cancelado.
const tramiteSchema = new Schema(
  {
    tipo: {
      type: String,
      enum: ["alta", "cambio", "titular", "baja"],
      required: true,
    },
    suministro: { type: Schema.Types.ObjectId, ref: "Suministro", required: true },
    cups: String, // desnormalizado para listados
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    clienteNombre: String,
    comercializadoraOrigen: String, // de dónde viene (foto al abrir el trámite)
    comercializadoraDestino: { type: Schema.Types.ObjectId, ref: "Comercializadora" },
    comercializadoraDestinoNombre: String,
    nuevoTitular: { type: Schema.Types.ObjectId, ref: "Cliente" }, // solo cambio de titular
    nuevoTitularNombre: String,
    estado: {
      type: String,
      enum: ["documentacion", "enviado", "en_tramite", "activado", "rechazado", "cancelado"],
      default: "documentacion",
    },
    fechaSolicitud: { type: Date, default: Date.now },
    fechaEnvio: Date,
    fechaPrevista: Date, // activación prevista con la comercializadora
    fechaActivacion: Date, // real: cuando surte efecto
    notas: String,
    // Historial del circuito: cada cambio de estado queda apuntado.
    historia: [
      {
        fecha: { type: Date, default: Date.now },
        estado: String,
        nota: String,
      },
    ],
  },
  { timestamps: true }
);

tramiteSchema.index({ suministro: 1 });
tramiteSchema.index({ estado: 1 });
tramiteSchema.index({ createdAt: -1 });

export default modeloTenant("Tramite", tramiteSchema);
