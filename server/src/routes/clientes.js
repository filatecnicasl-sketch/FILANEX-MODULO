import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import Cliente from "../models/Cliente.js";
import Vehiculo from "../models/Vehiculo.js";
import { siguienteCodigoFicha } from "../services/codigoFicha.js";
import { buscarPorNif, errorNifDuplicado } from "../services/nifDuplicado.js";
import { normalizarNIF, normalizarMatricula } from "../services/validacion.js";
import { contextoTrasSubida } from "../middleware/empresa.js";
import { guardarArchivo, urlPublica } from "../services/storage.js";
import { slugActual } from "../models/tenant.js";
import { borrarSubida } from "../middleware/upload.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const CAMPOS = [
  "codigo", "fechaAlta", "nombre", "nif", "grupo", "email", "telefono", "telefono2", "iban", "banco", "bic",
  "direccion", "direccionEntrega", "esAdministracionPublica", "comunicaciones", "notas",
];

const limpiarIban = (iban) => iban?.replace(/\s/g, "").toUpperCase() || undefined;

function limpiar(body) {
  const datos = {};
  for (const c of CAMPOS) {
    if (body[c] !== undefined) datos[c] = body[c] === "" ? undefined : body[c];
  }
  if (datos.iban) datos.iban = limpiarIban(datos.iban);
  if (datos.comunicaciones?.whatsapp) {
    const autorizado = datos.comunicaciones.whatsapp.autorizado === true;
    datos.comunicaciones.whatsapp = {
      autorizado,
      fecha: autorizado ? datos.comunicaciones.whatsapp.fecha || new Date() : undefined,
      origen: autorizado ? datos.comunicaciones.whatsapp.origen || "ficha_cliente" : undefined,
      revocadoAt: autorizado ? undefined : new Date(),
    };
  }
  return datos;
}

router.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q ?? "").trim();
    // Búsqueda por teléfono tolerante a espacios/separadores: escribir
    // "600123456" encuentra el "600 123 456" guardado (y al revés).
    const digitos = q.replace(/[\s.\-/]/g, "");
    const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patronTelefono = /^\+?\d{6,}$/.test(digitos)
      ? digitos.split("").map(escapar).join("[\\s.\\-]?")
      : null;
    // Matrícula: el cliente también se puede encontrar por la matrícula de
    // cualquiera de sus vehículos (se normaliza igual que al guardarlo:
    // mayúsculas y sin espacios, puntos ni guiones).
    let idsPorMatricula = [];
    if (q) {
      const matricula = normalizarMatricula(q);
      if (matricula) {
        const vehiculos = await Vehiculo.find(
          { matricula: { $regex: escapar(matricula), $options: "i" } },
          { cliente: 1 }
        ).limit(500);
        idsPorMatricula = [...new Set(vehiculos.map((v) => String(v.cliente ?? "")).filter(Boolean))];
      }
    }
    const busqueda = q
      ? {
          $or: [
            { nombre: { $regex: escapar(q), $options: "i" } },
            { nif: { $regex: escapar(q), $options: "i" } },
            { email: { $regex: escapar(q), $options: "i" } },
            { codigo: { $regex: escapar(q), $options: "i" } },
            { grupo: { $regex: escapar(q), $options: "i" } },
            { telefono: { $regex: escapar(q), $options: "i" } },
            { telefono2: { $regex: escapar(q), $options: "i" } },
            ...(patronTelefono ? [
              { telefono: { $regex: patronTelefono } },
              { telefono2: { $regex: patronTelefono } },
            ] : []),
            ...(idsPorMatricula.length ? [{ _id: { $in: idsPorMatricula } }] : []),
          ],
        }
      : {};
    // El cliente genérico del TPV ("Consumidor final") no aparece aquí.
    const filtro = { $and: [busqueda, { mostrador: { $ne: true } }] };

    // ?completo=1 → ficha de Clientes: documento entero (la búsqueda con q
    // acota el resultado).
    if (req.query.completo === "1") {
      const lista = await Cliente.find(filtro).sort({ nombre: 1 }).limit(5000);
      return res.json(lista);
    }

    // Sin "completo" son las listas de selección (presupuestos, ventas,
    // albaranes, taller, agenda…): proyección ligera y sin tope de 1000,
    // para que el buscador encuentre a cualquier cliente de la cartera
    // aunque haya miles de fichas (los campos pesados como notas o IBAN
    // no hacen falta para elegir en un desplegable).
    const lista = await Cliente.find(
      filtro,
      {
        codigo: 1, nombre: 1, nif: 1, telefono: 1, telefono2: 1, email: 1, grupo: 1,
        direccion: 1, direccionEntrega: 1, comunicaciones: 1,
      }
    )
      .sort({ nombre: 1 })
      .limit(15000);
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
    // Normaliza el NIF (mayúsculas, sin espacios/puntos/guiones) para que la
    // deduplicación funcione aunque se escriba con o sin letra/guiones.
    if (datos.nif) datos.nif = normalizarNIF(datos.nif) || datos.nif;
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
    const telefono2 = (req.body?.telefono2 ?? "").trim() || undefined;
    const email = (req.body?.email ?? "").trim() || undefined;
    const nif = normalizarNIF(req.body?.nif) || undefined;
    // Provincia (y calle/ciudad/CP si se escriben): quedan guardadas en la
    // dirección de la ficha para no completarlas después a mano.
    const dir = {
      ...(req.body?.calle ? { calle: req.body.calle.trim() } : {}),
      ...(req.body?.ciudad ? { ciudad: req.body.ciudad.trim() } : {}),
      ...(req.body?.cp ? { cp: req.body.cp.trim() } : {}),
      ...(req.body?.provincia ? { provincia: req.body.provincia.trim() } : {}),
    };
    // Cuando el alta nace de una casilla "Nuevo", el teléfono es obligatorio.
    if (req.body?.exigirTelefono && !telefono) {
      return res.status(400).json({ error: "Para dar de alta el cliente hay que indicar el teléfono" });
    }

    // Si ya existe una ficha con ese NIF se devuelve en vez de duplicar.
    if (nif) {
      const existente = await buscarPorNif(Cliente, nif, null);
      if (existente) return res.status(200).json(existente);
    } else {
      // Sin NIF: se evita repetir el mismo nombre y teléfono.
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
      telefono2,
      email,
      nif: nif ?? `SIN NIF ${codigo}`,
      ...(Object.keys(dir).length > 0 ? { direccion: dir } : {}),
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
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
    // Sus vehículos no pueden quedar huérfanos (caso del 4555LKD: al borrar
    // al titular, el coche quedaba sin dueño pero con el nombre en texto
    // libre, y al buscarlo por matrícula "el cliente no existe"). Si tienen
    // historial de taller, se bloquea el borrado; si están vacíos, se
    // borran con él.
    const vehiculos = await Vehiculo.find({ cliente: cliente._id }).select("matricula historial");
    const conHistorial = vehiculos.filter((v) => (v.historial ?? []).length > 0);
    if (conHistorial.length > 0) {
      return res.status(409).json({
        error: `No se puede borrar: ${cliente.nombre} tiene ${conHistorial.length} vehículo(s) con historial de taller (${conHistorial.map((v) => v.matricula).join(", ")}). Borra primero ese historial o deja el cliente archivado.`,
      });
    }
    await Vehiculo.deleteMany({ cliente: cliente._id });
    await cliente.deleteOne();
    // Los documentos adjuntos también se borran del almacenamiento.
    for (const d of cliente.documentos ?? []) {
      await borrarSubida(d.url).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Documentación del cliente ---
//
// NIF/CIF, escrituras, poderes, contratos… Igual que los adjuntos de los
// suministros de energía: PDF o imágenes, máximo 6 archivos de 30 MB por
// subida (las fotos pesadas se comprimen en el navegador antes de llegar),
// y cada archivo queda dentro de la carpeta del tenant.
const subidaDocumentos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 6 },
});

router.post(
  "/:id/documentos",
  [subidaDocumentos.array("archivos", 6), contextoTrasSubida],
  async (req, res, next) => {
    try {
      const cliente = await Cliente.findById(req.params.id);
      if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
      if (!req.files?.length) return res.status(400).json({ error: "No llegó ningún archivo" });
      const slug = slugActual();
      const nuevos = [];
      for (const f of req.files) {
        const esPdf = f.mimetype === "application/pdf";
        if (!esPdf && !f.mimetype.startsWith("image/")) continue;
        const ext = esPdf
          ? ".pdf"
          : f.mimetype === "image/png"
            ? ".png"
            : f.mimetype === "image/webp"
              ? ".webp"
              : ".jpg";
        const archivo = `cli-${cliente._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        const remoto = `uploads/${slug}/clientes/${archivo}`;
        await guardarArchivo(remoto, f.buffer, f.mimetype);
        nuevos.push({ url: urlPublica(remoto), nombre: f.originalname || archivo, fecha: new Date() });
      }
      if (!nuevos.length) {
        return res.status(400).json({ error: "Solo se admiten archivos PDF o imágenes" });
      }
      cliente.documentos = [...(cliente.documentos ?? []), ...nuevos];
      await cliente.save();
      res.status(201).json(cliente.documentos);
    } catch (err) {
      next(err);
    }
  }
);

// Quita un documento del cliente (body: { url }) y borra el archivo.
router.delete("/:id/documentos", async (req, res, next) => {
  try {
    const { url } = req.body;
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
    const antes = (cliente.documentos ?? []).length;
    cliente.documentos = (cliente.documentos ?? []).filter((d) => d.url !== url);
    if (cliente.documentos.length === antes) {
      return res.status(404).json({ error: "Documento no encontrado" });
    }
    await cliente.save();
    await borrarSubida(url).catch(() => {});
    res.json(cliente.documentos);
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
  telefono2: ["telefono 2", "teléfono 2", "movil 2", "móvil 2", "tel2", "tfno2"],
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
          telefono2: celda(fila, idx.telefono2) || undefined,
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
