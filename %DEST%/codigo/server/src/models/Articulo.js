import { Schema, model } from "mongoose";

const articuloSchema = new Schema(
  {
    empresa: { type: Schema.Types.ObjectId, ref: "Empresa" },
    tipo: { type: String, enum: ["articulo", "servicio"], default: "articulo" },
    codigo: String, // código propio (ART-000001 si se deja vacío)
    descripcion: { type: String, required: true }, // nombre corto
    detalle: String, // descripción larga
    unidad: { type: String, default: "ud" }, // ud, m2, h, kg…
    precioCompra: { type: Number, default: 0 },
    precioVenta: { type: Number, default: 0 },
    iva: { type: Number, default: 21 },
    proveedor: { type: Schema.Types.ObjectId, ref: "Proveedor" }, // proveedor habitual
    referenciaProveedor: String, // código del proveedor
    codigoBarras: String, // EAN / QR
    origen: { type: String, enum: ["manual", "ocr"], default: "manual" }, // badge AUTO
  },
  { timestamps: true }
);

export default model("Articulo", articuloSchema);
