import { Router } from "express";
import XLSX from "xlsx";
import MovimientoBancario from "../models/MovimientoBancario.js";
import ConciliacionLog from "../models/ConciliacionLog.js";
import FacturaCompra from "../models/FacturaCompra.js";
import FacturaVenta from "../models/FacturaVenta.js";
import Gasto from "../models/Gasto.js";
import Remesa from "../models/Remesa.js";
import { uploadMemoria } from "../middleware/upload.js";
import { contextoActual, conContexto, slugActual } from "../models/tenant.js";
import { contextoTrasSubida } from "../middleware/empresa.js";
import { guardarArchivo, urlPublica } from "../services/storage.js";

const router = Router();
const subida = uploadMemoria;

// ---------------------------------------------------------------------------
// Utilidades de texto para casar conceptos bancarios con nombres de proveedor.
// ---------------------------------------------------------------------------

const PALABRAS_LEGALES = new Set([
  "sl", "slu", "sll", "sa", "s.a", "spa", "suc", "sucs", "ltd", "llc",
  "espana", "es", "the", "madrid", "slue", "sasu",
]);

function normalizarTexto(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Palabras significativas de un nombre ("IONOS Cloud SLU" -> ["ionos", "cloud"]).
function palabrasClave(nombre) {
  return normalizarTexto(nombre)
    .split(" ")
    .filter((w) => w.length >= 4 && !PALABRAS_LEGALES.has(w));
}

// ¿Alguna palabra clave del nombre aparece en el concepto bancario?
function nombreEnConcepto(nombre, concepto) {
  const palabras = palabrasClave(nombre);
  if (!palabras.length) return false;
  const c = normalizarTexto(concepto);
  return palabras.some((w) => c.includes(w));
}

function diasEntre(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 999;
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round(Math.abs(d1 - d2) / 86400000);
}

// Busca un grupo (2+) de facturas de venta del MISMO cliente cuya suma exacta
// (en céntimos) iguale el importe del ingreso bancario. Cubre el caso de una
// remesa SEPA emitida por el banco que agrupa varias facturas cuando la remesa
// no se generó/guardó como documento en FILANEX.
function buscarGrupoFacturas(ventasPorCliente, importe, fechaMov, usadas) {
  const objetivo = Math.round(importe * 100);
  let mejor = null;

  for (const [clienteId, facturas] of ventasPorCliente) {
    if (!clienteId) continue;
    const candidatas = facturas
      .filter((f) => !usadas.has(String(f._id)))
      .filter((f) => {
        const dias = diasEntre(f.fechaExpedicion ?? f.createdAt, fechaMov);
        return dias <= 75;
      })
      .sort((a, b) => new Date(b.fechaExpedicion ?? b.createdAt) - new Date(a.fechaExpedicion ?? a.createdAt))
      .slice(0, 15);

    const grupos = [];
    const elegidas = [];

    const dfs = (i, restante) => {
      if (restante === 0 && elegidas.length >= 2) {
        grupos.push([...elegidas]);
        return;
      }
      if (i >= candidatas.length || restante < 0 || elegidas.length >= 8) return;
      const total = Math.round((candidatas[i].total ?? 0) * 100);
      if (total > 0 && total <= restante) {
        elegidas.push(candidatas[i]);
        dfs(i + 1, restante - total);
        elegidas.pop();
      }
      dfs(i + 1, restante);
    };
    dfs(0, objetivo);

    for (const grupo of grupos) {
      const diasTotal = grupo.reduce(
        (s, f) => s + diasEntre(f.fechaExpedicion ?? f.createdAt, fechaMov),
        0
      );
      if (!mejor || diasTotal < mejor.diasTotal) mejor = { grupo, diasTotal };
    }
  }

  return mejor;
}

// Categorías especiales de tesorería que no tienen factura: liquidación de
// remesas del banco, reintegros de cajero e ingresos en efectivo.
const PATRONES_TESORERIA = [
  { re: /liquidaci[oó]n\s+(de\s+)?(emis|remesa)/i, categoria: "liquidacion_remesa", esCargo: true, etiqueta: "Liquidación de remesa" },
  { re: /comisi[oó]n.*remesa|remesa.*comisi[oó]n/i, categoria: "liquidacion_remesa", esCargo: true, etiqueta: "Comisión de remesa" },
  { re: /reintegro|retirada\s+(de\s+)?(efectivo|efect)/i, categoria: "reintegro_cajero", esCargo: true, etiqueta: "Reintegro de cajero" },
  { re: /ingreso\s+(en\s+)?efectivo|ingreso\s+cajero|ingreso\s+ventanilla/i, categoria: "ingreso_efectivo", esCargo: false, etiqueta: "Ingreso en efectivo" },
];

function categoriaTesoreria(concepto) {
  const c = String(concepto ?? "");
  for (const p of PATRONES_TESORERIA) {
    if (p.re.test(c)) return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parseo del extracto (CSV / Excel).
// ---------------------------------------------------------------------------

// Normaliza una fecha que puede venir como string o Date.
// Las cadenas dd/mm/yyyy o dd-mm-yyyy (formato bancario español) se interpretan
// SIEMPRE como día primero; si el año va delante se toma como ISO.
function parseFecha(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  // dd/mm/yyyy o dd-mm-yyyy (día primero, formato español)
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const anyo = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    const prueba = new Date(Date.UTC(anyo, parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
    return isNaN(prueba.getTime()) ? null : prueba;
  }
  // yyyy-mm-dd (ISO)
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const prueba = new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)));
    return isNaN(prueba.getTime()) ? null : prueba;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Limpia un importe: quita separadores de miles y normaliza decimales.
function parseImporte(v) {
  if (typeof v === "number") return v;
  if (!v) return null;
  const s = String(v)
    .replace(/\s/g, "")
    .replace(/\u00a0/g, "")
    .replace(/\u202f/g, "");
  // Última coma o punto como decimal.
  const ultComa = s.lastIndexOf(",");
  const ultPunto = s.lastIndexOf(".");
  let num = s;
  if (ultComa > ultPunto) {
    num = s.replace(/\./g, "").replace(",", ".");
  } else if (ultPunto > -1) {
    num = s.replace(/,/g, "");
  }
  const n = parseFloat(num);
  return Number.isFinite(n) ? n : null;
}

// Detecta qué columna corresponde a cada campo buscando cabeceras comunes.
// Busca coincidencia exacta primero (evita que "Fecha Valor" se tome como
// fecha o como concepto, y que la columna "Divisa" se tome como saldo).
function detectarColumnas(cabeceras) {
  const norm = (h) => String(h ?? "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.\s]+/g, " ");
  const lower = cabeceras.map(norm);
  const buscar = (alternativas) => {
    // 1) exacta
    for (const alt of alternativas) {
      const idx = lower.findIndex((h) => h === alt);
      if (idx >= 0) return idx;
    }
    // 2) contenida (evitando la palabra "divisa")
    for (const alt of alternativas) {
      const idx = lower.findIndex((h) => h.includes(alt) && !h.includes("divisa"));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  return {
    fecha: buscar(["fecha operacion", "fecha", "date", "data", "f. operacion"]),
    concepto: buscar(["concepto", "descripcion", "movimiento", "operation", "description", "titular", "detalle"]),
    importe: buscar(["importe", "cantidad", "amount", "cargo/abono", "cargo"]),
    saldo: buscar(["saldo", "balance", "saldo disponible"]),
    referencia: buscar(["numero de documento", "referencia", "ref", "numero", "operation id", "reference", "numero documento"]),
  };
}

// Encuentra la fila de cabeceras: debe contener al menos "fecha" e "importe".
function encontrarCabecera(filas) {
  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    const fila = filas[i];
    if (!fila || fila.every((c) => !c)) continue;
    const texto = fila.map((c) => String(c ?? "").toLowerCase()).join(" ");
    if (texto.includes("fecha") && (texto.includes("importe") || texto.includes("cargo"))) {
      return i;
    }
  }
  return -1;
}

// Extrae filas de un workbook de xlsx (que también lee CSV).
function leerWorkbook(buffer, extension) {
  const wb = XLSX.read(buffer, { type: "buffer", codepage: 65001 });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: "" });
}

// Convierte filas crudas en movimientos válidos usando las cabeceras detectadas.
function filasAMovimientos(filas) {
  const idxCabecera = encontrarCabecera(filas);
  if (idxCabecera < 0 || idxCabecera + 1 >= filas.length) return [];
  const cabeceras = filas[idxCabecera];
  const idx = detectarColumnas(cabeceras);
  if (idx.fecha < 0 || idx.importe < 0) return [];

  const movimientos = [];
  for (let i = idxCabecera + 1; i < filas.length; i++) {
    const fila = filas[i];
    if (!fila || fila.every((c) => !c)) continue;
    const fecha = parseFecha(fila[idx.fecha]);
    const importe = parseImporte(fila[idx.importe]);
    if (!fecha || importe === null) continue;
    const concepto = idx.concepto >= 0 ? String(fila[idx.concepto] ?? "").trim() : "";
    if (!concepto) continue;
    const saldo = idx.saldo >= 0 ? parseImporte(fila[idx.saldo]) ?? 0 : 0;
    const referencia = idx.referencia >= 0 ? String(fila[idx.referencia] ?? "").trim() || undefined : undefined;
    movimientos.push({ fecha, concepto, importe, saldo, referencia });
  }
  return movimientos;
}

// ---------------------------------------------------------------------------
// Listado de movimientos.
// ---------------------------------------------------------------------------

// GET /api/tesoreria/extractos?conciliados=0|1|todos
router.get("/", async (req, res, next) => {
  try {
    const modo = req.query.conciliados;
    const filtro = {};
    if (modo === "0" || modo === "false") {
      filtro["conciliadoCon.tipo"] = null;
    } else if (modo === "1" || modo === "true") {
      filtro["conciliadoCon.tipo"] = { $ne: null };
    }
    const lista = await MovimientoBancario.find(filtro).sort({ fecha: -1, createdAt: -1 }).limit(500);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Búsqueda de coincidencias para el modal manual.
// Cargos: facturas de compra + gastos (tickets).
// Ingresos: remesas SEPA + facturas de venta.
// ---------------------------------------------------------------------------

// GET /api/tesoreria/extractos/coincidencias?importe=123.45&fecha=...&concepto=...&signo=-1|1
router.get("/coincidencias", async (req, res, next) => {
  try {
    const importe = Math.abs(parseFloat(req.query.importe) || 0);
    if (!importe) return res.status(400).json({ error: "Falta importe" });
    const fecha = req.query.fecha || new Date().toISOString();
    const concepto = req.query.concepto || "";
    const ingreso = req.query.signo === "1";
    const margen = Math.max(10, importe * 0.05); // tolerancia amplia para elegir a mano

    // Documentos ya vinculados a otro movimiento: se marcan para no repetir.
    const yaVinculadas = new Set(
      (await MovimientoBancario.find({ "conciliadoCon.id": { $ne: null } }, "conciliadoCon.id"))
        .map((m) => String(m.conciliadoCon.id))
    );

    const candidatas = [];

    if (!ingreso) {
      const compras = await FacturaCompra.find({ estado: "validada", total: { $gt: 0 } })
        .populate("proveedor", "nombre nif")
        .sort({ fechaExpedicion: -1 })
        .limit(1000);
      for (const f of compras) {
        const pagado = f.pagado();
        const pendiente = Math.round(((f.total ?? 0) - pagado) * 100) / 100;
        const diff = Math.abs((f.total ?? 0) - importe);
        if (diff > margen) continue;
        const proveedor = f.proveedor?.nombre || "";
        candidatas.push({
          tipo: "factura_compra",
          _id: f._id,
          etiqueta: f.numeroFacturaProveedor || "s/n",
          subtitulo: proveedor || "—",
          fecha: f.fechaExpedicion ?? f.createdAt,
          total: f.total,
          pendiente,
          vinculada: yaVinculadas.has(String(f._id)),
          diferencia: Math.round(diff * 100) / 100,
          puntos: (nombreEnConcepto(proveedor, concepto) ? 0 : 5000) + diff * 100 + diasEntre(f.fechaExpedicion ?? f.createdAt, fecha),
        });
      }

      const gastos = await Gasto.find({ total: { $gt: 0 } }).sort({ fecha: -1 }).limit(1000);
      for (const g of gastos) {
        const diff = Math.abs((g.total ?? 0) - importe);
        if (diff > margen) continue;
        candidatas.push({
          tipo: "gasto",
          _id: g._id,
          etiqueta: g.comercio || "Ticket",
          subtitulo: g.concepto || `Gasto · ${g.categoria}`,
          fecha: g.fecha,
          total: g.total,
          pendiente: 0,
          vinculada: yaVinculadas.has(String(g._id)),
          diferencia: Math.round(diff * 100) / 100,
          puntos: (nombreEnConcepto(g.comercio, concepto) ? 0 : 5000) + diff * 100 + diasEntre(g.fecha, fecha),
        });
      }
    } else {
      const remesas = await Remesa.find({ total: { $gt: 0 } }).sort({ fechaCargo: -1 }).limit(200);
      for (const r of remesas) {
        const diff = Math.abs((r.total ?? 0) - importe);
        if (diff > margen) continue;
        candidatas.push({
          tipo: "remesa",
          _id: r._id,
          etiqueta: `Remesa del ${new Date(r.fechaCargo).toLocaleDateString("es-ES")}`,
          subtitulo: `${r.recibos?.length ?? 0} recibos · ${r.estado}`,
          fecha: r.fechaCargo,
          total: r.total,
          pendiente: 0,
          vinculada: yaVinculadas.has(String(r._id)),
          diferencia: Math.round(diff * 100) / 100,
          puntos: diff * 100 + diasEntre(r.fechaCargo, fecha),
        });
      }

      const ventas = await FacturaVenta.find({ estado: "emitida", total: { $gt: 0 } })
        .populate("cliente", "nombre nif")
        .sort({ fechaExpedicion: -1 })
        .limit(1000);
      for (const f of ventas) {
        const cobrado = f.cobrado();
        const pendiente = Math.round(((f.total ?? 0) - cobrado) * 100) / 100;
        const diff = Math.abs((f.total ?? 0) - importe);
        if (diff > margen) continue;
        const cliente = f.cliente?.nombre || "";
        candidatas.push({
          tipo: "factura_venta",
          _id: f._id,
          etiqueta: f.serieNumero || "s/n",
          subtitulo: cliente || "—",
          fecha: f.fechaExpedicion ?? f.createdAt,
          total: f.total,
          pendiente,
          vinculada: yaVinculadas.has(String(f._id)),
          diferencia: Math.round(diff * 100) / 100,
          puntos: (nombreEnConcepto(cliente, concepto) ? 0 : 5000) + diff * 100 + diasEntre(f.fechaExpedicion ?? f.createdAt, fecha),
        });
      }
    }

    candidatas.sort((a, b) => a.puntos - b.puntos);
    res.json({ importe, candidatas: candidatas.slice(0, 30) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Registro histórico de conciliaciones (auditoría).
// ---------------------------------------------------------------------------

// GET /api/tesoreria/extractos/registro?limite=100
router.get("/registro", async (req, res, next) => {
  try {
    const limite = Math.min(parseInt(req.query.limite, 10) || 200, 500);
    const lista = await ConciliacionLog.find({}).sort({ createdAt: -1 }).limit(limite);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Conciliación automática.
// Reglas estrictas para no equivocarse: importe exacto (±1 céntimo) y,
// como preferencia, que el nombre del proveedor/comercio aparezca en el
// concepto del banco, o que la referencia bancaria coincida, o fecha muy
// cercana. Los ingresos se casan con remesas SEPA o facturas de venta.
// ---------------------------------------------------------------------------

router.post("/conciliar-automatico", async (req, res, next) => {
  try {
    const pendientes = await MovimientoBancario.find({
      "conciliadoCon.tipo": null,
    }).sort({ fecha: -1 });

    if (!pendientes.length) return res.json({ ok: true, conciliados: 0, resultados: [] });

    const compras = await FacturaCompra.find({ estado: "validada", total: { $gt: 0 } })
      .populate("proveedor", "nombre nif");
    const gastos = await Gasto.find({ total: { $gt: 0 } });
    const remesas = await Remesa.find({ total: { $gt: 0 } }).sort({ fechaCargo: -1 });
    const ventas = await FacturaVenta.find({ estado: "emitida", total: { $gt: 0 } })
      .populate("cliente", "nombre nif");

    // Ventas agrupadas por cliente (para casar remesas de varias facturas).
    const ventasPorCliente = new Map();
    for (const f of ventas) {
      const clave = f.cliente?._id ? String(f.cliente._id) : "";
      if (!clave) continue;
      if (!ventasPorCliente.has(clave)) ventasPorCliente.set(clave, []);
      ventasPorCliente.get(clave).push(f);
    }

    // Documentos ya vinculados (por movimientos anteriores o de esta tanda).
    const usadas = new Set(
      (await MovimientoBancario.find({ "conciliadoCon.id": { $ne: null } }, "conciliadoCon.id"))
        .map((m) => String(m.conciliadoCon.id))
    );

    const resultados = [];

    for (const mov of pendientes) {
      const importe = Math.abs(mov.importe);
      if (!importe) continue;
      const concepto = mov.concepto || "";
      const referencia = normalizarTexto(mov.referencia || "");

      let mejor = null;

      if (mov.importe > 0) {
        // Ingreso: preferir una remesa SEPA por importe total y fecha.
        for (const r of remesas) {
          if (usadas.has(String(r._id))) continue;
          const diff = Math.abs((r.total ?? 0) - importe);
          if (diff > 0.02) continue;
          const dias = diasEntre(r.fechaCargo, mov.fecha);
          if (dias > 10) continue;
          if (!mejor || dias < mejor.dias) {
            mejor = { tipo: "remesa", doc: r, dias, diff };
          }
        }
        // Si el banco trae un ingreso de una remesa pero la remesa no se
        // generó/guardó en FILANEX, casar directamente con la factura.
        if (!mejor) {
          for (const f of ventas) {
            if (usadas.has(String(f._id))) continue;
            const diff = Math.abs((f.total ?? 0) - importe);
            if (diff > 0.02) continue;
            const cliente = f.cliente?.nombre || "";
            const coincideNombre = nombreEnConcepto(cliente, concepto);
            const dias = diasEntre(f.fechaExpedicion ?? f.createdAt, mov.fecha);
            const puntos = (coincideNombre ? 0 : 4000) + dias;
            if (!mejor || puntos < mejor.puntos) {
              mejor = { tipo: "factura_venta", doc: f, puntos, dias, diff };
            }
          }
        }
        // Remesa SEPA que agrupa varias facturas del mismo cliente y no
        // existe como documento en FILANEX: casar por suma exacta del grupo.
        if (!mejor) {
          const grupo = buscarGrupoFacturas(ventasPorCliente, importe, mov.fecha, usadas);
          if (grupo) {
            mejor = {
              tipo: "facturas_venta",
              grupo: grupo.grupo,
              dias: Math.round(grupo.diasTotal / grupo.grupo.length),
            };
          }
        }
      } else {
        // Cargo: si es liquidación de remesa o reintegro de cajero, es un
        // movimiento de tesorería sin factura (no buscar documento).
        const catTes = categoriaTesoreria(concepto);
        if (catTes && catTes.esCargo) {
          mejor = { tipo: "movimiento_tesoreria", catTes, dias: 0, puntos: 0 };
        } else {
        // Cargo: facturas de compra y gastos con importe exacto.
        for (const f of compras) {
          if (usadas.has(String(f._id))) continue;
          const diffEur = Math.abs((f.total ?? 0) - importe);
          const diffDiv = f.totalDivisa && f.divisa !== "EUR" ? Math.abs(f.totalDivisa - importe) : Infinity;
          const diff = Math.min(diffEur, diffDiv);
          if (diff > 0.02) continue;
          const nombre = f.proveedor?.nombre || "";
          const refFc = normalizarTexto(f.numeroFacturaProveedor || "");
          const coincideRef = referencia && refFc && (referencia.includes(refFc) || refFc.includes(referencia));
          const coincideNombre = nombreEnConcepto(nombre, concepto);
          const dias = diasEntre(f.fechaExpedicion ?? f.createdAt, mov.fecha);
          const puntos = (coincideRef ? -10000 : 0) + (coincideNombre ? 0 : 4000) + dias;
          if (!mejor || puntos < mejor.puntos) mejor = { tipo: "factura_compra", doc: f, puntos, dias, diff };
        }
        for (const g of gastos) {
          if (usadas.has(String(g._id))) continue;
          const diff = Math.abs((g.total ?? 0) - importe);
          if (diff > 0.02) continue;
          const coincideNombre = nombreEnConcepto(g.comercio, concepto);
          const dias = diasEntre(g.fecha, mov.fecha);
          const puntos = (coincideNombre ? 0 : 4000) + dias;
          if (!mejor || puntos < mejor.puntos) mejor = { tipo: "gasto", doc: g, puntos, dias, diff };
        }
        }
      }

      if (!mejor) continue;

      // Salvaguardas: sin nombre ni referencia que apoyen, solo si la fecha
      // es muy cercana (evita casar por casualidad importes repetidos).
      if (mejor.tipo === "factura_compra" && mejor.puntos >= 4000 && mejor.dias > 45) continue;
      if (mejor.tipo === "gasto" && mejor.puntos >= 4000 && mejor.dias > 45) continue;
      if (mejor.tipo === "factura_venta" && mejor.puntos >= 4000 && mejor.dias > 45) continue;

      const marcador = `extracto:${mov._id}`;
      let descripcion = "";

      if (mejor.tipo === "factura_compra") {
        const fc = mejor.doc;
        const pendiente = Math.round(((fc.total ?? 0) - fc.pagado()) * 100) / 100;
        if (pendiente > 0) {
          fc.pagos.push({
            importe: Math.min(pendiente, importe),
            fecha: mov.fecha ?? new Date(),
            metodo: "transferencia",
            nota: `Conciliación automática extracto: ${mov.concepto} (${marcador})`,
          });
          await fc.save();
        }
        descripcion = fc.numeroFacturaProveedor || fc.proveedor?.nombre || "factura";
      } else if (mejor.tipo === "gasto") {
        descripcion = mejor.doc.comercio || "gasto";
      } else if (mejor.tipo === "factura_venta") {
        const fv = mejor.doc;
        const pendiente = Math.round(((fv.total ?? 0) - fv.cobrado()) * 100) / 100;
        if (pendiente > 0) {
          fv.cobros.push({
            fecha: mov.fecha ?? new Date(),
            importe: Math.min(pendiente, importe),
            metodo: "transferencia",
            notas: `Conciliación automática extracto: ${mov.concepto} (${marcador})`,
          });
          await fv.save();
        }
        descripcion = fv.serieNumero || fv.cliente?.nombre || "factura de venta";
      } else if (mejor.tipo === "facturas_venta") {
        // Grupo de facturas del mismo cliente cobradas con una remesa SEPA
        // que no existe como documento en FILANEX.
        const numeros = [];
        for (const fv of mejor.grupo) {
          const pendiente = Math.round(((fv.total ?? 0) - fv.cobrado()) * 100) / 100;
          if (pendiente > 0) {
            fv.cobros.push({
              fecha: mov.fecha ?? new Date(),
              importe: pendiente,
              metodo: "remesa",
              notas: `Conciliación automática remesa sin documento (${marcador})`,
            });
            await fv.save();
          }
          numeros.push(fv.serieNumero || "factura");
        }
        descripcion = `${numeros.join(" + ")} · ${mejor.grupo[0].cliente?.nombre || "cliente"}`;
      } else if (mejor.tipo === "remesa") {
        const remesa = mejor.doc;
        for (const recibo of remesa.recibos ?? []) {
          if (!recibo.facturaVenta) continue;
          const fv = await FacturaVenta.findById(recibo.facturaVenta);
          if (!fv || fv.estado !== "emitida") continue;
          const pendienteFv = Math.round(((fv.total ?? 0) - fv.cobrado()) * 100) / 100;
          if (pendienteFv > 0) {
            fv.cobros.push({
              fecha: mov.fecha ?? remesa.fechaCargo,
              importe: Math.min(pendienteFv, recibo.importe ?? pendienteFv),
              metodo: "remesa",
              notas: `Conciliación automática remesa (${marcador})`,
            });
            await fv.save();
          }
        }
        descripcion = `remesa del ${new Date(remesa.fechaCargo).toLocaleDateString("es-ES")}`;
      } else if (mejor.tipo === "movimiento_tesoreria") {
        // Liquidación de remesa o reintegro de cajero: sin factura. Si es la
        // liquidación/comisión del banco, se registra como gasto deducible.
        if (mejor.catTes.categoria === "liquidacion_remesa") {
          const yaExiste = await Gasto.findOne({
            comercio: "Banco",
            total: Math.round(importe * 100) / 100,
            fecha: { $gte: new Date(new Date(mov.fecha).setHours(0, 0, 0, 0)), $lte: new Date(new Date(mov.fecha).setHours(23, 59, 59, 999)) },
          });
          if (!yaExiste) {
            await Gasto.create({
              fecha: mov.fecha ?? new Date(),
              comercio: "Banco",
              concepto: `${mejor.catTes.etiqueta} (${mov.concepto})`,
              categoria: "comisiones_bancarias",
              base: Math.round(importe * 100) / 100,
              tipoIva: 0,
              cuotaIva: 0,
              total: Math.round(importe * 100) / 100,
              conDatosFiscales: false,
              ivaDeduciblePct: 0,
              pagadoCon: "transferencia",
              estado: "validado",
              notas: `Conciliación automática extracto (${marcador})`,
              origen: "manual",
            });
          }
        }
        descripcion = mejor.catTes.etiqueta;
      }

      mov.conciliadoCon = mejor.tipo === "facturas_venta"
        ? { tipo: mejor.tipo, id: mejor.grupo[0]._id, fecha: new Date() }
        : mejor.tipo === "movimiento_tesoreria"
          ? { tipo: mejor.tipo, id: null, fecha: new Date() }
          : { tipo: mejor.tipo, id: mejor.doc._id, fecha: new Date() };
      mov.notas = `Conciliación automática: ${descripcion}`;
      await mov.save();
      if (mejor.tipo === "facturas_venta") {
        for (const fv of mejor.grupo) usadas.add(String(fv._id));
      } else if (mejor.tipo !== "movimiento_tesoreria") {
        usadas.add(String(mejor.doc._id));
      }

      // Criterio que motivó el enlace (para el registro de auditoría).
      const criterio = mejor.tipo === "remesa"
        ? `importe exacto (${importe} €), remesa a ${mejor.dias} días`
        : mejor.tipo === "facturas_venta"
          ? `suma exacta de ${mejor.grupo.length} facturas del mismo cliente (${importe} €)`
          : mejor.tipo === "movimiento_tesoreria"
            ? `concepto bancario: ${mejor.catTes.etiqueta}`
            : mejor.puntos < 0
              ? `referencia bancaria coincidente + ${mejor.dias} días`
              : mejor.puntos < 4000
                ? `nombre del concepto coincide + ${mejor.dias} días`
                : `importe exacto, fecha a ${mejor.dias} días`;
      await ConciliacionLog.create({
        accion: "conciliacion",
        modo: "automatica",
        usuario: req.usuario?.email || "",
        movimiento: { id: mov._id, fecha: mov.fecha, concepto: mov.concepto, importe: mov.importe },
        documento: {
          tipo: mejor.tipo,
          id: mejor.tipo === "facturas_venta" ? mejor.grupo[0]._id
            : mejor.tipo === "movimiento_tesoreria" ? null
            : mejor.doc._id,
          descripcion,
          criterio,
        },
        notas: mov.notas,
      });

      resultados.push({
        movimiento: mov._id,
        tipo: mejor.tipo,
        documento: mejor.tipo === "facturas_venta" ? mejor.grupo[0]._id
          : mejor.tipo === "movimiento_tesoreria" ? null
          : mejor.doc._id,
        descripcion,
        fecha: mov.fecha,
        concepto: mov.concepto,
        proveedor: mejor.tipo === "factura_compra" ? (mejor.doc.proveedor?.nombre || "") : "",
        importe,
        automatico: true,
      });
    }

    res.json({ ok: true, conciliados: resultados.length, resultados });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Subida de extracto con detección de duplicados.
// ---------------------------------------------------------------------------

router.post("/upload", subida.single("extracto"), contextoTrasSubida, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Falta el archivo" });
    const empresa = contextoActual();
    const extension = (req.file.originalname || "").split(".").pop().toLowerCase();
    const filas = leerWorkbook(req.file.buffer, extension);
    const movimientos = filasAMovimientos(filas);
    if (movimientos.length === 0) {
      return res.status(400).json({
        error: "No se encontraron movimientos. Asegúrate de que el archivo tenga columnas Fecha, Concepto e Importe.",
      });
    }

    // Evita importar dos veces el mismo extracto: mismo día + importe +
    // concepto + saldo. (El saldo distingue dos cargos legítimos del mismo
    // importe el mismo día.)
    const existentes = await MovimientoBancario.find({}, "fecha importe concepto saldo");
    const claves = new Set(existentes.map((m) => `${new Date(m.fecha).toDateString()}|${m.importe}|${m.concepto}|${m.saldo ?? ""}`));
    const nuevos = movimientos.filter(
      (m) => !claves.has(`${m.fecha.toDateString()}|${m.importe}|${m.concepto}|${m.saldo ?? ""}`)
    );
    const duplicados = movimientos.length - nuevos.length;
    if (nuevos.length === 0) {
      return res.status(400).json({
        error: `El extracto ya estaba importado: ${duplicados} movimientos duplicados, 0 nuevos.`,
      });
    }

    const slug = slugActual();
    const nombreFichero = `${Date.now()}-${req.file.originalname.replace(/[^\w.\-]+/g, "_")}`;
    const remoto = `uploads/${slug}/extractos/${nombreFichero}`;
    await guardarArchivo(remoto, req.file.buffer, req.file.mimetype || "application/octet-stream");
    const archivoUrl = urlPublica(remoto);

    return await conContexto(empresa, async () => {
      const docs = await MovimientoBancario.insertMany(
        nuevos.map((m) => ({ ...m, archivoUrl })),
        { ordered: false }
      );
      res.status(201).json({
        insertados: docs.length,
        duplicados,
        archivoUrl,
      });
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Conciliación manual de un movimiento.
// ---------------------------------------------------------------------------

router.post("/:id/conciliar", async (req, res, next) => {
  try {
    const mov = await MovimientoBancario.findById(req.params.id);
    if (!mov) return res.status(404).json({ error: "Movimiento no encontrado" });
    if (mov.conciliadoCon?.tipo) {
      return res.status(409).json({ error: "El movimiento ya está conciliado" });
    }

    const { tipo, id } = req.body;
    if (!tipo || (!id && tipo !== "manual" && tipo !== "movimiento_tesoreria")) {
      return res.status(400).json({ error: "Faltan tipo o id" });
    }
    const marcador = `extracto:${mov._id}`;
    const importe = Math.abs(req.body.importePago ?? mov.importe ?? 0);

    if (tipo === "factura_compra") {
      const fc = await FacturaCompra.findById(id);
      if (!fc) return res.status(404).json({ error: "Factura no encontrada" });
      if (fc.estado !== "validada") return res.status(409).json({ error: "Solo se concilian facturas validadas" });
      const pendiente = Math.round(((fc.total ?? 0) - fc.pagado()) * 100) / 100;
      if (pendiente > 0) {
        const importeAplicar = Math.min(pendiente, importe);
        if (importeAplicar <= 0) return res.status(409).json({ error: "La factura ya está pagada" });
        fc.pagos.push({
          importe: importeAplicar,
          fecha: mov.fecha ?? new Date(),
          metodo: "transferencia",
          nota: `Conciliado con extracto: ${mov.concepto} (${marcador})`,
        });
        await fc.save();
      }
    } else if (tipo === "gasto") {
      const g = await Gasto.findById(id);
      if (!g) return res.status(404).json({ error: "Gasto no encontrado" });
    } else if (tipo === "factura_venta") {
      const fv = await FacturaVenta.findById(id);
      if (!fv) return res.status(404).json({ error: "Factura no encontrada" });
      if (fv.estado !== "emitida") return res.status(409).json({ error: "Solo se concilian facturas emitidas" });
      const pendiente = Math.round(((fv.total ?? 0) - fv.cobrado()) * 100) / 100;
      if (pendiente > 0) {
        const importeAplicar = Math.min(pendiente, importe);
        if (importeAplicar <= 0) return res.status(409).json({ error: "La factura ya está cobrada" });
        fv.cobros.push({
          fecha: mov.fecha ?? new Date(),
          importe: importeAplicar,
          metodo: "transferencia",
          notas: `Conciliado con extracto: ${mov.concepto} (${marcador})`,
        });
        await fv.save();
      }
    } else if (tipo === "remesa") {
      const remesa = await Remesa.findById(id);
      if (!remesa) return res.status(404).json({ error: "Remesa no encontrada" });
      for (const recibo of remesa.recibos ?? []) {
        if (!recibo.facturaVenta) continue;
        const fv = await FacturaVenta.findById(recibo.facturaVenta);
        if (!fv || fv.estado !== "emitida") continue;
        const pendienteFv = Math.round(((fv.total ?? 0) - fv.cobrado()) * 100) / 100;
        if (pendienteFv > 0) {
          fv.cobros.push({
            fecha: mov.fecha ?? remesa.fechaCargo,
            importe: Math.min(pendienteFv, recibo.importe ?? pendienteFv),
            metodo: "remesa",
            notas: `Conciliado con extracto: remesa (${marcador})`,
          });
          await fv.save();
        }
      }
    } else if (tipo === "movimiento_tesoreria") {
      // Liquidación de remesa o reintegro: si es la liquidación del banco,
      // se crea el gasto deducible. El usuario lo confirma a mano.
      const catTes = categoriaTesoreria(mov.concepto);
      if (catTes?.categoria === "liquidacion_remesa" && mov.importe < 0) {
        const importeCargo = Math.abs(mov.importe);
        await Gasto.create({
          fecha: mov.fecha ?? new Date(),
          comercio: "Banco",
          concepto: `${catTes.etiqueta} (${mov.concepto})`,
          categoria: "comisiones_bancarias",
          base: importeCargo,
          tipoIva: 0,
          cuotaIva: 0,
          total: importeCargo,
          conDatosFiscales: false,
          ivaDeduciblePct: 0,
          pagadoCon: "transferencia",
          estado: "validado",
          notas: `Conciliado con extracto (${marcador})`,
          origen: "manual",
        });
      }
    } else if (tipo !== "manual") {
      return res.status(400).json({ error: "Tipo de conciliación no soportado" });
    }

    mov.conciliadoCon = { tipo, id: id || null, fecha: new Date() };
    mov.notas = req.body.notas || mov.notas;
    await mov.save();

    // Descripción legible del documento para el registro.
    let descripcionManual = tipo;
    if (tipo === "factura_compra") {
      const fc = await FacturaCompra.findById(id).populate("proveedor", "nombre");
      descripcionManual = `${fc?.numeroFacturaProveedor || "factura"}${fc?.proveedor?.nombre ? ` · ${fc.proveedor.nombre}` : ""}`;
    } else if (tipo === "gasto") {
      const g = await Gasto.findById(id);
      descripcionManual = g?.comercio || "gasto";
    } else if (tipo === "factura_venta") {
      const fv = await FacturaVenta.findById(id).populate("cliente", "nombre");
      descripcionManual = `${fv?.serieNumero || "factura"}${fv?.cliente?.nombre ? ` · ${fv.cliente.nombre}` : ""}`;
    } else if (tipo === "remesa") {
      const r = await Remesa.findById(id);
      descripcionManual = `remesa del ${r?.fechaCargo ? new Date(r.fechaCargo).toLocaleDateString("es-ES") : "?"}`;
    } else if (tipo === "manual") {
      descripcionManual = "sin factura (anotado a mano)";
    } else if (tipo === "movimiento_tesoreria") {
      const catTes = categoriaTesoreria(mov.concepto);
      descripcionManual = catTes?.etiqueta || "movimiento de tesorería";
    }

    await ConciliacionLog.create({
      accion: "conciliacion",
      modo: "manual",
      usuario: req.usuario?.email || "",
      movimiento: { id: mov._id, fecha: mov.fecha, concepto: mov.concepto, importe: mov.importe },
      documento: { tipo, id: id || null, descripcion: descripcionManual, criterio: "elegido por el usuario" },
      notas: mov.notas,
    });

    res.json({ ok: true, movimiento: mov });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Desconciliar: quita el enlace y los pagos/cobros creados (por marcador).
// ---------------------------------------------------------------------------

router.delete("/:id/conciliacion", async (req, res, next) => {
  try {
    const mov = await MovimientoBancario.findById(req.params.id);
    if (!mov) return res.status(404).json({ error: "Movimiento no encontrado" });
    if (!mov.conciliadoCon?.tipo) return res.json({ ok: true });

    const anterior = { ...mov.conciliadoCon };
    const marcador = `extracto:${mov._id}`;

    if (mov.conciliadoCon.tipo === "factura_compra") {
      const fc = await FacturaCompra.findById(mov.conciliadoCon.id);
      if (fc) {
        fc.pagos = (fc.pagos ?? []).filter((p) => !String(p.nota ?? "").includes(marcador));
        await fc.save();
      }
    } else if (mov.conciliadoCon.tipo === "factura_venta") {
      const fv = await FacturaVenta.findById(mov.conciliadoCon.id);
      if (fv) {
        fv.cobros = (fv.cobros ?? []).filter((c) => !String(c.notas ?? "").includes(marcador));
        await fv.save();
      }
    } else if (mov.conciliadoCon.tipo === "remesa" || mov.conciliadoCon.tipo === "facturas_venta") {
      // Los cobros se repartieron entre varias facturas: buscar por marcador.
      const afectadas = await FacturaVenta.find({ "cobros.notas": { $regex: marcador.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } });
      for (const fv of afectadas) {
        fv.cobros = (fv.cobros ?? []).filter((c) => !String(c.notas ?? "").includes(marcador));
        await fv.save();
      }
    } else if (mov.conciliadoCon.tipo === "movimiento_tesoreria") {
      // Si la conciliación automática creó un gasto (liquidación del banco),
      // se borra al desconciliar para no dejar basura contable.
      const marcadorEscapado = marcador.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      await Gasto.deleteMany({ notas: { $regex: marcadorEscapado }, comercio: "Banco" });
    }

    mov.conciliadoCon = { tipo: null, id: null, fecha: null };
    await mov.save();

    await ConciliacionLog.create({
      accion: "desconciliacion",
      modo: "manual",
      usuario: req.usuario?.email || "",
      movimiento: { id: mov._id, fecha: mov.fecha, concepto: mov.concepto, importe: mov.importe },
      documento: {
        tipo: anterior.tipo,
        id: anterior.id,
        descripcion: mov.notas || "",
        criterio: "deshecho por el usuario (pagos/cobros revertidos)",
      },
      notas: mov.notas,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const mov = await MovimientoBancario.findByIdAndDelete(req.params.id);
    if (!mov) return res.status(404).json({ error: "Movimiento no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
