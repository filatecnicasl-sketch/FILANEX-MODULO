// Empresa cliente de la plataforma (tenant). Vive en la BD plataforma, no
// en las BD de negocio: es el registro maestro que relaciona cuentas con su
// base de datos.
import { Schema, model } from "mongoose";

const ESTADOS_TENANT = ["activo", "inactivo", "suspendido", "demo", "prueba_finalizada"];
const PLANES_TENANT = ["basico", "profesional", "empresarial"];

const tenantSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true }, // p.ej. "local", "taller-perez"
    nombre: { type: String, required: true },
    dbName: { type: String, required: true, unique: true }, // BD de negocio de la empresa

    // Datos comerciales del cliente
    nif: { type: String },
    direccion: { type: String },
    codigoPostal: { type: String },
    ciudad: { type: String },
    provincia: { type: String },
    telefono: { type: String },
    emailContacto: { type: String },

    // Control de licencia
    estado: { type: String, enum: ESTADOS_TENANT, default: "activo" },
    plan: { type: String, enum: PLANES_TENANT, default: "basico" },
    importeMensual: { type: Number, default: 0 },
    fechaAlta: { type: Date, default: Date.now },
    fechaRenovacion: { type: Date },
    fechaCaducidad: { type: Date },

    // Límites del plan
    limiteUsuarios: { type: Number, default: 1 },
    limiteFacturasMes: { type: Number, default: 100 },
    limiteAlmacenamientoMB: { type: Number, default: 1024 },

    // Módulos contratados por el cliente (se sincronizan con Empresa)
    modulos: { type: [String], default: [] },

    // Token del agente de copia local: permite al PC del cliente descargar
    // su última copia de seguridad sin sesión interactiva. Se genera desde
    // Ajustes → Copias y se puede regenerar (invalida el anterior).
    copiaToken: { type: String, index: true, sparse: true },
    copiaTokenFecha: { type: Date },

    // Código público de asesoría (p.ej. "ASC-7F3K2P"): las empresas cliente
    // lo introducen en Ajustes → Asesoría para vincularse y compartir sus
    // documentos fiscales. Solo lo tienen tenants con el módulo asesoría.
    codigoAsesoria: { type: String, unique: true, sparse: true },

    // Notas internas para el administrador de la plataforma
    notas: { type: String },
  },
  { timestamps: true }
);

export const ESTADOS = ESTADOS_TENANT;
export const PLANES = PLANES_TENANT;
export default model("Tenant", tenantSchema);

