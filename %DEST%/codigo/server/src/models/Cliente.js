import { Schema, model } from "mongoose";

const clienteSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    nombre: { type: String, required: true },
    nif: { type: String, required: true },
    email: String,
    telefono: String,
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
    notas: String,
  },
  { timestamps: true }
);

export default model("Cliente", clienteSchema);
