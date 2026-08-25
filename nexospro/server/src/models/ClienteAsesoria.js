import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Cliente de la cartera de una ASESORÍA (módulo "asesoria").
// No es el cliente del ERP: es la empresa o autónomo a quien la asesoría lleva
// la contabilidad, la fiscalidad y/o la laboral. Puede ser un cliente que no
// usa Filanex en absoluto (la documentación llega por escáner o foto) o uno
// que también tiene su propia instalación.

export const FORMAS_JURIDICAS = [
  "autonomo",
  "sl",
  "slu",
  "sa",
  "cb",
  "cooperativa",
  "asociacion",
  "comunidad_bienes",
  "otra",
];

export const REGIMENES_IRPF = [
  "estimacion_directa_simplificada",
  "estimacion_directa_normal",
  "estimacion_objetiva",
  "agricultura_ganaderia",
];

// Modelos fiscales que la asesoría presenta por el cliente. Es una lista
// cerrada de los habituales: se guarda tal cual el código.
export const MODELOS_FISCALES = [
  "303", // IVA trimestral
  "390", // Resumen anual de IVA
  "130", // Pagos fraccionados IRPF (estimación directa)
  "131", // Pagos fraccionados IRPF (módulos)
  "100", // Renta
  "111", // Retenciones trabajo y profesionales
  "190", // Resumen anual retenciones trabajo
  "115", // Retenciones arrendamientos
  "180", // Resumen anual retenciones alquileres
  "123", // Retenciones capital
  "349", // Operaciones intracomunitarias
  "347", // Operaciones con terceros
  "200", // Impuesto de sociedades
  "202", // Pagos a cuenta sociedades
  "036", // Censo (altas y variaciones)
];

const clienteAsesoriaSchema = new Schema(
  {
    codigo: { type: String, required: true, trim: true },
    fechaAlta: { type: Date, default: () => new Date() },
    nombre: { type: String, required: true, trim: true },
    nif: { type: String, required: true, trim: true },
    formaJuridica: { type: String, enum: FORMAS_JURIDICAS, default: "sl" },
    regimenIrpf: { type: String, enum: REGIMENES_IRPF },
    actividad: { type: String, trim: true },
    epigrafe: { type: String, trim: true },
    telefono: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    direccion: {
      calle: String,
      cp: String,
      ciudad: String,
      provincia: String,
    },
    personaContacto: { type: String, trim: true },
    // Qué le lleva la asesoría y qué modelos presenta
    areas: {
      fiscal: { type: Boolean, default: true },
      contable: { type: Boolean, default: true },
      laboral: { type: Boolean, default: false },
    },
    modelos: { type: [String], default: ["303", "390"] },
    numeroEmpleados: { type: Number, default: 0, min: 0 },
    cuotaMensual: { type: Number, default: 0, min: 0 },
    notas: String,
    activo: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

clienteAsesoriaSchema.index({ nombre: "text", nif: "text", codigo: "text" });
// No puede haber dos clientes de cartera con el mismo NIF (salvo el
// provisional de alta rápida, que lleva el código y es único por sí mismo).
clienteAsesoriaSchema.index({ nif: 1 }, { unique: true });
clienteAsesoriaSchema.index({ codigo: 1 }, { unique: true });

clienteAsesoriaSchema.pre("validate", function () {
  if (this.nif) this.nif = this.nif.toUpperCase().replace(/[\s.-]/g, "");
});

export default modeloTenant("ClienteAsesoria", clienteAsesoriaSchema);
