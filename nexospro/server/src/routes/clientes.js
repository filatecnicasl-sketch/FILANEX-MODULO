import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import Cliente from "../models/Cliente.js";
import { siguienteCodigoFicha } from "../services/codigoFicha.js";
import { buscarPorNif, errorNifDuplicado } from "../services/nifDuplicado.js";
import { contextoTrasSubida } from "../middleware/empresa.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const CAMPOS = [
  "codigo", "fechaAlta", "nombre", "nif", "email", "telefono", "iban", "banco", "bic",
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
            { codigo: { $regex: q, $options: "i" } },
          ],
        }
      : {};
    const lista = await Cliente.find(filtro).sort({ nombre: 1 }).limit(1000);
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
    const datos = limpiar(req.body);
    // El NIF/CIF identifica al cliente: no se admiten fichas duplicadas.
    const existente = await buscarPorNif(Cliente, datos.nif, null);
    if (existente) return errorNifDuplicado(res, "un cliente", existente);
    // Código de ficha: el que traiga o el siguiente libre.
    if (!datos.codigo) datos.codigo = await siguienteCodigoFicha(Cliente);
    const cliente = await Cliente.create(datos);
    res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
});

// Alta rápida desde la agenda/citas: solo hace falta el nombre. El NIF se
// deja marcado como pendiente («SIN NIF <código>») para completar la ficha
// más tarde desde Clientes, y así el día a día no se corta por un dato fiscal.
router.post("/rapido", async (req, res, next) => {
  try {
    const nombre = (req.body?.nombre ?? "").trim();
    if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });
    const telefono = (req.body?.telefono ?? "").trim() || undefined;
    const email = (req.body?.email ?? "").trim() || undefined;
    const nif = (req.body?.nif ?? "").trim() || undefined;

    // Si ya existe una ficha con ese NIF se devuelve en vez de duplicar.
    if (nif) {
      const existente = await buscarPorNif(Cliente, nif, null);
      if (existente) return res.status(200).json(existente);
    } else {
      // Sin NIF: se evita repetir el mismo nombre (mismo teléfono o sin él).
      const repetido = await Cliente.findOne({
        nombre: { $regex: `^${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        ...(telefono ? { telefono } : {}),
      });
      if (repetido) return res.status(200).json(repetido);
    }

    const codigo = await siguienteCodigoFicha(Cliente);
    const cliente = await Cliente.create({
      codigo,
      nombre,
      telefono,
      email,
      nif: nif ?? `SIN NIF ${codigo}`,
    });
    res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const datos = limpiar(req.body);
    // También al editar: el NIF nuevo no puede ser el de otro cliente.
    if (datos.nif) {
      const existente = await buscarPorNif(Cliente, datos.nif, req.params.id);
      if (existente) return errorNifDuplicado(res, "otro cliente", existente);
    }
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, datos, {
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
  codigo: ["codigo", "código", "cod.", "cod", "nº cliente", "num cliente"],
  nombre: ["nombre", "razon social", "razón social", "cliente"],
  nif: ["nif", "cif", "nif/cif", "cif/dni", "dni/cif", "dni", "cif o nif"],
  email: ["email", "correo", "e-mail"],
  telefono: ["telefono", "teléfono", "telefono 1", "teléfono 1", "movil", "móvil", "tel", "tfno"],
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
          // Código del programa antiguo si la hoja lo trae; si no, el siguiente libre.
          codigo: celda(fila, idx.codigo) || (await siguienteCodigoFicha(Cliente)),
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
