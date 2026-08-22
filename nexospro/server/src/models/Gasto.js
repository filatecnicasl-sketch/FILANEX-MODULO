import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";

// Gastos de bolsillo justificados con TICKET (factura simplificada):
// combustible, parking, dietas, pequeño material… Se separan de las facturas
// de compra por dos razones fiscales:
//
//  1. Un ticket normal NO permite deducir el IVA: solo si lleva los datos
//     fiscales del comprador (factura simplificada cualificada). Por eso hay
//     un aviso cuando el ticket no lleva el NIF de la empresa.
//  2. Aunque la factura sea correcta, hay gastos con el IVA limitado por ley
//     (combustible y peajes de turismo al 50 %, atenciones a clientes al 0 %).
//     La categoría decide el porcentaje deducible por defecto, y el usuario
//     lo puede cambiar caso por caso.

// Porcentaje de IVA deducible por defecto según la categoría del gasto.
export const CATEGORIAS_GASTO = [
  { clave: "combustible", etiqueta: "Combustible", deducible: 50, nota: "Turismo: 50 % salvo que se pruebe uso exclusivo" },
  { clave: "peaje_parking", etiqueta: "Peajes y parking", deducible: 50, nota: "Mismo criterio que el vehículo al que sirve" },
  { clave: "transporte", etiqueta: "Transporte y viajes", deducible: 100, nota: "Billetes, taxi, tren, avión" },
  { clave: "dietas", etiqueta: "Dietas y comidas", deducible: 100, nota: "Deducible solo si es gasto de la actividad y está justificado" },
  { clave: "atenciones", etiqueta: "Atenciones a clientes", deducible: 0, nota: "Regalos e invitaciones: IVA no deducible" },
  { clave: "material", etiqueta: "Pequeño material", deducible: 100, nota: "Consumibles y herramienta menor" },
  { clave: "suministros", etiqueta: "Suministros", deducible: 100, nota: "Luz, agua, teléfono del local" },
  { clave: "reparaciones", etiqueta: "Reparaciones y mantenimiento", deducible: 100, nota: "" },
  { clave: "alojamiento", etiqueta: "Alojamiento", deducible: 100, nota: "Hoteles en desplazamientos de trabajo" },
  { clave: "otros", etiqueta: "Otros gastos", deducible: 100, nota: "" },
];

export const CLAVES_CATEGORIA = CATEGORIAS_GASTO.map((c) => c.clave);

export function deduciblePorCategoria(categoria) {
  return CATEGORIAS_GASTO.find((c) => c.clave === categoria)?.deducible ?? 100;
}

export const FORMAS_PAGO_GASTO = ["efectivo", "tarjeta_empresa", "tarjeta_personal", "transferencia", "otro"];

const gastoSchema = new Schema(
  {
    fecha: { type: Date, required: true, default: Date.now, index: true },
    // El comercio del ticket. Se guarda como texto porque muchos de estos
    // gastos son de sitios de paso que no interesa dar de alta como proveedor.
    comercio: { type: String, required: true, trim: true },
    nifComercio: { type: String, uppercase: true, trim: true },
    proveedor: { type: Schema.Types.ObjectId, ref: "Proveedor" }, // opcional
    concepto: String,
    categoria: { type: String, enum: CLAVES_CATEGORIA, default: "otros", index: true },

    base: { type: Number, default: 0 },
    tipoIva: { type: Number, default: 21 },
    cuotaIva: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    // ¿El ticket lleva los datos fiscales de la empresa? Sin ellos el IVA no
    // se puede deducir aunque la categoría lo permita.
    conDatosFiscales: { type: Boolean, default: false },
    // Porcentaje de IVA deducible aplicado (0, 50 o 100 normalmente).
    ivaDeduciblePct: { type: Number, default: 100 },

    pagadoCon: { type: String, enum: FORMAS_PAGO_GASTO, default: "tarjeta_empresa" },
    // Quién adelantó el dinero cuando lo paga un trabajador de su bolsillo.
    pagadoPor: String,
    reembolsado: { type: Boolean, default: false },

    // Foto o PDF del ticket y lo que leyó el OCR.
    ficheroUrl: String,
    ocr: {
      confianza: Number,
      datosExtraidos: Schema.Types.Mixed,
    },
    origen: { type: String, enum: ["ocr", "manual"], default: "manual" },
    estado: { type: String, enum: ["pendiente_revision", "validado"], default: "pendiente_revision", index: true },
    notas: String,
  },
  { timestamps: true }
);

// IVA que realmente se puede llevar al 303, con el aviso de los datos
// fiscales incluido: sin ellos no se deduce nada.
gastoSchema.methods.ivaDeducible = function () {
  if (!this.conDatosFiscales) return 0;
  return Math.round(((this.cuotaIva ?? 0) * (this.ivaDeduciblePct ?? 0)) / 100 * 100) / 100;
};

export default modeloTenant("Gasto", gastoSchema);
