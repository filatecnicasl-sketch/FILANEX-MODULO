import { Router as ExpressRouter } from "express";
import Articulo from "../models/Articulo.js";
import FacturaCompra from "../models/FacturaCompra.js";
import AlbaranCompra from "../models/AlbaranCompra.js";
import PedidoCompra from "../models/PedidoCompra.js";
import PresupuestoCompra from "../models/PresupuestoCompra.js";
import { normalizarNombre } from "../services/matching.js";
import { siguienteCodigoArticulo } from "../services/codigoArticulo.js";

const router = ExpressRouter();

// Trazabilidad: en qué documentos de compra aparece cada artículo,
// casando por descripción normalizada (las líneas no guardan el id del artículo).
async function origenDocumentos() {
  const [deFacturas, deAlbaranes, dePedidos, dePresupuestos] = await Promise.all([
    FacturaCompra.aggregate([
      { $unwind: "$lineas" },
      { $group: { _id: "$lineas.descripcion", docs: { $addToSet: "$numeroFacturaProveedor" } } },
    ]),
    AlbaranCompra.aggregate([
      { $unwind: "$lineas" },
      { $group: { _id: "$lineas.descripcion", docs: { $addToSet: { $ifNull: ["$numero", "$numeroAlbaran"] } } } },
    ]),
    PedidoCompra.aggregate([
      { $unwind: "$lineas" },
      { $group: { _id: "$lineas.descripcion", docs: { $addToSet: "$numero" } } },
    ]),
    PresupuestoCompra.aggregate([
      { $unwind: "$lineas" },
      { $group: { _id: "$lineas.descripcion", docs: { $addToSet: "$numero" } } },
    ]),
  ]);

  const mapa = new Map();
  for (const grupo of [...deFacturas, ...deAlbaranes, ...dePedidos, ...dePresupuestos]) {
    const clave = normalizarNombre(grupo._id);
    if (!clave) continue;
    const actual = mapa.get(clave) ?? [];
    mapa.set(clave, [...new Set([...actual, ...grupo.docs.filter(Boolean)])]);
  }
  return mapa;
}

const CAMPOS = [
  "tipo", "codigo", "descripcion", "detalle", "unidad",
  "precioCompra", "precioVenta", "iva", "proveedor",
  "referenciaProveedor", "codigoBarras",
];

function limpiar(body) {
  const datos = {};
  for (const c of CAMPOS) {
    if (body[c] !== undefined) datos[c] = body[c] === "" ? undefined : body[c];
  }
  return datos;
}

router.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q ?? "").trim();
    const filtro = q
      ? {
          $or: [
            { descripcion: { $regex: q, $options: "i" } },
            { codigo: { $regex: q, $options: "i" } },
            { referenciaProveedor: { $regex: q, $options: "i" } },
            { codigoBarras: { $regex: q, $options: "i" } },
          ],
        }
      : {};
    const [lista, origenes] = await Promise.all([
      Articulo.find(filtro).populate("proveedor", "nombre").sort({ descripcion: 1 }).limit(300),
      origenDocumentos(),
    ]);
    res.json(
      lista.map((a) => ({
        ...a.toObject(),
        origenDocumentos: (origenes.get(normalizarNombre(a.descripcion)) ?? []).slice(0, 3),
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { descripcion } = req.body;
    if (!descripcion) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }
    const datos = limpiar(req.body);
    if (!datos.codigo) datos.codigo = await siguienteCodigoArticulo();
    const articulo = await Articulo.create({ ...datos, descripcion, origen: "manual" });
    res.status(201).json(articulo);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const datos = limpiar(req.body);
    delete datos.codigo; // el código propio no se cambia una vez asignado
    if (!datos.descripcion) delete datos.descripcion;
    const articulo = await Articulo.findByIdAndUpdate(req.params.id, datos, { new: true });
    if (!articulo) return res.status(404).json({ error: "Artículo no encontrado" });
    res.json(articulo);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const articulo = await Articulo.findByIdAndDelete(req.params.id);
    if (!articulo) return res.status(404).json({ error: "Artículo no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
