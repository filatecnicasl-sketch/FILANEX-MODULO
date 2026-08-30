import Contador from "../models/Contador.js";

// Extrae el número entero de una serie de tipo "A-123" o "OT-000123".
function extraerNumero(cadena) {
  const match = String(cadena).match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

// Busca el máximo número usado en una colección, parseando el campo dado.
async function maximoNumero(modelo, campo, filtro = {}) {
  const docs = await modelo.find({ [campo]: { $exists: true }, ...filtro }).select(campo).lean();
  return docs.reduce((max, d) => Math.max(max, extraerNumero(d[campo])), 0);
}

// Inicializa un contador al máximo valor ya usado, de modo que el $inc
// siguiente asigne exactamente max + 1 (ni duplicados ni huecos).
async function inicializarSiEsNuevo(clave, modelo, campo, filtro = {}) {
  const existe = await Contador.findOne({ clave }).lean();
  if (existe) return;
  const maximo = await maximoNumero(modelo, campo, filtro);
  await Contador.findOneAndUpdate(
    { clave },
    { $setOnInsert: { valor: maximo } },
    { upsert: true }
  );
}

// Numeración de documentos por series (pantalla Sistema → Series).
// Formato emitido: `${nombre}-${n}` (ej. A-12). Si la empresa aún no
// tiene series nuevas, se migran sobre la marcha desde los campos
// antiguos (series / contadores) para no romper instalaciones en uso.

const CAMPOS = {
  presupuestoVenta: { lista: "seriesVenta", campo: "proxPresupuesto" },
  albaranVenta: { lista: "seriesVenta", campo: "proxAlbaran" },
  facturaVenta: { lista: "seriesVenta", campo: "proxFactura" },
  presupuestoCompra: { lista: "seriesCompra", campo: "proxPresupuesto" },
  pedidoCompra: { lista: "seriesCompra", campo: "proxPedido" },
  albaranCompra: { lista: "seriesCompra", campo: "proxAlbaran" },
};

// Rellena seriesVenta / seriesCompra a partir de los datos antiguos si
// están vacías. Funciona tanto sobre el documento Mongoose como sobre
// un objeto plano. Devuelve true si ha tocado algo.
export function asegurarSeries(empresa) {
  let tocado = false;
  const contadores = empresa.contadores ?? {};

  if (!Array.isArray(empresa.seriesVenta) || empresa.seriesVenta.length === 0) {
    const antiguas = Array.isArray(empresa.series) ? empresa.series : [];
    empresa.seriesVenta =
      antiguas.length > 0
        ? antiguas.map((s, i) => ({
            // El prefijo antiguo (ej. "A-") manda sobre el nombre ("General").
            nombre: (s.prefijo ? String(s.prefijo).replace(/-+$/, "") : "") || s.nombre,
            defecto: i === 0,
            proxPresupuesto: contadores.presupuesto ?? 1,
            proxAlbaran: contadores.albaranVenta ?? 1,
            proxFactura: s.siguienteNumero ?? 1,
          }))
        : [
            {
              nombre: "A",
              defecto: true,
              proxPresupuesto: contadores.presupuesto ?? 1,
              proxAlbaran: contadores.albaranVenta ?? 1,
              proxFactura: 1,
            },
          ];
    tocado = true;
  }

  if (!Array.isArray(empresa.seriesCompra) || empresa.seriesCompra.length === 0) {
    empresa.seriesCompra = [
      {
        nombre: "C",
        defecto: true,
        proxPresupuesto: contadores.presupuestoCompra ?? 1,
        proxPedido: contadores.pedidoCompra ?? 1,
        proxAlbaran: contadores.albaranCompra ?? 1,
      },
    ];
    tocado = true;
  }

  return tocado;
}

// Toma el siguiente número del tipo dado usando la serie por defecto e
// incrementa el contador en memoria. NO guarda: el llamador hace save().
// Devuelve { serie, numero, serieNumero } (ej. { serie: "A", numero: 12, serieNumero: "A-12" }).
export function tomarNumero(empresa, tipo) {
  const cfg = CAMPOS[tipo];
  if (!cfg) throw new Error(`Tipo de numeración desconocido: ${tipo}`);
  asegurarSeries(empresa);
  const lista = empresa[cfg.lista];
  const serie = lista.find((s) => s.defecto) ?? lista[0];
  const numero = serie[cfg.campo] ?? 1;
  serie[cfg.campo] = numero + 1;
  return { serie: serie.nombre, numero, serieNumero: `${serie.nombre}-${numero}` };
}

// Versión atómica y libre de contención para facturas de venta.
// Usa una colección separada de contadores y $inc, por lo que no hay
// riesgo de duplicados ni bloqueos sobre el documento Empresa.
// Con { serieNombre } numera en una serie concreta (p.ej. la "T" del TPV),
// creándola si no existe; sin opciones usa la serie por defecto.
// Si la empresa tiene renumerarAnual (por defecto sí), la serie efectiva
// lleva el año del documento: "A-2027", "T-2027"…, y cada 1 de enero la
// numeración vuelve a 1 sin romper la unicidad de serie exigida por
// VeriFactu (la cadena de huella continúa entre años).
export async function tomarNumeroFacturaVentaAtomico(empresa, { serieNombre, ano } = {}) {
  asegurarSeries(empresa);
  const lista = empresa.seriesVenta;
  let serie;
  if (serieNombre) {
    serie = lista.find((s) => s.nombre === serieNombre);
    if (!serie) {
      // Serie nueva (no por defecto): hereda los contadores de presupuesto
      // y albarán de la serie por defecto para no descuadrar esos documentos.
      const base = lista.find((s) => s.defecto) ?? lista[0];
      serie = {
        nombre: serieNombre,
        defecto: false,
        proxPresupuesto: base.proxPresupuesto ?? 1,
        proxAlbaran: base.proxAlbaran ?? 1,
        proxFactura: 1,
      };
      lista.push(serie);
      empresa.markModified?.("seriesVenta");
      await empresa.save();
    }
  } else {
    serie = lista.find((s) => s.defecto) ?? lista[0];
  }

  const ejercicio = Number(ano) || new Date().getFullYear();
  const renumerar = empresa.renumerarAnual !== false;
  const nombreEfectivo = renumerar ? `${serie.nombre}-${ejercicio}` : serie.nombre;
  const clave = `facturaVenta:${nombreEfectivo}`;

  const { default: FacturaVenta } = await import("../models/FacturaVenta.js");
  // El máximo se calcula solo dentro de ESTA serie (T-1, T-2… o T-2027-1…),
  // para que cada serie (y cada ejercicio) empiece en 1.
  await inicializarSiEsNuevo(clave, FacturaVenta, "serieNumero", {
    serieNumero: new RegExp(`^${nombreEfectivo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-`),
  });

  const contador = await Contador.findOneAndUpdate(
    { clave },
    { $inc: { valor: 1 } },
    { new: true, upsert: true }
  );
  const numero = contador.valor;
  return { serie: nombreEfectivo, numero, serieNumero: `${nombreEfectivo}-${numero}` };
}

// Contador atómico para órdenes de trabajo. Desacoplado del documento Empresa.
export async function tomarNumeroOrdenTrabajoAtomico() {
  const { default: OrdenTrabajo } = await import("../models/OrdenTrabajo.js");
  await inicializarSiEsNuevo("ordenTrabajo", OrdenTrabajo, "numero");

  const contador = await Contador.findOneAndUpdate(
    { clave: "ordenTrabajo" },
    { $inc: { valor: 1 } },
    { new: true, upsert: true }
  );
  return `OT-${String(contador.valor).padStart(6, "0")}`;
}

