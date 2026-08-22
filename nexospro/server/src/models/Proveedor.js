import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

const proveedorSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    // Código de ficha (el del programa antiguo al importar; se asigna solo al crear).
    codigo: String,
    fechaAlta: { type: Date, default: Date.now },
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

export default modeloTenant("Proveedor", proveedorSchema);
