import { Router } from "express";
import Gasto, {
  CATEGORIAS_GASTO,
  deduciblePorCategoria,
  FORMAS_PAGO_GASTO,
} from "../models/Gasto.js";
import { extraerTicket } from "../services/ocr-gemini.js";
import { normalizarNIF } from "../services/validacion.js";
import { contextoActual, conContexto } from "../models/tenant.js";
import { contextoTrasSubida } from "../middleware/empresa.js";
import { uploadMemoria, borrarSubida } from "../middleware/upload.js";
import { guardarArchivo, urlPublica } from "../services/storage.js";
import { slugActual } from "../models/tenant.js";

// Gastos justificados con ticket. El flujo es el mismo que el del OCR de
// compras: se sube la foto, se extraen los datos y el gasto queda PENDIENTE
// DE REVISIÓN. Nunca se da nada por bueno de forma automática.

const router = Router();

const subida = uploadMemoria;

const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Con el total y el tipo de IVA se saca la base; si el ticket trae la base
// desglosada, se respeta lo que venía impreso.
function cuadrarImportes({ base, cuotaIva, total, tipoIva }) {
  const tipo = Number.isFinite(Number(tipoIva)) ? Number(tipoIva) : 21;
  let b = Number(base) || 0;
  let c = Number(cuotaIva) || 0;
  let t = Number(total) || 0;

  if (t <= 0 && b > 0) t = b + (c || (b * tipo) / 100);
  if (b <= 0 && t > 0) b = t / (1 + tipo / 100);
  if (c <= 0) c = t - b;

  return { base: redondear(b), cuotaIva: redondear(c), total: redondear(t), tipoIva: tipo };
}

// Datos derivados que la pantalla necesita pero no se guardan.
function conDerivados(gasto) {
  return { ...gasto.toObject(), ivaDeducibleImporte: gasto.ivaDeducible() };
}

// Catálogo de categorías con su porcentaje de IVA deducible y la explicación.
router.get("/categorias", (req, res) => {
  res.json({ categorias: CATEGORIAS_GASTO, formasPago: FORMAS_PAGO_GASTO });
});

// Resumen por categoría del periodo, para saber en qué se va el dinero.
router.get("/resumen", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.desde || req.query.hasta) {
      filtro.fecha = {};
      if (req.query.desde) filtro.fecha.$gte = new Date(req.query.desde);
      if (req.query.hasta) filtro.fecha.$lte = new Date(`${req.query.hasta}T23:59:59.999`);
    }
    const filas = await Gasto.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: "$categoria",
          total: { $sum: "$total" },
          base: { $sum: "$base" },
          cuotaIva: { $sum: "$cuotaIva" },
          cuantos: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);
    res.json(filas.map((f) => ({ categoria: f._id, ...f, _id: undefined })));
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.estado) filtro.estado = req.query.estado;
    if (req.query.categoria) filtro.categoria = req.query.categoria;
    if (req.query.desde || req.query.hasta) {
      filtro.fecha = {};
      if (req.query.desde) filtro.fecha.$gte = new Date(req.query.desde);
      if (req.query.hasta) filtro.fecha.$lte = new Date(`${req.query.hasta}T23:59:59.999`);
    }
    // Búsqueda libre por comercio, NIF, concepto, quien pagó o notas.
    const q = String(req.query.q ?? "").trim();
    if (q) {
      const exp = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filtro.$or = [
        { comercio: exp },
        { nifComercio: exp },
        { concepto: exp },
        { pagadoPor: exp },
        { notas: exp },
      ];
    }
    const lista = await Gasto.find(filtro)
      .populate("proveedor", "nombre nif")
      .sort({ fecha: -1, createdAt: -1 })
      .limit(Number(req.query.limite) || 300);
    res.json(lista.map(conDerivados));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const gasto = await Gasto.findById(req.params.id).populate("proveedor", "nombre nif");
    if (!gasto) return res.status(404).json({ error: "Gasto no encontrado" });
    res.json(conDerivados(gasto));
  } catch (err) {
    next(err);
  }
});

// Prepara el cuerpo que llega de la pantalla: importes cuadrados y el
// porcentaje de IVA deducible de la categoría si no se indica otro.
function datosDesdeCuerpo(cuerpo, previo = {}) {
  const categoria = cuerpo.categoria ?? previo.categoria ?? "otros";
  const importes = cuadrarImportes({
    base: cuerpo.base ?? previo.base,
    cuotaIva: cuerpo.cuotaIva ?? previo.cuotaIva,
    total: cuerpo.total ?? previo.total,
    tipoIva: cuerpo.tipoIva ?? previo.tipoIva,
  });
  const datos = {
    ...importes,
    categoria,
    comercio: cuerpo.comercio ?? previo.comercio,
    nifComercio: cuerpo.nifComercio ? normalizarNIF(cuerpo.nifComercio) : previo.nifComercio,
    proveedor: cuerpo.proveedor ?? previo.proveedor ?? undefined,
    concepto: cuerpo.concepto ?? previo.concepto,
    fecha: cuerpo.fecha ? new Date(cuerpo.fecha) : previo.fecha ?? new Date(),
    conDatosFiscales:
      cuerpo.conDatosFiscales !== undefined ? !!cuerpo.conDatosFiscales : !!previo.conDatosFiscales,
    pagadoCon: cuerpo.pagadoCon ?? previo.pagadoCon ?? "tarjeta_empresa",
    pagadoPor: cuerpo.pagadoPor ?? previo.pagadoPor,
    reembolsado: cuerpo.reembolsado !== undefined ? !!cuerpo.reembolsado : !!previo.reembolsado,
    notas: cuerpo.notas ?? previo.notas,
  };
  datos.ivaDeduciblePct =
    cuerpo.ivaDeduciblePct !== undefined && cuerpo.ivaDeduciblePct !== null
      ? Number(cuerpo.ivaDeduciblePct)
      : deduciblePorCategoria(categoria);
  if (cuerpo.estado) datos.estado = cuerpo.estado;
  return datos;
}

// Alta manual (sin foto): útil para el ticket que ya se perdió o el gasto
// que se apunta desde el móvil sin sacar la cámara.
router.post("/", async (req, res, next) => {
  try {
    if (!String(req.body.comercio ?? "").trim()) {
      return res.status(400).json({ error: "El comercio es obligatorio" });
    }
    if (!Number(req.body.total) && !Number(req.body.base)) {
      return res.status(400).json({ error: "El importe del gasto es obligatorio" });
    }
    const gasto = await Gasto.create({ ...datosDesdeCuerpo(req.body), origen: "manual" });
    res.status(201).json(conDerivados(gasto));
  } catch (err) {
    next(err);
  }
});

// Foto del ticket -> OCR -> gasto pendiente de revisión, con la imagen
// guardada como justificante. Ojo: la foto no libera de guardar el papel
// salvo digitalización certificada homologada por la AEAT.
router.post("/ticket", subida.single("ticket"), contextoTrasSubida, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Adjunta la foto del ticket (JPG, PNG, WEBP o PDF)" });
    }
    const tiposValidos = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!tiposValidos.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Adjunta la foto del ticket (JPG, PNG, WEBP o PDF)" });
    }

    // La empresa de la petición se guarda antes de llamar al OCR: esa espera
    // es larga y puede volver con el contexto de otra petición.
    const empresa = contextoActual();

    // El OCR puede fallar por saturación del servicio: se avisa con su
    // propio mensaje en lugar de un "error interno" que no dice nada.
    let extraccion;
    try {
      extraccion = await extraerTicket(req.file);
    } catch (fallo) {
      return res.status(502).json({ error: fallo.message });
    }

    return await conContexto(empresa, async () => {
      const nombreFichero = `${Date.now()}-${(req.file.originalname || "ticket.jpg").replace(/[^\w.\-]+/g, "_")}`;
      const remoto = `uploads/${slugActual()}/tickets/${nombreFichero}`;
      await guardarArchivo(remoto, req.file.buffer, req.file.mimetype || "application/octet-stream");
      const ficheroUrl = urlPublica(remoto);

      const avisos = [];
      if (!extraccion.conDatosFiscales) {
        avisos.push(
          "El ticket no lleva tus datos fiscales: el IVA no es deducible. Pide factura al establecimiento si te interesa deducirlo."
        );
      }
      const pct = deduciblePorCategoria(extraccion.categoria ?? "otros");
      if (pct < 100) {
        avisos.push(`Por su categoría, el IVA de este gasto solo es deducible al ${pct} %.`);
      }
      if ((extraccion.confianza ?? 0) < 0.6) {
        avisos.push("La foto se ha leído con poca seguridad: revisa los importes antes de validar.");
      }
      // Lo que las comprobaciones automáticas no han podido cuadrar (importes
      // que no suman, NIF con letra incorrecta, fecha imposible…).
      for (const pega of extraccion._ocr?.avisos ?? []) {
        avisos.push(`Revisa antes de validar: ${pega}.`);
      }

      const gasto = await Gasto.create({
        ...datosDesdeCuerpo({
          comercio: extraccion.comercio,
          nifComercio: extraccion.nifComercio,
          concepto: extraccion.concepto,
          categoria: extraccion.categoria ?? "otros",
          fecha: extraccion.fecha,
          base: extraccion.base,
          cuotaIva: extraccion.cuotaIva,
          total: extraccion.total,
          tipoIva: extraccion.tipoIva,
          conDatosFiscales: extraccion.conDatosFiscales,
          pagadoCon: req.body.pagadoCon,
          pagadoPor: req.body.pagadoPor,
        }),
        origen: "ocr",
        ficheroUrl,
        ocr: { confianza: extraccion.confianza, datosExtraidos: { ...extraccion, avisos } },
      });

      res.status(201).json({ ...conDerivados(gasto), avisos });
    });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const gasto = await Gasto.findById(req.params.id);
    if (!gasto) return res.status(404).json({ error: "Gasto no encontrado" });
    Object.assign(gasto, datosDesdeCuerpo(req.body, gasto.toObject()));
    await gasto.save();
    res.json(conDerivados(gasto));
  } catch (err) {
    next(err);
  }
});

// Revisado y correcto: ya cuenta para el libro de gastos y el 303.
router.post("/:id/validar", async (req, res, next) => {
  try {
    const gasto = await Gasto.findById(req.params.id);
    if (!gasto) return res.status(404).json({ error: "Gasto no encontrado" });
    gasto.estado = "validado";
    await gasto.save();
    res.json(conDerivados(gasto));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const gasto = await Gasto.findByIdAndDelete(req.params.id);
    if (!gasto) return res.status(404).json({ error: "Gasto no encontrado" });
    if (gasto.ficheroUrl) {
      await borrarSubida(gasto.ficheroUrl).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
