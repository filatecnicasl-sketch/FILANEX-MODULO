import { Router } from "express";
import RegistroFacturacion from "../models/RegistroFacturacion.js";
import { reenviarPendientes } from "../services/verifactu-reintento.js";
import { certificadoActual } from "../services/certificadoEmpresa.js";

const router = Router();

// Estado de la cadena de registros y de los envíos a la AEAT.
router.get("/estado", async (req, res, next) => {
  try {
    const [ultimo, pendientes, cert] = await Promise.all([
      RegistroFacturacion.findOne().sort({ fechaHoraGeneracion: -1 }),
      RegistroFacturacion.countDocuments({ estadoEnvio: "pendiente" }),
      certificadoActual(),
    ]);
    res.json({
      ultimaHuella: ultimo?.huella ?? null,
      registrosPendientesEnvio: pendientes,
      certificadoConfigurado: Boolean(cert),
      entorno: process.env.AEAT_ENTORNO || "pruebas",
    });
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
    const { procesados, resultados } = await reenviarPendientes(cert);
    res.json({ procesados, resultados });
  } catch (err) {
    next(err);
  }
});

export default router;
