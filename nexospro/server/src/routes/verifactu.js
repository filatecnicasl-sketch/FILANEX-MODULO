import { Router } from "express";
import RegistroFacturacion from "../models/RegistroFacturacion.js";
import Empresa from "../models/Empresa.js";
import { reenviarPendientes } from "../services/verifactu-reintento.js";
import { certificadoActual } from "../services/certificadoEmpresa.js";
import { politicaEnvio } from "../services/verifactu-envio.js";

const router = Router();

// Estado de la cadena de registros y de los envíos a la AEAT.
router.get("/estado", async (req, res, next) => {
  try {
    const [ultimo, pendientes, cert, politica] = await Promise.all([
      RegistroFacturacion.findOne().sort({ fechaHoraGeneracion: -1 }),
      RegistroFacturacion.countDocuments({ estadoEnvio: "pendiente" }),
      certificadoActual(),
      politicaEnvio(),
    ]);
    res.json({
      ultimaHuella: ultimo?.huella ?? null,
      registrosPendientesEnvio: pendientes,
      certificadoConfigurado: Boolean(cert),
      entorno: process.env.AEAT_ENTORNO || "pruebas",
      envioActivo: politica.activo,
      enviarDesde: politica.desde,
    });
  } catch (err) {
    next(err);
  }
});

// Activa o desactiva la remisión a la AEAT. Mientras está desactivada, las
// facturas se registran con su huella y su QR pero no se envían.
router.put("/envio", async (req, res, next) => {
  try {
    const activo = Boolean(req.body?.envioActivo);
    const desde = req.body?.enviarDesde ? new Date(req.body.enviarDesde) : null;
    if (desde && Number.isNaN(desde.getTime())) {
      return res.status(400).json({ error: "Fecha de inicio no válida" });
    }
    const empresa = await Empresa.findOne();
    if (!empresa) return res.status(404).json({ error: "Empresa no configurada" });
    empresa.verifactu = { ...(empresa.verifactu?.toObject?.() ?? empresa.verifactu ?? {}), envioActivo: activo, enviarDesde: desde };
    await empresa.save();
    res.json({ envioActivo: activo, enviarDesde: desde });
  } catch (err) {
    next(err);
  }
});

// Reenvía a la AEAT los registros que quedaron pendientes (emitidos sin
// certificado o con un fallo de remisión). La AEAT admite subsanación.
router.post("/reenviar-pendientes", async (req, res, next) => {
  try {
    const cert = await certificadoActual();
    if (!cert) {
      return res.status(503).json({
        error: "Certificado AEAT no configurado: súbelo en Sistema → Certificado",
      });
    }
    const { procesados, resultados, envioDesactivado } = await reenviarPendientes(cert);
    if (envioDesactivado) {
      return res.status(409).json({
        error: "El envío a la AEAT está desactivado. Actívalo en Sistema → VeriFactu cuando quieras empezar a remitir.",
      });
    }
    res.json({ procesados, resultados });
  } catch (err) {
    next(err);
  }
});

export default router;
