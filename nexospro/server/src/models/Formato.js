import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

const elementSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ["text", "field", "textarea", "checkbox", "image", "rect", "signature", "table"],
      required: true,
    },
    x: Number,
    y: Number,
    w: Number,
    h: Number,
    text: String,
    fieldKey: String,
    label: String,
    fontSize: { type: Number, default: 9 },
    bold: { type: Boolean, default: false },
    align: { type: String, default: "left" },
    color: { type: String, default: "#000000" },
    background: { type: String, default: "" },
    borderColor: { type: String, default: "#000000" },
    borderWidth: { type: Number, default: 1 },
    boxed: { type: Boolean, default: false },
    src: String,
    rows: Number,
    columns: [Schema.Types.Mixed],
    headerFontSize: Number,
    showRowNumbers: Boolean,
    groupTitle: String,
    sublabel: String,
  },
  { _id: false, strict: false }
);

const formatoSchema = new Schema(
  {
    tipoDocumento: {
      type: String,
      required: true,
      enum: [
        "factura-venta",
        "presupuesto-venta",
        "albaran-venta",
        "pedido-cliente",
        "factura-compra",
        "presupuesto-compra",
        "albaran-compra",
        "pedido-proveedor",
        "parte-taller",
        "entrada-taller",
        "parte-sat",
        "entrada-sat",
        "ticket-gasto",
        "generico",
      ],
    },
    nombre: { type: String, required: true },
    porDefecto: { type: Boolean, default: false },
    page: {
      size: { type: String, default: "A4" },
      orientation: { type: String, default: "portrait" },
    },
    elements: { type: [elementSchema], default: [] },
    cssExtra: { type: String, default: "" },
  },
  { timestamps: true }
);

// Una sola plantilla por defecto por tipo de documento dentro de la empresa.
formatoSchema.index({ tipoDocumento: 1, porDefecto: 1 });

export default modeloTenant("Formato", formatoSchema);
