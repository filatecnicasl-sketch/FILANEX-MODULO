import { Router } from "express";
import Formato from "../models/Formato.js";

const router = Router();

const TIPOS = [
  { id: "factura-venta", etiqueta: "Factura de venta" },
  { id: "presupuesto-venta", etiqueta: "Presupuesto de venta" },
  { id: "albaran-venta", etiqueta: "Albarán de venta" },
  { id: "pedido-cliente", etiqueta: "Pedido de cliente" },
  { id: "factura-compra", etiqueta: "Factura de compra" },
  { id: "presupuesto-compra", etiqueta: "Presupuesto de compra" },
  { id: "albaran-compra", etiqueta: "Albarán de compra" },
  { id: "pedido-proveedor", etiqueta: "Pedido a proveedor" },
  { id: "parte-taller", etiqueta: "Parte de trabajo (taller)" },
  { id: "entrada-taller", etiqueta: "Hoja de entrada (taller)" },
  { id: "parte-sat", etiqueta: "Parte de trabajo (SAT)" },
  { id: "entrada-sat", etiqueta: "Hoja de entrada (SAT)" },
  { id: "ticket-gasto", etiqueta: "Ticket de gasto" },
  { id: "generico", etiqueta: "Genérico" },
];

router.get("/tipos", async (req, res) => {
  res.json(TIPOS);
});

router.get("/", async (req, res, next) => {
  try {
    const docs = await Formato.find().sort({ tipoDocumento: 1, nombre: 1 }).lean();
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

router.get("/por-tipo/:tipo", async (req, res, next) => {
  try {
    const docs = await Formato.find({ tipoDocumento: req.params.tipo }).sort({ porDefecto: -1, nombre: 1 }).lean();
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

router.get("/default/:tipo", async (req, res, next) => {
  try {
    const doc = await Formato.findOne({ tipoDocumento: req.params.tipo }).sort({ porDefecto: -1, createdAt: 1 }).lean();
    if (!doc) return res.status(404).json({ error: "No hay plantilla para este tipo" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const doc = await Formato.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Formato no encontrado" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { tipoDocumento, nombre, page, elements, cssExtra } = req.body;
    if (!tipoDocumento || !nombre) return res.status(400).json({ error: "Faltan tipoDocumento o nombre" });
    const count = await Formato.countDocuments({ tipoDocumento });
    const doc = await Formato.create({
      tipoDocumento,
      nombre,
      porDefecto: count === 0,
      page,
      elements: elements ?? [],
      cssExtra,
    });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const doc = await Formato.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Formato no encontrado" });
    const { nombre, page, elements, cssExtra } = req.body;
    if (nombre !== undefined) doc.nombre = nombre;
    if (page !== undefined) doc.page = page;
    if (elements !== undefined) doc.elements = elements;
    if (cssExtra !== undefined) doc.cssExtra = cssExtra;
    await doc.save();
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/duplicar", async (req, res, next) => {
  try {
    const original = await Formato.findById(req.params.id).lean();
    if (!original) return res.status(404).json({ error: "Formato no encontrado" });
    const copy = await Formato.create({
      ...original,
      _id: undefined,
      nombre: `${original.nombre} (copia)`,
      porDefecto: false,
      elements: (original.elements ?? []).map((el) => ({ ...el, id: crypto.randomUUID() })),
      createdAt: undefined,
      updatedAt: undefined,
    });
    res.status(201).json(copy);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/predeterminar", async (req, res, next) => {
  try {
    const doc = await Formato.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Formato no encontrado" });
    await Formato.updateMany({ tipoDocumento: doc.tipoDocumento }, { porDefecto: false });
    doc.porDefecto = true;
    await doc.save();
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const doc = await Formato.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Formato no encontrado" });
    const restantes = await Formato.countDocuments({ tipoDocumento: doc.tipoDocumento });
    if (restantes <= 1) return res.status(400).json({ error: "Debe quedar al menos una plantilla de este tipo" });
    await Formato.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/importar", async (req, res, next) => {
  try {
    const { tipoDocumento, nombre, page, elements, cssExtra } = req.body;
    if (!tipoDocumento || !nombre || !Array.isArray(elements)) {
      return res.status(400).json({ error: "JSON de plantilla inválido" });
    }
    const count = await Formato.countDocuments({ tipoDocumento });
    const doc = await Formato.create({ tipoDocumento, nombre, porDefecto: count === 0, page, elements, cssExtra });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

export default router;
