import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import Proveedor from "../models/Proveedor.js";
import Articulo from "../models/Articulo.js";
import AlbaranCompra from "../models/AlbaranCompra.js";
import FacturaCompra from "../models/FacturaCompra.js";
import Llamada from "../models/Llamada.js";
import PedidoCompra from "../models/PedidoCompra.js";
import PresupuestoCompra from "../models/PresupuestoCompra.js";
import { siguienteCodigoFicha } from "../services/codigoFicha.js";
import { buscarPorNif, errorNifDuplicado } from "../services/nifDuplicado.js";
import { contextoTrasSubida } from "../middleware/empresa.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// alias no se toca aquí: lo gestiona el OCR (matching difuso).
const CAMPOS = ["codigo", "fechaAlta", "nombre", "nif", "email", "telefono", "direccion"];

function limpiar(body) {
  const datos = {};
  for (const c of CAMPOS) {
    if (body[c] !== undefined) datos[c] = body[c] === "" ? undefined : body[c];
  }
  if (datos.nif) datos.nif = datos.nif.toUpperCase();
  return datos;
}

router.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q ?? "").trim();
    const filtro = q
      ? {
          $or: [
            { nombre: { $regex: q, $options: "i" } },
            { nif: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
            { codigo: { $regex: q, $options: "i" } },
          ],
        }
      : {};
    const lista = await Proveedor.find(filtro).sort({ nombre: 1 }).limit(1000);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { nombre } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: "nombre es obligatorio" });
    }
    const datos = limpiar(req.body);
    // El NIF/CIF identifica al proveedor: no se admiten fichas duplicadas.
    if (datos.nif) {
      const existente = await buscarPorNif(Proveedor, datos.nif, null);
      if (existente) return errorNifDuplicado(res, "un proveedor", existente);
    }
    // Código de ficha: el que traiga o el siguiente libre.
    if (!datos.codigo) datos.codigo = await siguienteCodigoFicha(Proveedor);
    const proveedor = await Proveedor.create(datos);
    res.status(201).json(proveedor);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const datos = limpiar(req.body);
    // También al editar: el NIF nuevo no puede ser el de otro proveedor.
    if (datos.nif) {
      const existente = await buscarPorNif(Proveedor, datos.nif, req.params.id);
      if (existente) return errorNifDuplicado(res, "otro proveedor", existente);
    }
    const proveedor = await Proveedor.findByIdAndUpdate(req.params.id, datos, {
      new: true,
      omitUndefined: true,
    });
    if (!proveedor) return res.status(404).json({ error: "Proveedor no encontrado" });
    res.json(proveedor);
  } catch (err) {
    next(err);
  }
});

// Fusiona un proveedor duplicado en esta ficha: reasigna todos sus
// documentos (facturas, albaranes, pedidos, presupuestos, artículos y
// llamadas), hereda sus alias y borra el duplicado.
router.post("/:id/fusionar", async (req, res, next) => {
  try {
    const { duplicadoId } = req.body;
    if (!duplicadoId) return res.status(400).json({ error: "duplicadoId es obligatorio" });
    if (String(duplicadoId) === String(req.params.id)) {
      return res.status(400).json({ error: "No se puede fusionar una ficha consigo misma" });
    }
    const [original, duplicado] = await Promise.all([
      Proveedor.findById(req.params.id),
      Proveedor.findById(duplicadoId),
    ]);
    if (!original) return res.status(404).json({ error: "Proveedor destino no encontrado" });
    if (!duplicado) return res.status(404).json({ error: "Proveedor duplicado no encontrado" });

    const ref = { proveedor: duplicado._id };
    const nuevo = { proveedor: original._id };
    const [facturas, albaranes, pedidos, presupuestos, articulos, llamadas] = await Promise.all([
      FacturaCompra.updateMany(ref, nuevo),
      AlbaranCompra.updateMany(ref, nuevo),
      PedidoCompra.updateMany(ref, nuevo),
      PresupuestoCompra.updateMany(ref, nuevo),
      Articulo.updateMany(ref, nuevo),
      Llamada.updateMany(ref, nuevo),
    ]);

    // Hereda los alias del duplicado (variantes de nombre vistas por el OCR).
    const alias = new Set([...(original.alias ?? []), duplicado.nombre, ...(duplicado.alias ?? [])]);
    original.alias = [...alias].filter((a) => a && a !== original.nombre);
    await original.save();
    await duplicado.deleteOne();

    res.json({
      ok: true,
      reasignados:
        facturas.modifiedCount +
        albaranes.modifiedCount +
        pedidos.modifiedCount +
        presupuestos.modifiedCount +
        articulos.modifiedCount +
        llamadas.modifiedCount,
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const proveedor = await Proveedor.findByIdAndDelete(req.params.id);
    if (!proveedor) return res.status(404).json({ error: "Proveedor no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Columnas admitidas en el Excel (primera fila = cabeceras).
const COLUMNAS = {
  codigo: ["codigo", "código", "cod.", "cod", "nº proveedor", "num proveedor"],
  nombre: ["nombre", "razon social", "razón social", "proveedor"],
  nif: ["nif", "cif", "nif/cif", "cif/dni", "dni/cif", "dni", "cif o nif"],
  email: ["email", "correo", "e-mail"],
  telefono: ["telefono", "teléfono", "telefono 1", "teléfono 1", "movil", "móvil", "tel", "tfno"],
  calle: ["direccion", "dirección", "calle"],
  ciudad: ["ciudad", "poblacion", "población", "localidad"],
  cp: ["cp", "codigo postal", "código postal", "c.p."],
  provincia: ["provincia"],
};

const sinTildes = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function indiceColumna(cabeceras, alias) {
  const aliasNorm = alias.map(sinTildes);
  const exacto = cabeceras.findIndex((c) =>
    aliasNorm.includes(sinTildes(String(c ?? "").trim().toLowerCase()))
  );
  if (exacto !== -1) return exacto;
  // Respaldo: cabecera que empieza por el alias ("Teléfono 1", "CIF/DNI"…).
  return cabeceras.findIndex((c) => {
    const h = sinTildes(String(c ?? "").trim().toLowerCase());
    return aliasNorm.some((a) => h.startsWith(a + " ") || h.startsWith(a + "/") || h.startsWith(a + "-"));
  });
}

// Los CSV que genera Excel en español van en Windows-1252; sin BOM hay que
// decodificar a mano o las tildes se rompen antes de llegar a SheetJS.
function leerHoja(file) {
  const esCsv = /\.(csv|txt)$/i.test(file.originalname ?? "");
  if (!esCsv) {
    const wb = XLSX.read(file.buffer, { type: "buffer" });
    return wb.Sheets[wb.SheetNames[0]];
  }
  let texto;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
  } catch {
    texto = file.buffer.toString("latin1");
  }
  const wb = XLSX.read(texto, { type: "string" });
  return wb.Sheets[wb.SheetNames[0]];
}

router.post("/importar-excel", [upload.single("excel"), contextoTrasSubida], async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Adjunta un archivo Excel o CSV" });

    const hoja = leerHoja(req.file);
    const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });
    if (filas.length < 2) {
      return res.status(400).json({ error: "El archivo no tiene filas de datos (la primera fila debe ser la cabecera)" });
    }

    const cabeceras = filas[0];
    const idx = {};
    for (const [campo, alias] of Object.entries(COLUMNAS)) {
      idx[campo] = indiceColumna(cabeceras, alias);
    }
    if (idx.nombre === -1) {
      return res.status(400).json({
        error: `No encuentro la columna de nombre. Cabeceras leídas: ${cabeceras.filter(Boolean).join(", ")}`,
      });
    }

    const celda = (fila, i) => (i >= 0 ? String(fila[i] ?? "").trim() : "");
    let creados = 0;
    let duplicados = 0;
    const errores = [];

    for (let f = 1; f < filas.length; f++) {
      const fila = filas[f];
      const nombre = celda(fila, idx.nombre);
      if (!nombre) continue;

      // Duplicado por NIF si lo hay; si no, por nombre exacto.
      const nif = celda(fila, idx.nif).toUpperCase() || undefined;
      const existe = nif
        ? await Proveedor.findOne({ nif })
        : await Proveedor.findOne({ nombre: { $regex: `^${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
      if (existe) {
        duplicados++;
        continue;
      }

      try {
        await Proveedor.create({
          // Código del programa antiguo si la hoja lo trae; si no, el siguiente libre.
          codigo: celda(fila, idx.codigo) || (await siguienteCodigoFicha(Proveedor)),
          nombre,
          nif,
          email: celda(fila, idx.email) || undefined,
          telefono: celda(fila, idx.telefono) || undefined,
          direccion: {
            calle: celda(fila, idx.calle) || undefined,
            ciudad: celda(fila, idx.ciudad) || undefined,
            cp: celda(fila, idx.cp) || undefined,
            provincia: celda(fila, idx.provincia) || undefined,
          },
        });
        creados++;
      } catch (e) {
        errores.push(`Fila ${f + 1} (${nombre}): ${e.message}`);
      }
    }

    res.json({ creados, duplicados, errores: errores.slice(0, 10), total: filas.length - 1 });
  } catch (err) {
    next(err);
  }
});

export default router;
