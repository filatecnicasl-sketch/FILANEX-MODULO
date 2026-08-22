import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import FacturaCompra from "../models/FacturaCompra.js";
import AlbaranCompra from "../models/AlbaranCompra.js";
import Proveedor from "../models/Proveedor.js";
import Articulo from "../models/Articulo.js";
import { extraerDocumentoCompra } from "../services/ocr-gemini.js";
import { validarNIF, normalizarNIF, revisarAritmetica } from "../services/validacion.js";
import { buscarProveedor, sugerirArticulos } from "../services/matching.js";
import { calcularTotales } from "../services/totales.js";
import { siguienteCodigoArticulo } from "../services/codigoArticulo.js";

const router = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const tipos = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    cb(null, tipos.includes(file.mimetype));
  },
});

// Añade pagado acumulado y estado de pago derivados (no persistidos).
function conPagos(f) {
  const obj = f.toObject ? f.toObject() : f;
  return { ...obj, pagado: f.pagado(), estadoPago: f.estadoPago() };
}

router.get("/", async (req, res, next) => {
  try {
    const filtro = req.query.estado ? { estado: req.query.estado } : {};
    const lista = await FacturaCompra.find(filtro)
      .populate("proveedor", "nombre nif")
      .populate("albaranes", "numero numeroAlbaran")
      .sort({ createdAt: -1 })
      .limit(200);
    let resultado = lista.map(conPagos);
    if (req.query.pendientesPago === "1") {
      resultado = resultado.filter((f) => f.estado === "validada" && f.estadoPago !== "pagada");
    }
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// Alta manual de factura de compra: nace pendiente de revisión, igual que
// las del OCR — toda compra pasa por validación humana antes de contabilizar.
router.post("/", async (req, res, next) => {
  try {
    const { proveedor, numeroFacturaProveedor, notas } = req.body;
    if (!proveedor) return res.status(400).json({ error: "El proveedor es obligatorio" });
    const lineas = Array.isArray(req.body.lineas) ? req.body.lineas.filter((l) => l.descripcion) : [];
    if (lineas.length === 0) return res.status(400).json({ error: "Añade al menos una línea" });

    const fecha = req.body.fechaExpedicion ?? req.body.fecha;
    const factura = await FacturaCompra.create({
      proveedor,
      numeroFacturaProveedor: numeroFacturaProveedor || undefined,
      fechaExpedicion: fecha ? new Date(fecha) : new Date(),
      lineas,
      ...calcularTotales(lineas),
      estado: "pendiente_revision",
      origen: "manual",
    });
    res.status(201).json(await factura.populate("proveedor", "nombre nif"));
  } catch (err) {
    next(err);
  }
});

// Subida de documento (PDF o imagen) -> extracción Gemini -> validaciones
// -> matching -> borrador pendiente de revisión. Nada se contabiliza solo.
router.post("/ocr", subida.single("documento"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Falta el fichero (campo 'documento') o el tipo no es PDF/PNG/JPG/WEBP" });
    }

    const extraccion = await extraerDocumentoCompra(req.file);

    const avisos = [];
    const nifOcr = extraccion?.proveedor?.nif;
    if (!nifOcr) avisos.push("El documento no muestra NIF del proveedor");
    else if (!validarNIF(nifOcr)) avisos.push(`NIF "${nifOcr}" no supera el dígito de control`);
    avisos.push(...revisarAritmetica(extraccion.lineas ?? [], extraccion));
    const confianza = extraccion.confianza ?? 0;
    if (confianza < 0.75) avisos.push(`Confianza OCR baja (${Math.round(confianza * 100)}%)`);

    const proveedor = await buscarProveedor(extraccion.proveedor);
    const nombreFichero = `${Date.now()}-${req.file.originalname.replace(/[^\w.\-]+/g, "_")}`;
    fs.writeFileSync(path.join(uploadsDir, nombreFichero), req.file.buffer);
    const ficheroUrl = `/uploads/${nombreFichero}`;

    if (extraccion.tipoDocumento === "albaran") {
      const albaran = await AlbaranCompra.create({
        proveedor: proveedor?._id ?? null,
        numeroAlbaran: extraccion.numeroDocumento ?? null,
        fecha: extraccion.fecha ? new Date(extraccion.fecha) : null,
        lineas: extraccion.lineas ?? [],
        ocr: { confianza, ficheroUrl, datosExtraidos: { ...extraccion, avisos } },
      });
      return res.status(201).json({ tipo: "albaran", documento: albaran });
    }

    const sugerenciasLineas = await sugerirArticulos(proveedor?._id, extraccion.lineas ?? []);
    const factura = await FacturaCompra.create({
      proveedor: proveedor?._id ?? null,
      numeroFacturaProveedor: extraccion.numeroDocumento ?? null,
      fechaExpedicion: extraccion.fecha ? new Date(extraccion.fecha) : null,
      lineas: extraccion.lineas ?? [],
      baseImponible: extraccion.baseImponible ?? 0,
      cuotaIva: extraccion.cuotaIva ?? 0,
      total: extraccion.total ?? 0,
      estado: "pendiente_revision",
      origen: "ocr",
      ocr: {
        confianza,
        ficheroUrl,
        datosExtraidos: {
          ...extraccion,
          avisos,
          sugerenciasLineas,
          proveedorDetectado: proveedor ? "existente" : "nuevo",
        },
      },
    });

    res.status(201).json({ tipo: "factura", documento: factura });
  } catch (err) {
    if (err.message?.includes("GEMINI_API_KEY")) {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

// Validar: crea el proveedor y los artículos/servicios pendientes y
// marca la factura como validada. El usuario siempre confirma.
router.post("/:id/validar", async (req, res, next) => {
  try {
    const fc = await FacturaCompra.findById(req.params.id);
    if (!fc) return res.status(404).json({ error: "Factura no encontrada" });
    if (fc.estado !== "pendiente_revision") {
      return res.status(409).json({ error: `La factura ya está ${fc.estado}` });
    }

    const extra = fc.ocr?.datosExtraidos ?? {};

    if (!fc.proveedor && extra.proveedor?.nombre) {
      const nuevo = await Proveedor.create({
        nombre: extra.proveedor.nombre,
        nif: extra.proveedor.nif ? normalizarNIF(extra.proveedor.nif) : undefined,
        alias: [extra.proveedor.nombre],
        email: extra.proveedor.email,
        telefono: extra.proveedor.telefono,
      });
      fc.proveedor = nuevo._id;
    }

    const sugerencias = extra.sugerenciasLineas ?? [];
    for (let i = 0; i < fc.lineas.length; i++) {
      if (sugerencias[i]?.crear !== false && sugerencias[i]?.articuloId == null) {
        const l = fc.lineas[i];
        const tipo = extra.lineas?.[i]?.tipo === "servicio" ? "servicio" : "articulo";
        await Articulo.create({
          descripcion: l.descripcion,
          tipo,
          codigo: await siguienteCodigoArticulo(),
          precioCompra: l.precioUnitario,
          iva: l.iva,
          proveedor: fc.proveedor ?? undefined,
          origen: "ocr",
        });
      }
    }

    fc.estado = "validada";
    await fc.save();
    // TODO: cruce con albaranes pendientes de facturar del mismo proveedor
    res.json(fc);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/rechazar", async (req, res, next) => {
  try {
    const fc = await FacturaCompra.findByIdAndUpdate(
      req.params.id,
      { estado: "rechazada" },
      { new: true }
    );
    if (!fc) return res.status(404).json({ error: "Factura no encontrada" });
    res.json(fc);
  } catch (err) {
    next(err);
  }
});

// Conciliación: sincroniza los albaranes vinculados a la factura.
// Los añadidos pasan a "facturado"; los quitados vuelven a "confirmado".
router.post("/:id/conciliar", async (req, res, next) => {
  try {
    const fc = await FacturaCompra.findById(req.params.id);
    if (!fc) return res.status(404).json({ error: "Factura no encontrada" });
    if (fc.estado === "rechazada") {
      return res.status(409).json({ error: "La factura está rechazada" });
    }

    const nuevos = (Array.isArray(req.body.albaranIds) ? req.body.albaranIds : []).map(String);
    const actuales = (fc.albaranes ?? []).map(String);

    const docs = await AlbaranCompra.find({ _id: { $in: nuevos } });
    if (docs.length !== nuevos.length) {
      return res.status(404).json({ error: "Algún albarán no existe" });
    }
    for (const a of docs) {
      const nombre = a.numero ?? a.numeroAlbaran ?? a._id;
      if (fc.proveedor && String(a.proveedor) !== String(fc.proveedor)) {
        return res.status(409).json({ error: `El albarán ${nombre} es de otro proveedor` });
      }
      if (a.estado === "facturado" && String(a.facturaCompra) !== String(fc._id)) {
        return res.status(409).json({ error: `El albarán ${nombre} ya está conciliado en otra factura` });
      }
    }

    const quitados = actuales.filter((id) => !nuevos.includes(id));
    if (quitados.length > 0) {
      await AlbaranCompra.updateMany(
        { _id: { $in: quitados } },
        { estado: "confirmado", $unset: { facturaCompra: "" } }
      );
    }
    if (nuevos.length > 0) {
      await AlbaranCompra.updateMany(
        { _id: { $in: nuevos } },
        { estado: "facturado", facturaCompra: fc._id }
      );
    }

    fc.albaranes = nuevos;
    await fc.save();
    res.json(
      await fc.populate([
        { path: "proveedor", select: "nombre nif" },
        { path: "albaranes", select: "numero numeroAlbaran" },
      ])
    );
  } catch (err) {
    next(err);
  }
});

// Registra un pago (total o parcial) de una factura de compra validada.
router.post("/:id/pagos", async (req, res, next) => {
  try {
    const { importe, fecha, metodo, nota } = req.body;
    if (!(importe > 0)) return res.status(400).json({ error: "importe debe ser mayor que cero" });
    const factura = await FacturaCompra.findById(req.params.id);
    if (!factura) return res.status(404).json({ error: "Factura no encontrada" });
    if (factura.estado !== "validada") {
      return res.status(409).json({ error: "Solo se pagan facturas validadas" });
    }
    factura.pagos.push({ importe, fecha: fecha ? new Date(fecha) : new Date(), metodo, nota });
    await factura.save();
    res.json(conPagos(await factura.populate("proveedor", "nombre nif")));
  } catch (err) {
    next(err);
  }
});

// Borrar: solo si aún no está validada. Libera los albaranes conciliados.
router.delete("/:id", async (req, res, next) => {
  try {
    const fc = await FacturaCompra.findById(req.params.id);
    if (!fc) return res.status(404).json({ error: "Factura no encontrada" });
    if (fc.estado === "validada") {
      return res.status(409).json({ error: "Una factura validada no se puede borrar" });
    }
    if (fc.albaranes?.length > 0) {
      await AlbaranCompra.updateMany(
        { _id: { $in: fc.albaranes } },
        { estado: "confirmado", $unset: { facturaCompra: "" } }
      );
    }
    await fc.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
