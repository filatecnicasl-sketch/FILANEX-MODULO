import { Router } from "express";
import Remesa from "../models/Remesa.js";
import FacturaVenta from "../models/FacturaVenta.js";
import Empresa from "../models/Empresa.js";
import { xmlRemesaSepa } from "../services/sepa.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const lista = await Remesa.find().sort({ createdAt: -1 }).limit(100);
    res.json(lista.map((r) => ({ ...r.toObject(), xml: undefined })));
  } catch (err) {
    next(err);
  }
});

// Genera una remesa con las facturas emitidas y pendientes de cobro indicadas.
router.post("/", async (req, res, next) => {
  try {
    const { facturaIds, fechaCargo } = req.body;
    if (!Array.isArray(facturaIds) || facturaIds.length === 0 || !fechaCargo) {
      return res.status(400).json({ error: "facturaIds y fechaCargo son obligatorios" });
    }
    const empresa = await Empresa.findOne();
    if (!empresa?.sepa?.iban || !empresa?.sepa?.idAcreedor) {
      return res.status(503).json({
        error: "Faltan los datos SEPA de la empresa (IBAN e identificador de acreedor)",
      });
    }

    const facturas = await FacturaVenta.find({
      _id: { $in: facturaIds },
      estado: "emitida",
      remesa: null,
    }).populate("cliente", "nombre iban");
    if (facturas.length !== facturaIds.length) {
      return res.status(409).json({ error: "Alguna factura no es emitida o ya está en otra remesa" });
    }
    const sinIban = facturas.find((f) => !f.cliente?.iban);
    if (sinIban) {
      return res.status(400).json({ error: `El cliente ${sinIban.cliente?.nombre} no tiene IBAN` });
    }

    const recibos = facturas.map((f) => ({
      facturaVenta: f._id,
      cliente: f.cliente._id,
      iban: f.cliente.iban,
      importe: Math.round((f.total - f.cobrado()) * 100) / 100,
    }));
    const conImporte = recibos.filter((r) => r.importe > 0);
    if (conImporte.length === 0) {
      return res.status(400).json({ error: "Todas las facturas ya están cobradas" });
    }

    const xml = xmlRemesaSepa({
      empresa,
      fechaCargo: new Date(fechaCargo),
      recibos: conImporte.map((r) => {
        const f = facturas.find((x) => String(x._id) === String(r.facturaVenta));
        return {
          clienteId: r.cliente,
          cliente: f.cliente.nombre,
          iban: r.iban,
          importe: r.importe,
          referencia: f.serieNumero,
          concepto: `Factura ${f.serieNumero}`,
        };
      }),
    });

    const remesa = await Remesa.create({
      empresa: empresa._id,
      fechaCargo: new Date(fechaCargo),
      recibos: conImporte,
      total: Math.round(conImporte.reduce((s, r) => s + r.importe, 0) * 100) / 100,
      xml,
    });
    await FacturaVenta.updateMany(
      { _id: { $in: conImporte.map((r) => r.facturaVenta) } },
      { remesa: remesa._id }
    );
    res.status(201).json({ ...remesa.toObject(), xml: undefined });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/xml", async (req, res, next) => {
  try {
    const remesa = await Remesa.findById(req.params.id);
    if (!remesa) return res.status(404).json({ error: "Remesa no encontrada" });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="remesa-${remesa._id}.xml"`
    );
    res.send(remesa.xml);
  } catch (err) {
    next(err);
  }
});

export default router;
