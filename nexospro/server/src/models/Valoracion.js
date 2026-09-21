import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";
import { normalizarMatricula } from "../services/validacion.js";

export const ESTADOS_VALORACION = ["pendiente", "valorado", "aprobado", "rechazado"];

// Cada partida es un concepto de la peritación con su importe. Las de mano
// de obra pueden llevar tipo (chapa/pintura/mecanica) y horas; el importe se
// calcula con el precio por hora configurado en la empresa.
const lineaValoracionSchema = new Schema(
  {
    descripcion: { type: String, required: true },
    tipo: { type: String, enum: ["chapa", "pintura", "mecanica", "material", "otro"], default: "otro" },
    horas: Number,
    importe: { type: Number, default: 0 },
  },
  { _id: false }
);

const valoracionSchema = new Schema(
  {
    numero: { type: String, required: true, unique: true }, // PER-000001
    vehiculo: { type: Schema.Types.ObjectId, ref: "Vehiculo" },
    matricula: { type: String, required: true, uppercase: true, trim: true, set: normalizarMatricula },
    marca: String,   // copia del dato del vehículo en el momento de valorar
    modelo: String,
    bastidor: String, // nº de bastidor (VIN)
    clienteNombre: String,
    telefono: String,
    compania: String, // nombre de la compañía (se rellena solo al elegir aseguradora)
    aseguradora: { type: Schema.Types.ObjectId, ref: "Aseguradora" }, // ficha con condiciones
    numeroSiniestro: String,
    fechaSiniestro: Date,
    compromiso: { type: Boolean, default: false }, // compromiso de reparación de la compañía
    lineas: { type: [lineaValoracionSchema], default: [] },
    total: { type: Number, default: 0 }, // suma de líneas (valoración)
    estado: { type: String, enum: ESTADOS_VALORACION, default: "pendiente" },
    observaciones: String,
    orden: { type: Schema.Types.ObjectId, ref: "OrdenTrabajo" }, // OT generada
    numeroOrden: String,
  },
  { timestamps: true }
);

export default modeloTenant("Valoracion", valoracionSchema);
