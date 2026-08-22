import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import Empresa from "../models/Empresa.js";
import { MODULOS, MODULOS_ACTIVABLES } from "../config/modulos.js";
import { asegurarSeries } from "../services/numeracion.js";
import { METODOS_PAGO_DEFECTO } from "../services/metodos-pago.js";

const router = Router();

// Rellena el catálogo de métodos de pago si la empresa aún no tiene (migración).
function asegurarMetodosPago(obj) {
  if (!Array.isArray(obj.metodosPago) || obj.metodosPago.length === 0) {
    obj.metodosPago = METODOS_PAGO_DEFECTO.map((m) => ({ ...m }));
  }
  return obj.metodosPago;
}

const subidaLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 600 * 1024 }, // máx. 600 KB
});
const TIPOS_LOGO = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
const dirUploads = path.join(process.cwd(), "uploads");

function borrarLogosAnteriores() {
  for (const ext of Object.values(TIPOS_LOGO)) {
    const p = path.join(dirUploads, `logo-empresa${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

router.get("/", async (req, res, next) => {
  try {
    const empresa = await Empresa.findOne();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });
    const obj = empresa.toObject();
    asegurarSeries(obj); // decora sin guardar: series migradas al vuelo
    asegurarMetodosPago(obj); // ídem con los métodos de pago
    res.json(obj);
  } catch (err) {
    next(err);
  }
});

// Guarda las series de numeración (Sistema → Series).
router.put("/series", async (req, res, next) => {
  try {
    const empresa = await Empresa.findOne();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });

    const limpiar = (lista, campos) => {
      if (!Array.isArray(lista) || lista.length === 0) {
        throw new Error("Debe haber al menos una serie de cada tipo");
      }
      if (lista.length > 20) throw new Error("Demasiadas series (máx. 20)");
      const nombres = new Set();
      const limpias = lista.map((s) => {
        const nombre = String(s.nombre ?? "").trim().toUpperCase();
        if (!nombre) throw new Error("Todas las series necesitan nombre");
        if (nombre.length > 10) throw new Error(`Serie demasiado larga: ${nombre}`);
        if (nombres.has(nombre)) throw new Error(`Serie repetida: ${nombre}`);
        nombres.add(nombre);
        const out = { nombre, defecto: Boolean(s.defecto) };
        for (const c of campos) {
          const n = Math.trunc(Number(s[c]));
          out[c] = Number.isFinite(n) && n >= 1 ? n : 1;
        }
        return out;
      });
      // Exactamente una serie por defecto.
      const primera = limpias.findIndex((s) => s.defecto);
      limpias.forEach((s, i) => (s.defecto = i === (primera === -1 ? 0 : primera)));
      return limpias;
    };

    let seriesVenta, seriesCompra;
    try {
      seriesVenta = limpiar(req.body.seriesVenta, [
        "proxPresupuesto",
        "proxAlbaran",
        "proxFactura",
      ]);
      seriesCompra = limpiar(req.body.seriesCompra, [
        "proxPresupuesto",
        "proxPedido",
        "proxAlbaran",
      ]);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    empresa.seriesVenta = seriesVenta;
    empresa.seriesCompra = seriesCompra;
    // Métodos de pago (opcional en la misma llamada).
    if (req.body.metodosPago !== undefined) {
      try {
        empresa.metodosPago = limpiarMetodosPago(req.body.metodosPago);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }
    await empresa.save();
    res.json({
      seriesVenta: empresa.seriesVenta,
      seriesCompra: empresa.seriesCompra,
      metodosPago: empresa.metodosPago,
    });
  } catch (err) {
    next(err);
  }
});

// Valida y normaliza la lista de métodos de pago:
// nombre obligatorio y sin duplicados, plazos = días enteros positivos,
// exactamente un método por defecto.
function limpiarMetodosPago(lista) {
  if (!Array.isArray(lista) || lista.length === 0) {
    throw new Error("Debe haber al menos un método de pago");
  }
  if (lista.length > 30) throw new Error("Demasiados métodos de pago (máx. 30)");
  const nombres = new Set();
  const limpios = lista.map((m) => {
    const nombre = String(m.nombre ?? "").trim();
    if (!nombre) throw new Error("Todos los métodos de pago necesitan nombre");
    if (nombre.length > 40) throw new Error(`Método de pago demasiado largo: ${nombre}`);
    const clave = nombre.toLowerCase();
    if (nombres.has(clave)) throw new Error(`Método de pago repetido: ${nombre}`);
    nombres.add(clave);
    const plazos = (Array.isArray(m.plazos) ? m.plazos : [])
      .map((d) => Math.trunc(Number(d)))
      .filter((d) => Number.isFinite(d) && d > 0 && d <= 3650)
      .sort((a, b) => a - b);
    return { nombre, plazos, defecto: Boolean(m.defecto) };
  });
  const primera = limpios.findIndex((m) => m.defecto);
  limpios.forEach((m, i) => (m.defecto = i === (primera === -1 ? 0 : primera)));
  return limpios;
}

// Actualiza datos fiscales y SEPA. Las series y contadores no se tocan aquí.
router.put("/", async (req, res, next) => {
  try {
    const empresa = await Empresa.findOne();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });
    const { nombre, nif, telefono, email, direccion, logoUrl, sepa, modulos, moduloInicio } = req.body;
    if (nombre !== undefined) empresa.nombre = nombre;
    if (nif !== undefined) empresa.nif = nif;
    if (telefono !== undefined) empresa.telefono = telefono;
    if (email !== undefined) empresa.email = email;
    if (direccion !== undefined) empresa.direccion = direccion;
    if (logoUrl !== undefined) empresa.logoUrl = logoUrl;
    if (moduloInicio !== undefined) {
      const validos = ["panel", ...(empresa.modulos ?? [])];
      if (!validos.includes(moduloInicio)) {
        return res.status(400).json({ error: "El módulo de inicio debe ser el panel o un módulo activo" });
      }
      empresa.moduloInicio = moduloInicio;
    }
    if (sepa !== undefined) {
      empresa.sepa = {
        iban: sepa.iban?.replace(/\s/g, "").toUpperCase() || undefined,
        idAcreedor: sepa.idAcreedor?.replace(/\s/g, "").toUpperCase() || undefined,
      };
    }
    if (modulos !== undefined) {
      if (!Array.isArray(modulos)) {
        return res.status(400).json({ error: "modulos debe ser una lista" });
      }
      const desconocidos = modulos.filter((m) => !MODULOS[m]);
      const noDisponibles = modulos.filter((m) => MODULOS[m] && !MODULOS[m].disponible);
      if (desconocidos.length > 0) {
        return res.status(400).json({ error: `Módulos desconocidos: ${desconocidos.join(", ")}` });
      }
      if (noDisponibles.length > 0) {
        return res.status(400).json({
          error: `Módulos todavía no disponibles: ${noDisponibles.join(", ")}`,
        });
      }
      empresa.modulos = modulos.filter((m) => MODULOS_ACTIVABLES.includes(m));
    }
    await empresa.save();
    res.json(empresa);
  } catch (err) {
    next(err);
  }
});

// Catálogo de módulos (para la pantalla de configuración).
router.get("/modulos", (req, res) => {
  res.json(
    Object.entries(MODULOS).map(([clave, m]) => ({ clave, ...m }))
  );
});

// Sube el logo de la empresa (PNG, JPG o WEBP, máx. 600 KB). Aparece en los documentos.
router.post("/logo", subidaLogo.single("archivo"), async (req, res, next) => {
  try {
    const empresa = await Empresa.findOne();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });
    if (!req.file) return res.status(400).json({ error: "Falta el archivo" });
    const ext = TIPOS_LOGO[req.file.mimetype];
    if (!ext) return res.status(400).json({ error: "Formato no válido: usa PNG, JPG o WEBP" });
    borrarLogosAnteriores();
    fs.writeFileSync(path.join(dirUploads, `logo-empresa${ext}`), req.file.buffer);
    empresa.logoUrl = `/uploads/logo-empresa${ext}`;
    await empresa.save();
    res.json({ logoUrl: empresa.logoUrl });
  } catch (err) {
    next(err);
  }
});

// Quita el logo de la empresa.
router.delete("/logo", async (req, res, next) => {
  try {
    const empresa = await Empresa.findOne();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });
    borrarLogosAnteriores();
    empresa.logoUrl = undefined;
    await empresa.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
