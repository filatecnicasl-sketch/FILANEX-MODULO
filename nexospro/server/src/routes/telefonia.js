import { Router } from "express";
import Llamada from "../models/Llamada.js";
import Cliente from "../models/Cliente.js";
import Proveedor from "../models/Proveedor.js";
import FacturaVenta from "../models/FacturaVenta.js";
import OrdenTrabajo from "../models/OrdenTrabajo.js";
import Tenant from "../models/plataforma/Tenant.js";
import { alsEmpresa, conexionTenant, slugActual } from "../models/tenant.js";

const router = Router();

// Token que debe presentar la centralita al llamar al webhook
// (configurable por TELEFONIA_TOKEN en el .env del servidor).
const TOKEN = process.env.TELEFONIA_TOKEN || "filanex-telefonia";

// ---- Tiempo real: clientes SSE suscritos a los eventos de llamada ----
// Cada suscriptor queda etiquetado con su empresa: un evento solo llega a
// los navegadores de la empresa en cuyo contexto se produjo.
const suscriptores = new Set(); // { res, slug }

function emitirEvento(payload) {
  const slug = slugActual();
  const datos = `data: ${JSON.stringify(payload)}\n\n`;
  for (const s of suscriptores) {
    if (s.slug !== slug) continue;
    try {
      s.res.write(datos);
    } catch {
      suscriptores.delete(s);
    }
  }
}

// ---- Utilidades ----

// Normaliza un teléfono a sus últimos 9 dígitos (quita prefijo +34, espacios...).
function normalizar(numero) {
  const digitos = String(numero ?? "").replace(/\D/g, "");
  return digitos.slice(-9);
}

// Busca el contacto (cliente o proveedor) que corresponde a un número.
async function contactoDe(numero) {
  const norm = normalizar(numero);
  if (!norm) return { norm };
  // Los teléfonos se guardan en formato libre: comparamos por terminación.
  const regex = new RegExp(norm.split("").join("\\D{0,2}") + "$");
  const cliente = await Cliente.findOne({ telefono: regex }).lean();
  if (cliente) return { norm, tipo: "cliente", contacto: cliente };
  const proveedor = await Proveedor.findOne({ telefono: regex }).lean();
  if (proveedor) return { norm, tipo: "proveedor", contacto: proveedor };
  return { norm };
}

// Resumen de negocio del contacto para el popup (pendiente de cobro, órdenes...).
async function resumenDe(tipo, contacto) {
  if (tipo !== "cliente" || !contacto) return {};
  const facturas = await FacturaVenta.find({ cliente: contacto._id, estado: "emitida" });
  const pendientes = facturas.filter((f) => f.estadoCobro() !== "cobrada");
  const pendienteCobro = Math.round(
    pendientes.reduce((s, f) => s + (f.total - f.cobrado()), 0) * 100
  ) / 100;
  const ordenesAbiertas = await OrdenTrabajo.countDocuments({
    cliente: contacto._id,
    estado: { $in: ["recepcion", "en-curso", "finalizado"] },
  });
  return {
    facturasPendientes: pendientes.length,
    pendienteCobro,
    ordenesAbiertas,
  };
}

// Núcleo: procesa un evento de llamada (webhook real o simulador).
// estados aceptados: sonando | en-curso | atendida | perdida | colgada
async function procesarEvento({ numero, direccion = "entrante", estado = "sonando", extension, extId, duracionSeg }) {
  const { norm, tipo, contacto } = await contactoDe(numero);

  // Correlaciona con una llamada en curso (por extId o por número + dirección).
  let llamada = null;
  if (extId) llamada = await Llamada.findOne({ extId });
  if (!llamada && estado !== "sonando") {
    llamada = await Llamada.findOne({
      numeroNormalizado: norm,
      direccion,
      estado: { $in: ["sonando", "en-curso"] },
    }).sort({ createdAt: -1 });
  }

  if (!llamada) {
    llamada = new Llamada({
      numero: String(numero),
      numeroNormalizado: norm,
      direccion,
      extension,
      extId,
      cliente: tipo === "cliente" ? contacto._id : undefined,
      proveedor: tipo === "proveedor" ? contacto._id : undefined,
    });
  }

  if (estado !== "colgada") llamada.estado = estado;
  if (extension) llamada.extension = extension;
  if (extId) llamada.extId = extId;
  if (["colgada", "atendida", "perdida"].includes(estado)) {
    llamada.fin = new Date();
    if (duracionSeg != null) {
      llamada.duracionSeg = Number(duracionSeg) || 0;
    } else if (llamada.estado === "en-curso") {
      llamada.duracionSeg = Math.max(0, Math.round((llamada.fin - llamada.inicio) / 1000));
    }
    if (estado === "colgada") {
      llamada.estado = llamada.estado === "en-curso" ? "atendida" : "perdida";
    }
  }
  await llamada.save();

  const resumen = await resumenDe(tipo, contacto);
  emitirEvento({
    tipo: "llamada",
    llamada: {
      _id: llamada._id,
      numero: llamada.numero,
      direccion: llamada.direccion,
      estado: llamada.estado,
      extension: llamada.extension,
      inicio: llamada.inicio,
    },
    contacto: contacto
      ? { tipo, id: contacto._id, nombre: contacto.nombre, telefono: contacto.telefono }
      : null,
    resumen,
  });
  return llamada;
}

// ---- Endpoints ----

// Flujo SSE: el navegador se suscribe para recibir los eventos de llamada.
router.get("/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write("retry: 3000\n\n");
  const entrada = { res, slug: slugActual() };
  suscriptores.add(entrada);
  req.on("close", () => suscriptores.delete(entrada));
});

// Webhook genérico al que apunta la centralita (handSIP u otra), PÚBLICO
// (la centralita no tiene sesión de usuario; se autentica con su propio
// token y la empresa destino se resuelve sola si solo hay una activa, o con
// ?tenant=<slug> en instalaciones con varias):
//   POST /api/telefonia/evento?token=...
//   { numero, direccion, estado, extension, extId, duracionSeg }
export const webhookTelefonia = Router();

webhookTelefonia.post("/evento", async (req, res, next) => {
  try {
    if (req.query.token !== TOKEN) {
      return res.status(401).json({ error: "Token de telefonía no válido" });
    }
    if (!req.body?.numero) {
      return res.status(400).json({ error: "Falta el número de teléfono" });
    }
    const filtro = req.query.tenant
      ? { slug: String(req.query.tenant), activa: true }
      : { activa: true };
    const tenants = await Tenant.find(filtro).lean();
    if (tenants.length !== 1) {
      return res
        .status(503)
        .json({ error: "Empresa no resuelta: indica ?tenant=<slug> en la URL del webhook" });
    }
    const t = tenants[0];
    const store = { conn: conexionTenant(t.dbName), slug: t.slug, dbName: t.dbName };
    alsEmpresa.run(store, async () => {
      try {
        const llamada = await procesarEvento(req.body);
        res.json({ ok: true, id: llamada._id });
      } catch (e) {
        next(e);
      }
    });
  } catch (err) {
    next(err);
  }
});

// Simulador de llamada entrante: para probar el popup sin centralita.
// Si pasan 12 s sin respuesta, queda como perdida.
router.post("/simular", async (req, res, next) => {
  try {
    let numero = req.body?.numero;
    if (!numero) {
      const cliente = await Cliente.findOne({ telefono: { $exists: true, $ne: "" } }).lean();
      numero = cliente?.telefono ?? "600123456";
    }
    const llamada = await procesarEvento({ numero, direccion: "entrante", estado: "sonando" });
    res.json({ ok: true, id: llamada._id });
    setTimeout(async () => {
      const l = await Llamada.findById(llamada._id);
      if (l && l.estado === "sonando") {
        l.estado = "perdida";
        l.fin = new Date();
        await l.save();
        emitirEvento({
          tipo: "llamada",
          llamada: { _id: l._id, numero: l.numero, direccion: l.direccion, estado: "perdida" },
        });
      }
    }, 12000);
  } catch (err) {
    next(err);
  }
});

// Historial de llamadas con filtros (?q=, ?direccion=, ?estado=).
router.get("/llamadas", async (req, res, next) => {
  try {
    const { q, direccion, estado } = req.query;
    const filtro = {};
    if (direccion) filtro.direccion = direccion;
    if (estado) filtro.estado = estado;
    if (q) filtro.numero = new RegExp(String(q).replace(/\s/g, ""), "i");
    const llamadas = await Llamada.find(filtro)
      .populate("cliente", "nombre telefono")
      .populate("proveedor", "nombre telefono")
      .sort({ inicio: -1 })
      .limit(300)
      .lean();
    res.json(llamadas);
  } catch (err) {
    next(err);
  }
});

// Notas de una llamada (resumen de lo hablado).
router.patch("/llamadas/:id", async (req, res, next) => {
  try {
    const llamada = await Llamada.findByIdAndUpdate(
      req.params.id,
      { notas: req.body?.notas ?? "" },
      { new: true }
    );
    if (!llamada) return res.status(404).json({ error: "Llamada no encontrada" });
    res.json(llamada);
  } catch (err) {
    next(err);
  }
});

router.delete("/llamadas/:id", async (req, res, next) => {
  try {
    const r = await Llamada.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: "Llamada no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
