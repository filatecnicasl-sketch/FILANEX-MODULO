// Registro de auditoría: quién hizo qué y cuándo dentro de cada empresa.
// Se guarda en la base de datos del propio tenant (modeloTenant), así cada
// empresa solo ve la actividad de sus usuarios.
import mongoose from "mongoose";
import { modeloTenant } from "./tenant.js";

const esquema = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId },
    nombre: { type: String, default: "" },
    email: { type: String, default: "" },
    metodo: { type: String, default: "" },
    ruta: { type: String, default: "" },
    resultado: { type: Number, default: 0 },
    detalle: { type: String, default: "" },
  },
  { timestamps: true, collection: "auditoria" }
);

esquema.index({ createdAt: -1 });
esquema.index({ usuario: 1, createdAt: -1 });

export const Auditoria = modeloTenant("Auditoria", esquema);
