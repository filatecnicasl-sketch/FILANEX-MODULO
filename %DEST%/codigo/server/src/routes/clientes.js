import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import Cliente from "../models/Cliente.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const CAMPOS = [
  "nombre", "nif", "email", "telefono", "iban", "banco", "bic",
  "direccion", "direccionEntrega", "esAdministracionPublica", "notas",
];

const limpiarIban = (iban) => iban?.replace(/\s/g, "").toUpperCase() || undefined;

function limpiar(body) {
  const datos = {};
  for (const c of CAMPOS) {
    if (body[c] !== undefined) datos[c] = body[c] === "" ? undefined : body[c];
  }
  if (datos.iban) datos.iban = limpiarIban(datos.iban);
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
          ],
        }
      : {};
    const lista = await Cliente.find(filtro).sort({ nombre: 1 }).limit(300);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { nombre, nif } = req.body;
    if (!nombre || !nif) {
      return res.status(400).json({ error: "nombre y nif son obligatorios" });
    }
    const cliente = await Cliente.create(limpiar(req.body));
    res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, limpiar(req.body), {
      new: true,
      omitUndefined: true,
    });
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(cliente);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const cliente = await Cliente.findByIdAndDelete(req.params.id);
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Columnas admitidas en el Excel (primera fila = cabeceras).
const COLUMNAS = {
  nombre: ["nombre", "razon social", "razón social", "cliente"],
  nif: ["nif", "cif", "nif/cif", "dni"],
  email: ["email", "correo", "e-mail"],
  telefono: ["telefono", "teléfono", "movil", "móvil", "tel"],
  calle: ["direccion", "dirección", "calle"],
  ciudad: ["ciudad", "poblacion", "población", "localidad"],
  cp: ["cp", "codigo postal", "código postal", "c.p."],
  provincia: ["provincia"],
  iban: ["iban"],
  banco: ["banco"],
  bic: ["bic", "swift", "bic/swift"],
  notas: ["notas", "observaciones"],
};

const sinTildes = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function indiceColumna(cabeceras, alias) {
  const aliasNorm = alias.map(sinTildes);
  return cabeceras.findIndex((c) =>
    aliasNorm.includes(sinTildes(String(c ?? "").trim().toLowerCase()))
  );
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

router.post("/importar-excel", upload.single("excel"), async (req, res, next) => {
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

      const nif = celda(fila, idx.nif).toUpperCase() || undefined;
      if (nif) {
        const existe = await Cliente.findOne({ nif });
        if (existe) {
          duplicados++;
          continue;
        }
      }

      try {
        await Cliente.create({
          nombre,
          nif: nif ?? `SIN-NIF-${Date.now()}-${f}`,
          email: celda(fila, idx.email) || undefined,
          telefono: celda(fila, idx.telefono) || undefined,
          iban: limpiarIban(celda(fila, idx.iban)),
          banco: celda(fila, idx.banco) || undefined,
          bic: celda(fila, idx.bic) || undefined,
          direccion: {
            calle: celda(fila, idx.calle) || undefined,
            ciudad: celda(fila, idx.ciudad) || undefined,
            cp: celda(fila, idx.cp) || undefined,
            provincia: celda(fila, idx.provincia) || undefined,
          },
          notas: celda(fila, idx.notas) || undefined,
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
