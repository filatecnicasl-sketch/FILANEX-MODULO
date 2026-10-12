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
    .filter((w) => {
      // Palabras largas siempre; números solo con 2+ dígitos: una cifra
      // suelta del CIF ("2" de B12345678) casaría con cualquier concepto.
      if (/^\d+$/.test(w)) return w.length >= 2;
      return w.length >= 4 && !PALABRAS_LEGALES.has(w);
    });
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

// Cobrado/pagado acumulado: funciona con documentos hidratados y con lean()
// (los métodos del esquema desaparecen al hacer lean).
function sumaCobros(f) {
  return (f.cobros ?? []).reduce((s, c) => s + (c.importe ?? 0), 0);
}
function sumaPagos(f) {
  return (f.pagos ?? []).reduce((s, p) => s + (p.importe ?? 0), 0);
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
      // Solo con algo pendiente y que no superen por sí solas el objetivo:
      // una factura ya cobrada nunca forma parte de la remesa.
      .map((f) => ({ f, pendienteCent: Math.round(((f.total ?? 0) - sumaCobros(f)) * 100) }))
      .filter(({ pendienteCent }) => pendienteCent > 0 && pendienteCent <= objetivo)
      .sort((a, b) => new Date(b.f.fechaExpedicion ?? b.f.createdAt) - new Date(a.f.fechaExpedicion ?? a.f.createdAt))
      .slice(0, 15);

    const grupos = [];
    const elegidas = [];

    const dfs = (i, restante) => {
      if (restante === 0 && elegidas.length >= 2) {
        grupos.push(elegidas.map((e) => e.f));
        return;
      }
      if (i >= candidatas.length || restante < 0 || elegidas.length >= 8) return;
      if (candidatas[i].pendienteCent <= restante) {
        elegidas.push(candidatas[i]);
        dfs(i + 1, restante - candidatas[i].pendienteCent);
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
    const dia = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10);
    const anyo = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    const prueba = new Date(Date.UTC(anyo, mes - 1, dia));
    // Sin validar, "31/02/2026" se convertiría en 3 de marzo sin avisar.
    if (isNaN(prueba.getTime())) return null;
    if (prueba.getUTCFullYear() !== anyo || prueba.getUTCMonth() !== mes - 1 || prueba.getUTCDate() !== dia) return null;
    return prueba;
  }
  // yyyy-mm-dd (ISO)
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const prueba = new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)));
    if (isNaN(prueba.getTime())) return null;
    if (prueba.getUTCMonth() !== parseInt(m[2], 10) - 1 || prueba.getUTCDate() !== parseInt(m[3], 10)) return null;
    return prueba;
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
// Los CSV se decodifican a mano primero (UTF-8 con fallback a Latin-1 y
// sin BOM) para que los conceptos con tildes no lleguen corruptos.
function leerWorkbook(buffer, extension) {
  if (extension === "csv" || extension === "txt") {
    let texto = buffer.toString("utf8");
    if (texto.includes("\uFFFD")) texto = buffer.toString("latin1");
    if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
    const wb = XLSX.read(texto, { type: "string" });
    const hoja = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: "" });
  }
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
    if (!fecha || importe === null) {
      if (importe === null && String(fila[idx.importe] ?? "").trim() !== "") {
        console.warn(`Extracto: importe ilegible "${fila[idx.importe]}" en la fila "${fila[idx.concepto]}"`);
      }
      continue;
    }
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
        const pagado = sumaPagos(f);
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
        const cobrado = sumaCobros(f);
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
      .select("_id total pagos numeroFacturaProveedor proveedor fecha estado")
      .populate("proveedor", "nombre nif")
      .lean();
    const gastos = await Gasto.find({ total: { $gt: 0 } })
      .select("_id total comercio fecha categoria")
      .lean();
    const remesas = await Remesa.find({ total: { $gt: 0 } })
      .select("_id total fechaCargo recibos estado")
      .sort({ fechaCargo: -1 })
      .lean();
    const ventas = await FacturaVenta.find({ estado: "emitida", total: { $gt: 0 } })
      .select("_id total cobros serieNumero cliente fechaExpedicion createdAt estado")
      .populate("cliente", "nombre nif")
      .lean();

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
        // Las remesas anuladas nunca casan. Si ninguna cuadra al céntimo,
        // se admite una diferencia pequeña (el banco puede abonar la remesa
        // menos la comisión), pero solo con la fecha muy pegada.
        let remesaTolerante = null;
        for (const r of remesas) {
          if (usadas.has(String(r._id))) continue;
          if (r.estado === "anulada") continue;
          const diff = Math.abs((r.total ?? 0) - importe);
          const dias = diasEntre(r.fechaCargo, mov.fecha);
          if (diff <= 0.02) {
            if (dias > 10) continue;
            if (!mejor || dias < mejor.dias) {
              mejor = { tipo: "remesa", doc: r, dias, diff };
            }
          } else if (diff <= 5 && dias <= 5) {
            if (!remesaTolerante || dias < remesaTolerante.dias) {
              remesaTolerante = { tipo: "remesa", doc: r, dias, diff };
            }
          }
        }
        // Si el banco trae un ingreso de una remesa pero la remesa no se
        // generó/guardó en FILANEX, casar directamente con la factura.
        if (!mejor) {
          for (const f of ventas) {
            if (usadas.has(String(f._id))) continue;
            // Solo facturas con algo pendiente de cobro: una ya cobrada por
            // otra vía no debe volver a casarse.
            if (Math.round(((f.total ?? 0) - sumaCobros(f)) * 100) <= 0) continue;
            const diff = Math.abs((f.total ?? 0) - importe);
            if (diff > 0.02) continue;
            const cliente = f.cliente?.nombre || "";
            const coincideNombre = nombreEnConcepto(cliente, concepto);
            // La referencia bancaria con el número de factura (3-2026-26)
            // es la prueba más fuerte que hay: gana a todo.
            const refVenta = normalizarTexto(f.serieNumero || "");
            const coincideRef = referencia && refVenta && (referencia.includes(refVenta) || refVenta.includes(referencia));
            const dias = diasEntre(f.fechaExpedicion ?? f.createdAt, mov.fecha);
            const puntos = (coincideRef ? -10000 : 0) + (coincideNombre ? 0 : 4000) + dias;
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
        // Último recurso: la remesa con diferencia pequeña (comisión del
        // banco descontada del abono).
        if (!mejor && remesaTolerante) mejor = remesaTolerante;
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
          // Solo facturas con algo pendiente de pago.
          if (Math.round(((f.total ?? 0) - sumaPagos(f)) * 100) <= 0) continue;
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

      if (!mejor) {
        // Sin candidato: queda registrado en la auditoría para saber qué
        // movimientos revisó la pasada automática y no casó.
        await ConciliacionLog.create({
          accion: "conciliacion",
          modo: "automatica",
          movimiento: { id: mov._id, fecha: mov.fecha, concepto: mov.concepto, importe: mov.importe },
          notas: `Sin candidato automático para "${mov.concepto}" (${importe} €)`,
        }).catch(() => {});
        continue;
      }

      // Salvaguardas: sin nombre ni referencia que apoyen, solo si la fecha
      // es muy cercana (evita casar por casualidad importes repetidos).
      if (
        (mejor.tipo === "factura_compra" && mejor.puntos >= 4000 && mejor.dias > 45) ||
        (mejor.tipo === "gasto" && mejor.puntos >= 4000 && mejor.dias > 45) ||
        (mejor.tipo === "factura_venta" && mejor.puntos >= 4000 && mejor.dias > 45)
      ) {
        await ConciliacionLog.create({
          accion: "conciliacion",
          modo: "automatica",
          movimiento: { id: mov._id, fecha: mov.fecha, concepto: mov.concepto, importe: mov.importe },
          documento: {
            tipo: mejor.tipo,
            id: mejor.doc?._id ?? null,
            descripcion: mejor.doc?.serieNumero ?? mejor.doc?.numeroFacturaProveedor ?? mejor.doc?.comercio ?? "",
            criterio: "descartado: sin nombre ni referencia y fecha lejana",
          },
        }).catch(() => {});
        continue;
      }

      // Reservar el movimiento en exclusiva: si otra ejecución paralela ya
      // lo concilió o lo tiene en curso, findOneAndUpdate no lo encuentra y
      // se salta (evita cobros/pagos/gastos duplicados). El bloqueo caduca
      // a los 2 minutos por si un proceso muere a mitad.
      const claim = await MovimientoBancario.findOneAndUpdate(
        {
          _id: mov._id,
          "conciliadoCon.tipo": null,
          $or: [{ bloqueo: null }, { bloqueo: { $lt: new Date(Date.now() - 2 * 60 * 1000) } }],
        },
        { $set: { bloqueo: new Date() } }
      );
      if (!claim) continue;

      const marcador = `extracto:${mov._id}`;
      let descripcion = "";

      if (mejor.tipo === "factura_compra") {
        const fc = mejor.doc;
        const pendiente = Math.round(((fc.total ?? 0) - sumaPagos(fc)) * 100) / 100;
        if (pendiente > 0) {
          // $push atómico + condición anti-duplicado por marcador.
          const notaPago = `Conciliación automática extracto: ${mov.concepto} (${marcador})`;
          await FacturaCompra.updateOne(
            { _id: fc._id, "pagos.nota": { $ne: notaPago } },
            {
              $push: {
                pagos: {
                  importe: Math.min(pendiente, importe),
                  fecha: mov.fecha ?? new Date(),
                  metodo: "transferencia",
                  nota: notaPago,
                },
              },
            }
          );
        }
        descripcion = fc.numeroFacturaProveedor || fc.proveedor?.nombre || "factura";
      } else if (mejor.tipo === "gasto") {
        descripcion = mejor.doc.comercio || "gasto";
      } else if (mejor.tipo === "factura_venta") {
        const fv = mejor.doc;
        const pendiente = Math.round(((fv.total ?? 0) - sumaCobros(fv)) * 100) / 100;
        if (pendiente > 0) {
          const notaCobro = `Conciliación automática extracto: ${mov.concepto} (${marcador})`;
          await FacturaVenta.updateOne(
            { _id: fv._id, "cobros.notas": { $ne: notaCobro } },
            {
              $push: {
                cobros: {
                  fecha: mov.fecha ?? new Date(),
                  importe: Math.min(pendiente, importe),
                  metodo: "transferencia",
                  notas: notaCobro,
                },
              },
            }
          );
        }
        descripcion = fv.serieNumero || fv.cliente?.nombre || "factura de venta";
      } else if (mejor.tipo === "facturas_venta") {
        // Grupo de facturas del mismo cliente cobradas con una remesa SEPA
        // que no existe como documento en FILANEX.
        const numeros = [];
        for (const fv of mejor.grupo) {
          const pendiente = Math.round(((fv.total ?? 0) - sumaCobros(fv)) * 100) / 100;
          if (pendiente > 0) {
            const notaCobro = `Conciliación automática remesa sin documento (${marcador})`;
            await FacturaVenta.updateOne(
              { _id: fv._id, "cobros.notas": { $ne: notaCobro } },
              {
                $push: {
                  cobros: {
                    fecha: mov.fecha ?? new Date(),
                    importe: pendiente,
                    metodo: "remesa",
                    notas: notaCobro,
                  },
                },
              }
            );
          }
          numeros.push(fv.serieNumero || "factura");
        }
        descripcion = `${numeros.join(" + ")} · ${mejor.grupo[0].cliente?.nombre || "cliente"}`;
      } else if (mejor.tipo === "remesa") {
        const remesa = mejor.doc;
        // Las facturas de la remesa ya están cargadas en memoria: no hay
        // que consultar la base de datos por cada recibo.
        for (const recibo of remesa.recibos ?? []) {
          if (!recibo.facturaVenta) continue;
          const fv = ventas.find((x) => String(x._id) === String(recibo.facturaVenta));
          if (!fv || fv.estado !== "emitida") continue;
          const pendienteFv = Math.round(((fv.total ?? 0) - sumaCobros(fv)) * 100) / 100;
          if (pendienteFv > 0) {
            const notaCobro = `Conciliación automática remesa (${marcador})`;
            await FacturaVenta.updateOne(
              { _id: fv._id, "cobros.notas": { $ne: notaCobro } },
              {
                $push: {
                  cobros: {
                    fecha: mov.fecha ?? remesa.fechaCargo,
                    importe: Math.min(pendienteFv, recibo.importe ?? pendienteFv),
                    metodo: "remesa",
                    notas: notaCobro,
                  },
                },
              }
            );
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

      // Escritura final atómica: enlaces + notas + liberar el bloqueo.
      const notasConciliacion = `Conciliación automática: ${descripcion}`;
      await MovimientoBancario.updateOne(
        { _id: mov._id },
        {
          $set: {
            conciliadoCon: mejor.tipo === "facturas_venta"
              ? { tipo: mejor.tipo, id: mejor.grupo[0]._id, fecha: new Date() }
              : mejor.tipo === "movimiento_tesoreria"
                ? { tipo: mejor.tipo, id: null, fecha: new Date() }
                : { tipo: mejor.tipo, id: mejor.doc._id, fecha: new Date() },
            notas: notasConciliacion,
          },
          $unset: { bloqueo: "" },
        }
      );
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
        notas: notasConciliacion,
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

    // Reservar el movimiento en exclusiva (evita doble conciliación manual
    // o contra la automática en paralelo).
    const claim = await MovimientoBancario.findOneAndUpdate(
      { _id: mov._id, "conciliadoCon.tipo": null },
      { $set: { bloqueo: new Date() } }
    );
    if (!claim) return res.status(409).json({ error: "El movimiento ya está conciliado" });
    // Si la conciliación manual no llega a aplicarse (factura equivocada,
    // ya pagada...), la reserva se libera al momento, no en 2 minutos.
    const liberar = () =>
      MovimientoBancario.updateOne({ _id: mov._id }, { $unset: { bloqueo: "" } }).catch(() => {});

    if (tipo === "factura_compra") {
      const fc = await FacturaCompra.findById(id);
      if (!fc) { await liberar(); return res.status(404).json({ error: "Factura no encontrada" }); }
      if (fc.estado !== "validada") { await liberar(); return res.status(409).json({ error: "Solo se concilian facturas validadas" }); }
      const pendiente = Math.round(((fc.total ?? 0) - sumaPagos(fc)) * 100) / 100;
      if (pendiente > 0) {
        const importeAplicar = Math.min(pendiente, importe);
        if (importeAplicar <= 0) { await liberar(); return res.status(409).json({ error: "La factura ya está pagada" }); }
        const notaPago = `Conciliado con extracto: ${mov.concepto} (${marcador})`;
        await FacturaCompra.updateOne(
          { _id: fc._id, "pagos.nota": { $ne: notaPago } },
          { $push: { pagos: { importe: importeAplicar, fecha: mov.fecha ?? new Date(), metodo: "transferencia", nota: notaPago } } }
        );
      }
    } else if (tipo === "gasto") {
      const g = await Gasto.findById(id);
      if (!g) { await liberar(); return res.status(404).json({ error: "Gasto no encontrado" }); }
    } else if (tipo === "factura_venta") {
      const fv = await FacturaVenta.findById(id);
      if (!fv) { await liberar(); return res.status(404).json({ error: "Factura no encontrada" }); }
      if (fv.estado !== "emitida") { await liberar(); return res.status(409).json({ error: "Solo se concilian facturas emitidas" }); }
      const pendiente = Math.round(((fv.total ?? 0) - sumaCobros(fv)) * 100) / 100;
      if (pendiente > 0) {
        const importeAplicar = Math.min(pendiente, importe);
        if (importeAplicar <= 0) { await liberar(); return res.status(409).json({ error: "La factura ya está cobrada" }); }
        const notaCobro = `Conciliado con extracto: ${mov.concepto} (${marcador})`;
        await FacturaVenta.updateOne(
          { _id: fv._id, "cobros.notas": { $ne: notaCobro } },
          { $push: { cobros: { fecha: mov.fecha ?? new Date(), importe: importeAplicar, metodo: "transferencia", notas: notaCobro } } }
        );
      }
    } else if (tipo === "remesa") {
      const remesa = await Remesa.findById(id);
      if (!remesa) { await liberar(); return res.status(404).json({ error: "Remesa no encontrada" }); }
      for (const recibo of remesa.recibos ?? []) {
        if (!recibo.facturaVenta) continue;
        const fv = await FacturaVenta.findById(recibo.facturaVenta);
        if (!fv || fv.estado !== "emitida") continue;
        const pendienteFv = Math.round(((fv.total ?? 0) - sumaCobros(fv)) * 100) / 100;
        if (pendienteFv > 0) {
          const notaCobro = `Conciliado con extracto: remesa (${marcador})`;
          await FacturaVenta.updateOne(
            { _id: fv._id, "cobros.notas": { $ne: notaCobro } },
            { $push: { cobros: { fecha: mov.fecha ?? remesa.fechaCargo, importe: Math.min(pendienteFv, recibo.importe ?? pendienteFv), metodo: "remesa", notas: notaCobro } } }
          );
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
      await liberar();
      return res.status(400).json({ error: "Tipo de conciliación no soportado" });
    }

    const notasFinales = req.body.notas || mov.notas;
    await MovimientoBancario.updateOne(
      { _id: mov._id },
      {
        $set: { conciliadoCon: { tipo, id: id || null, fecha: new Date() }, notas: notasFinales },
        $unset: { bloqueo: "" },
      }
    );
    mov.conciliadoCon = { tipo, id: id || null, fecha: new Date() };
    mov.notas = notasFinales;

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
    const marcadorRegex = new RegExp(marcador.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    // $pull atómico de pagos/cobros creados por esta conciliación: dos
    // desconciliaciones simultáneas no pueden duplicar ni perder nada.
    if (mov.conciliadoCon.tipo === "factura_compra") {
      await FacturaCompra.updateOne(
        { _id: mov.conciliadoCon.id },
        { $pull: { pagos: { nota: { $regex: marcadorRegex } } } }
      );
    } else if (mov.conciliadoCon.tipo === "factura_venta") {
      await FacturaVenta.updateOne(
        { _id: mov.conciliadoCon.id },
        { $pull: { cobros: { notas: { $regex: marcadorRegex } } } }
      );
    } else if (mov.conciliadoCon.tipo === "remesa" || mov.conciliadoCon.tipo === "facturas_venta") {
      // Los cobros se repartieron entre varias facturas: buscar por marcador.
      const afectadas = await FacturaVenta.find({ "cobros.notas": { $regex: marcadorRegex } }, "_id");
      for (const fv of afectadas) {
        await FacturaVenta.updateOne(
          { _id: fv._id },
          { $pull: { cobros: { notas: { $regex: marcadorRegex } } } }
        );
      }
    } else if (mov.conciliadoCon.tipo === "movimiento_tesoreria") {
      // Si la conciliación automática creó un gasto (liquidación del banco),
      // se borra al desconciliar para no dejar basura contable.
      await Gasto.deleteMany({ notas: { $regex: marcadorRegex }, comercio: "Banco" });
    }

    await MovimientoBancario.updateOne(
      { _id: mov._id },
      { $set: { conciliadoCon: { tipo: null, id: null, fecha: null } } }
    );

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
