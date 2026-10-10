import { Router } from "express";
import XLSX from "xlsx";
import MovimientoBancario from "../models/MovimientoBancario.js";
import FacturaCompra from "../models/FacturaCompra.js";
import { uploadMemoria } from "../middleware/upload.js";
import { contextoActual, conContexto, slugActual } from "../models/tenant.js";
import { contextoTrasSubida } from "../middleware/empresa.js";
import { guardarArchivo, urlPublica } from "../services/storage.js";

const router = Router();
const subida = uploadMemoria;

// Normaliza una fecha que puede venir como string o Date.
function parseFecha(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d;
  // Prueba formato dd/mm/aaaa o dd-mm-aaaa.
  const partes = String(v).trim().split(/[\/\-]/);
  if (partes.length === 3) {
    const [d1, m1, y1] = partes.map((p) => parseInt(p, 10));
    const anyo = y1 < 100 ? 2000 + y1 : y1;
    const prueba = new Date(anyo, m1 - 1, d1);
    if (!isNaN(prueba.getTime())) return prueba;
  }
  return null;
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
function detectarColumnas(cabeceras) {
  const lower = cabeceras.map((h) => String(h ?? "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const buscar = (alternativas) => {
    for (const alt of alternativas) {
      const idx = lower.findIndex((h) => h.includes(alt));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  return {
    fecha: buscar(["fecha operacion", "fecha", "date", "data", "f."]),
    concepto: buscar(["concepto", "descripcion", "descripcion", "movimiento", "operation", "description", "titular"]),
    importe: buscar(["importe", "cantidad", "amount", "cargo/abono", "cargo"]),
    saldo: buscar(["saldo", "balance"]),
    referencia: buscar(["numero de documento", "referencia", "ref.", "numero", "operation id", "reference"]),
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

// GET /api/tesoreria/extractos/coincidencias?importe=-123.45&fecha=2026-10-01
// Busca facturas de compra validadas y devuelve las que más se acerquen al
// importe del cargo (en EUR o en divisa original). Incluye facturas ya pagadas
// para poder vincular el movimiento bancario aunque el pago fuera por recibo
// domiciliado.
router.get("/coincidencias", async (req, res, next) => {
  try {
    const importe = Math.abs(parseFloat(req.query.importe) || 0);
    if (!importe) return res.status(400).json({ error: "Falta importe" });

    const facturas = await FacturaCompra.find({
      estado: "validada",
      total: { $gt: 0 },
    })
      .populate("proveedor", "nombre nif")
      .sort({ fechaExpedicion: -1 })
      .limit(500);

    const conDistancia = facturas.map((f) => {
      const pagado = (f.pagos ?? []).reduce((s, p) => s + (p.importe ?? 0), 0);
      const pendiente = Math.round(((f.total ?? 0) - pagado) * 100) / 100;
      const diffEur = Math.abs((f.total ?? 0) - importe);
      const diffDiv = f.totalDivisa && f.divisa !== "EUR"
        ? Math.abs(f.totalDivisa - importe)
        : Infinity;
      const diferencia = Math.min(diffEur, diffDiv);
      const importeReferencia = diffDiv < diffEur ? f.totalDivisa : f.total;
      const diffFecha = Math.abs(
        new Date(f.fechaExpedicion ?? f.createdAt).setHours(0, 0, 0, 0) - new Date(req.query.fecha || Date.now()).setHours(0, 0, 0, 0)
      );
      return {
        ...f.toObject(),
        pendiente,
        pagado,
        diferencia,
        importeReferencia,
        diffFecha,
      };
    });

    const candidatas = conDistancia
      .sort((a, b) => {
        if (a.diferencia !== b.diferencia) return a.diferencia - b.diferencia;
        return a.diffFecha - b.diffFecha;
      })
      .slice(0, 30);

    res.json({ importe, candidatas });
  } catch (err) {
    next(err);
  }
});

// POST /api/tesoreria/extractos/conciliar-automatico
// Concilia automáticamente todos los movimientos pendientes buscando por
// importe, proximidad de fecha y, si existe, referencia bancaria.
router.post("/conciliar-automatico", async (req, res, next) => {
  try {
    const { soloIds } = req.body || {};
    const movimientosPendientes = await MovimientoBancario.find({
      "conciliadoCon.tipo": null,
      importe: { $lt: 0 },
    }).sort({ fecha: -1 });

    const facturas = await FacturaCompra.find({
      estado: "validada",
      total: { $gt: 0 },
    }).populate("proveedor", "nombre nif");

    const resultados = [];
    const usadas = new Set();

    for (const mov of movimientosPendientes) {
      if (soloIds?.length && !soloIds.includes(String(mov._id))) continue;

      const importe = Math.abs(mov.importe);
      const fechaMov = new Date(mov.fecha).setHours(0, 0, 0, 0);
      const referencia = String(mov.referencia || "").trim().toLowerCase();

      let mejor = null;
      let mejorPuntuacion = Infinity;

      for (const fc of facturas) {
        if (usadas.has(String(fc._id))) continue;
        const pagado = fc.pagado();
        const pendiente = Math.round(((fc.total ?? 0) - pagado) * 100) / 100;
        const diffEur = Math.abs((fc.total ?? 0) - importe);
        const diffDiv = fc.totalDivisa && fc.divisa !== "EUR"
          ? Math.abs(fc.totalDivisa - importe)
          : Infinity;
        const diferencia = Math.min(diffEur, diffDiv);
        if (diferencia > 0.01) continue; // importe exacto (con margen de céntimo)

        const fechaFc = new Date(fc.fechaExpedicion ?? fc.createdAt).setHours(0, 0, 0, 0);
        const diffFecha = Math.abs(fechaFc - fechaMov);
        const diffDias = Math.ceil(diffFecha / (1000 * 60 * 60 * 24));

        const refFc = String(fc.numeroFacturaProveedor || "").trim().toLowerCase();
        const coincideRef = referencia && refFc && (referencia.includes(refFc) || refFc.includes(referencia));

        // Puntuación: preferimos referencia, luego cercanía de fecha.
        const puntuacion = (coincideRef ? 0 : 10000) + diffDias;
        if (puntuacion < mejorPuntuacion) {
          mejorPuntuacion = puntuacion;
          mejor = { fc, pendiente };
        }
      }

      if (mejor) {
        const { fc, pendiente } = mejor;
        if (pendiente > 0) {
          const importeAplicar = Math.min(pendiente, importe);
          if (importeAplicar > 0) {
            fc.pagos.push({
              importe: importeAplicar,
              fecha: mov.fecha ?? new Date(),
              metodo: "transferencia",
              nota: `Conciliado automáticamente con extracto: ${mov.concepto}`,
            });
            await fc.save();
          }
        }
        mov.conciliadoCon = { tipo: "factura_compra", id: fc._id, fecha: new Date() };
        mov.notas = `Conciliación automática: ${fc.numeroFacturaProveedor || fc.proveedor?.nombre || "factura"}`;
        await mov.save();
        usadas.add(String(fc._id));
        resultados.push({
          movimiento: mov._id,
          factura: fc._id,
          numeroFacturaProveedor: fc.numeroFacturaProveedor,
          importe,
          automatico: true,
        });
      }
    }

    res.json({ ok: true, conciliados: resultados.length, resultados });
  } catch (err) {
    next(err);
  }
});

// POST /api/tesoreria/extractos/upload
// Sube un CSV/Excel de extracto bancario y crea los movimientos.
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

    const slug = slugActual();
    const nombreFichero = `${Date.now()}-${req.file.originalname.replace(/[^\w.\-]+/g, "_")}`;
    const remoto = `uploads/${slug}/extractos/${nombreFichero}`;
    await guardarArchivo(remoto, req.file.buffer, req.file.mimetype || "application/octet-stream");
    const archivoUrl = urlPublica(remoto);

    return await conContexto(empresa, async () => {
      const docs = await MovimientoBancario.insertMany(
        movimientos.map((m) => ({ ...m, archivoUrl })),
        { ordered: false }
      );
      res.status(201).json({ insertados: docs.length, archivoUrl });
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tesoreria/extractos/:id/conciliar
// Vincula un movimiento bancario con una factura de compra y crea el pago.
router.post("/:id/conciliar", async (req, res, next) => {
  try {
    const mov = await MovimientoBancario.findById(req.params.id);
    if (!mov) return res.status(404).json({ error: "Movimiento no encontrado" });
    if (mov.conciliadoCon?.tipo) {
      return res.status(409).json({ error: "El movimiento ya está conciliado" });
    }

    const { tipo, id, importePago } = req.body;
    if (!tipo || !id) return res.status(400).json({ error: "Faltan tipo o id" });

    if (tipo === "factura_compra") {
      const fc = await FacturaCompra.findById(id);
      if (!fc) return res.status(404).json({ error: "Factura no encontrada" });
      if (fc.estado !== "validada") return res.status(409).json({ error: "Solo se concilian facturas validadas" });
      const pagado = fc.pagado();
      const pendiente = Math.round(((fc.total ?? 0) - pagado) * 100) / 100;
      if (pendiente > 0) {
        const importeAplicar = Math.min(pendiente, Math.abs(importePago ?? mov.importe ?? 0));
        if (importeAplicar <= 0) return res.status(409).json({ error: "La factura ya está pagada" });
        fc.pagos.push({ importe: importeAplicar, fecha: mov.fecha ?? new Date(), metodo: "transferencia", nota: `Conciliado con extracto: ${mov.concepto}` });
        await fc.save();
      }
      mov.conciliadoCon = { tipo, id: fc._id, fecha: new Date() };
      mov.notas = req.body.notas || mov.notas;
      await mov.save();
      return res.json({ ok: true, movimiento: mov, factura: fc });
    }

    if (tipo === "manual") {
      mov.conciliadoCon = { tipo: "manual", id, fecha: new Date() };
      mov.notas = req.body.notas || mov.notas;
      await mov.save();
      return res.json({ ok: true, movimiento: mov });
    }

    return res.status(400).json({ error: "Tipo de conciliación no soportado" });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tesoreria/extractos/:id/conciliacion
// Desconcilia un movimiento. Si era factura de compra, elimina el pago creado.
router.delete("/:id/conciliacion", async (req, res, next) => {
  try {
    const mov = await MovimientoBancario.findById(req.params.id);
    if (!mov) return res.status(404).json({ error: "Movimiento no encontrado" });
    if (!mov.conciliadoCon?.tipo) return res.json({ ok: true });

    if (mov.conciliadoCon.tipo === "factura_compra") {
      const fc = await FacturaCompra.findById(mov.conciliadoCon.id);
      if (fc) {
        // Borra el pago que añadimos en la conciliación (misma nota y fecha).
        fc.pagos = (fc.pagos ?? []).filter(
          (p) => !(String(p.nota ?? "").includes("Conciliado con extracto") && String(p.fecha) === String(mov.conciliadoCon.fecha))
        );
        await fc.save();
      }
    }

    mov.conciliadoCon = { tipo: null, id: null, fecha: null };
    await mov.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tesoreria/extractos/:id
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
