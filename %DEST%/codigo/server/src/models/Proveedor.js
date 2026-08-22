import { Schema, model } from "mongoose";

const proveedorSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    nombre: { type: String, required: true },
    nif: String, // puede faltar si el OCR no lo ha podido leer
    alias: [String], // variantes de nombre vistas en documentos OCR (matching difuso)
    email: String,
    telefono: String,
    iban: String, // para pagos por transferencia / remesas de pago
    banco: String,
    bic: String,
    direccion: {
      calle: String,
      cp: String,
      ciudad: String,
      provincia: String,
    },
    notas: String,
  },
  { timestamps: true }
);

export default model("Proveedor", proveedorSchema);
