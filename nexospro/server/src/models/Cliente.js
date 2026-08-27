import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

const clienteSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    // Código de ficha (el del programa antiguo al importar; se asigna solo al crear).
    codigo: { type: String, index: true, sparse: true },
    fechaAlta: { type: Date, default: Date.now, index: true },
    nombre: { type: String, required: true, index: true },
    nif: { type: String, required: true, index: true },
    email: { type: String, index: true, sparse: true },
    telefono: { type: String, index: true, sparse: true },
    iban: String, // para domiciliación en remesas SEPA
    banco: String,
    bic: String,
    direccion: {
      calle: String,
      cp: String,
      ciudad: String,
      provincia: String,
    },
    // Entrega distinta de la fiscal (obras, naves, delegaciones…)
    direccionEntrega: {
      calle: String,
      ciudad: String,
      cp: String,
    },
    esAdministracionPublica: { type: Boolean, default: false }, // factura electrónica FACe
    comunicaciones: {
      whatsapp: {
        autorizado: { type: Boolean, default: false },
        fecha: Date,
        origen: String,
        revocadoAt: Date,
      },
    },
    notas: String,
  },
  { timestamps: true }
);

// Índice de texto para búsquedas por nombre, NIF o código.
clienteSchema.index({ nombre: "text", nif: "text", codigo: "text" });

export default modeloTenant("Cliente", clienteSchema);
