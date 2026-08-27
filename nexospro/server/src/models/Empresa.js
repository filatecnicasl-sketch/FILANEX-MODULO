import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

const direccionSchema = new Schema(
  {
    calle: String,
    cp: String,
    ciudad: String,
    provincia: String,
  },
  { _id: false }
);

const empresaSchema = new Schema(
  {
    nombre: { type: String, required: true },
    nif: { type: String, required: true },
    telefono: String,
    email: String,
    direccion: direccionSchema,
    logoUrl: String,
    // Pantalla que se abre al entrar en la aplicación ("panel" o un módulo activo).
    moduloInicio: { type: String, default: "panel" },
    series: [
      {
        nombre: { type: String, required: true },
        prefijo: { type: String, default: "" },
        siguienteNumero: { type: Number, default: 1 },
      },
    ],
    // Series de numeración por tipo de documento (pantalla Sistema → Series).
    // El número emitido tiene el formato `${nombre}-${n}` (ej. A-12).
    seriesVenta: [
      {
        nombre: { type: String, required: true },
        defecto: { type: Boolean, default: false },
        proxPresupuesto: { type: Number, default: 1 },
        proxAlbaran: { type: Number, default: 1 },
        proxFactura: { type: Number, default: 1 },
      },
    ],
    seriesCompra: [
      {
        nombre: { type: String, required: true },
        defecto: { type: Boolean, default: false },
        proxPresupuesto: { type: Number, default: 1 },
        proxPedido: { type: Number, default: 1 },
        proxAlbaran: { type: Number, default: 1 },
      },
    ],
    // Métodos de pago configurables (Sistema → Series). Si un método tiene
    // "plazos" (días), la factura genera esos vencimientos a partes iguales:
    // p.ej. plazos [30, 60, 90] = pago aplazado en tres tercios.
    metodosPago: [
      {
        nombre: { type: String, required: true },
        plazos: { type: [Number], default: [] },
        defecto: { type: Boolean, default: false },
      },
    ],
    verifactu: {
      modalidad: { type: String, enum: ["VERIFACTU", "NO_VERIFACTU"], default: "VERIFACTU" },
      certificadoRef: String,
    },
    // Certificado electrónico VeriFactu de ESTA empresa (multiempresa: cada
    // una guarda el suyo). El archivo vive en certificados/<slug>-aeat.pfx y
    // la contraseña se guarda cifrada (AES-256-GCM con CLAVE_CERTS).
    certificado: {
      ruta: String,
      passCifrada: String,
    },
    sepa: {
      iban: String,          // cuenta de cobro de la empresa
      idAcreedor: String,    // identificador de acreedor SEPA (ES + sufijo + NIF)
    },
    // Preferencias de avisos (pantalla Sistema → Notificaciones).
    notificaciones: {
      vencidas: { type: Boolean, default: true },      // facturas vencidas sin cobrar
      proximas: { type: Boolean, default: true },      // facturas próximas a vencer
      diasProximas: { type: Number, default: 7 },      // margen en días
      ocr: { type: Boolean, default: true },           // documentos OCR pendientes de validar
      agendaEventos: { type: Boolean, default: true },
      minutosAgenda: { type: Number, default: 15 },
    },
    agendaSeparadaMigrada: { type: Boolean, default: false },
    modulos: { type: [String], default: [] }, // módulos activados (licencia): taller, logistica...
    contadores: {
      presupuesto: { type: Number, default: 1 },
      albaranVenta: { type: Number, default: 1 },
      ordenTrabajo: { type: Number, default: 1 },
      ordenServicio: { type: Number, default: 1 }, // SAT-000001
      aparato: { type: Number, default: 1 }, // AP-000001
      valoracion: { type: Number, default: 1 },
      pedidoCompra: { type: Number, default: 1 },
      albaranCompra: { type: Number, default: 1 },
      presupuestoCompra: { type: Number, default: 1 },
      articulo: { type: Number, default: 1 },
    },
  },
  { timestamps: true }
);

export default modeloTenant("Empresa", empresaSchema);
