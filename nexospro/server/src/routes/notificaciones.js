// Preferencias de avisos y avisos vigentes (Sistema → Notificaciones).
// Los avisos se calculan en vivo a partir de los datos: no se persisten.
import { Router } from "express";
import Empresa from "../models/Empresa.js";
import FacturaVenta from "../models/FacturaVenta.js";
import FacturaCompra from "../models/FacturaCompra.js";
import AlbaranCompra from "../models/AlbaranCompra.js";
import AgendaEvento from "../models/AgendaEvento.js";

const router = Router();

const DIA_MS = 24 * 60 * 60 * 1000;

const PREFS_DEFECTO = { vencidas: true, proximas: true, diasProximas: 7, ocr: true, agendaEventos: true, minutosAgenda: 15 };

// Vencimiento efectivo: el explícito, o expedición + 30 días (igual que Tesorería).
function vencimientoDe(f) {
  return f.vencimiento ?? new Date(new Date(f.fechaExpedicion).getTime() + 30 * DIA_MS);
}

async function cargarPrefs() {
  const empresa = await Empresa.findOne();
  return { empresa, prefs: { ...PREFS_DEFECTO, ...(empresa?.notificaciones ?? {}) } };
}

// GET /api/notificaciones → preferencias + avisos actuales.
router.get("/", async (req, res, next) => {
  try {
    const { prefs } = await cargarPrefs();
    const avisos = [];
    const hoy = new Date();

    if (prefs.vencidas || prefs.proximas) {
      const facturas = await FacturaVenta.find({ estado: "emitida" })
        .populate("cliente", "nombre")
        .lean();
      const pendientes = facturas.filter((f) => {
        const cobrado = (f.cobros ?? []).reduce((s, c) => s + (c.importe ?? 0), 0);
        return cobrado + 0.005 < (f.total ?? 0); // pendiente o parcial
      });
      for (const f of pendientes) {
        const vence = vencimientoDe(f);
        const dias = Math.ceil((vence - hoy) / DIA_MS);
        const base = {
          factura: f.serieNumero,
          cliente: f.cliente?.nombre ?? "",
          total: f.total,
          fecha: vence,
        };
        if (dias < 0 && prefs.vencidas) {
          avisos.push({
            tipo: "vencida",
            texto: `Factura ${f.serieNumero} de ${f.cliente?.nombre ?? "cliente"} vencida hace ${-dias} día(s)`,
            enlace: "/tesoreria",
            ...base,
            dias,
          });
        } else if (dias >= 0 && dias <= prefs.diasProximas && prefs.proximas) {
          avisos.push({
            tipo: "proxima",
            texto: `Factura ${f.serieNumero} de ${f.cliente?.nombre ?? "cliente"} vence ${dias === 0 ? "hoy" : `en ${dias} día(s)`}`,
            enlace: "/tesoreria",
            ...base,
            dias,
          });
        }
      }
      avisos.sort((a, b) => a.dias - b.dias);
    }

    if (prefs.ocr) {
      const [facturasPend, albaranesPend] = await Promise.all([
        FacturaCompra.countDocuments({ estado: "pendiente_revision" }),
        AlbaranCompra.countDocuments({ estado: "borrador" }),
      ]);
      const total = facturasPend + albaranesPend;
      if (total > 0) {
        avisos.push({
          tipo: "ocr",
          texto: `${total} documento(s) OCR pendientes de validar (${facturasPend} factura(s), ${albaranesPend} albarán(es))`,
          enlace: "/compras/ocr",
        });
      }
    }

    if (prefs.agendaEventos) {
      const hoy0 = new Date();
      hoy0.setHours(0, 0, 0, 0);
      const hoyFin = new Date(hoy0);
      hoyFin.setHours(23, 59, 59, 999);
      const ahora = new Date();
      const horaActual = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
      const eventosHoy = await AgendaEvento.find({
        fecha: { $gte: hoy0, $lte: hoyFin },
        estado: { $in: ["pendiente", "confirmada"] },
        avisar: true,
        hora: { $gte: horaActual },
      })
        .sort({ hora: 1 })
        .limit(50)
        .lean();
      if (eventosHoy.length > 0) {
        const primero = eventosHoy[0];
        avisos.push({
          tipo: "agenda",
          texto: `${eventosHoy.length} evento(s) de agenda hoy — próximo a las ${primero.hora}${primero.titulo ? ` (${primero.titulo})` : ""}`,
          enlace: "/agenda",
        });
      }
    }

    res.json({ prefs, avisos });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notificaciones → guarda las preferencias.
router.put("/", async (req, res, next) => {
  try {
    const { empresa } = await cargarPrefs();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });
    const dias = Math.trunc(Number(req.body.diasProximas));
    const minutos = Math.trunc(Number(req.body.minutosAgenda));
    empresa.notificaciones = {
      vencidas: Boolean(req.body.vencidas),
      proximas: Boolean(req.body.proximas),
      diasProximas: Number.isFinite(dias) && dias >= 1 && dias <= 90 ? dias : 7,
      ocr: Boolean(req.body.ocr),
      agendaEventos: Boolean(req.body.agendaEventos),
      minutosAgenda: Number.isFinite(minutos) && minutos >= 1 && minutos <= 240 ? minutos : 15,
    };
    await empresa.save();
    res.json({ prefs: empresa.notificaciones });
  } catch (err) {
    next(err);
  }
});

export default router;
