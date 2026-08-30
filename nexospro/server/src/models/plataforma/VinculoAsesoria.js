// Vínculo empresa ↔ asesoría. Vive en la BD plataforma: es la única puerta
// por la que un tenant (asesoría) puede LEER documentos de otro tenant
// (empresa cliente). Sin este registro en estado "activo" no hay acceso
// cruzado posible; la autorización RGPD firmada queda aquí registrada.
import { Schema, model } from "mongoose";

export const ESTADOS_VINCULO = ["pendiente", "activo", "revocado"];

const vinculoAsesoriaSchema = new Schema(
  {
    asesoria: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    cliente: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },

    estado: { type: String, enum: ESTADOS_VINCULO, default: "pendiente", index: true },

    // Qué documentos autoriza compartir la empresa (se elige al firmar).
    compartir: {
      ventas: { type: Boolean, default: true },
      compras: { type: Boolean, default: true },
      tickets: { type: Boolean, default: true },
    },

    // Firma digital de la autorización: quién aceptó, cuándo, desde dónde y
    // qué versión del texto tenía delante.
    autorizacion: {
      versionTexto: String,
      fechaAceptacion: Date,
      usuarioEmail: String,
      ip: String,
    },
    revocacion: {
      fecha: Date,
      usuarioEmail: String,
    },

    // Cliente de cartera creado automáticamente en la BD de la asesoría al
    // activarse el vínculo (ObjectId en la BD de la asesoría).
    clienteCarteraId: { type: Schema.Types.ObjectId },

    origen: { type: String, enum: ["codigo", "plataforma"], default: "codigo" },
    notas: String,
  },
  { timestamps: true }
);

// Una empresa solo puede tener un vínculo con una misma asesoría.
vinculoAsesoriaSchema.index({ asesoria: 1, cliente: 1 }, { unique: true });

export default model("VinculoAsesoria", vinculoAsesoriaSchema);
