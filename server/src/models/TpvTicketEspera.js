import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Ticket "aparcado" en el TPV: una venta a medias que el dependiente deja en
// espera (el cliente se va a por el monedero, llega otro cliente…) y recupera
// después. No es un documento fiscal: al cobrarse se convierte en F2.
const tpvTicketEsperaSchema = new Schema(
  {
    cajaSesion: { type: Schema.Types.ObjectId, ref: "CajaSesion", required: true, index: true },
    nombre: { type: String, default: "" }, // referencia libre ("cliente gorra roja")
    lineas: [
      {
        articulo: { type: Schema.Types.ObjectId, ref: "Articulo" },
        descripcion: { type: String, required: true },
        cantidad: { type: Number, default: 1 },
        precioUnitario: { type: Number, default: 0 },
        iva: { type: Number, default: 21 },
        descuento: { type: Number, default: 0 },
      },
    ],
    usuario: String,
    fecha: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default modeloTenant("TpvTicketEspera", tpvTicketEsperaSchema);
