// Sesión de caja del TPV: apertura con fondo, cierre con arqueo
// (esperado vs contado). Solo puede haber una abierta por empresa.
import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

const cajaSesionSchema = new Schema(
  {
    estado: { type: String, enum: ["abierta", "cerrada"], default: "abierta", index: true },
    apertura: {
      fecha: { type: Date, default: Date.now },
      fondo: { type: Number, default: 0 }, // cambio con el que se abre
      usuario: String,
    },
    cierre: {
      fecha: Date,
      usuario: String,
      conteoEfectivo: Number, // lo que el cajero cuenta en el cajón
      esperadoEfectivo: Number, // fondo + ventas efectivo − devoluciones efectivo
      totalEfectivo: Number, // ventas en efectivo de la sesión
      totalTarjeta: Number,
      totalOtro: Number,
      totalVentas: Number,
      numeroTickets: Number,
      diferencia: Number, // conteo − esperado
      notas: String,
    },
  },
  { timestamps: true }
);

export default modeloTenant("CajaSesion", cajaSesionSchema);
