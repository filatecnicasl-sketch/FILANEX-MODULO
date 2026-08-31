import { Router } from "express";
import RegistroFacturacion from "../models/RegistroFacturacion.js";
import FacturaVenta from "../models/FacturaVenta.js";
import Empresa from "../models/Empresa.js";
import { reenviarPendientes } from "../services/verifactu-reintento.js";
import { certificadoActual } from "../services/certificadoEmpresa.js";
import { politicaEnvio } from "../services/verifactu-envio.js";

const router = Router();

// Estado de la cadena de registros y de los envíos a la AEAT.
router.get("/estado", async (req, res, next) => {
  try {
    const [ultimo, pendientes, noRemitidos, cert, politica] = await Promise.all([
      RegistroFacturacion.findOne().sort({ fechaHoraGeneracion: -1 }),
      RegistroFacturacion.countDocuments({ estadoEnvio: "pendiente" }),
      RegistroFacturacion.countDocuments({ estadoEnvio: "no_remitido" }),
      certificadoActual(),
      politicaEnvio(),
    ]);
    res.json({
      ultimaHuella: ultimo?.huella ?? null,
      registrosPendientesEnvio: pendientes,
      registrosNoRemitidos: noRemitidos,
      certificadoConfigurado: Boolean(cert),
      entorno: process.env.AEAT_ENTORNO || "pruebas",
      envioActivo: politica.activo,
      enviarDesde: politica.desde,
    });
  } catch (err) {
    next(err);
  }
});

// Activa o desactiva la remisión a la AEAT.
//
// Al ACTIVAR, lo que estuviera pendiente hasta ese instante NO se manda: se
// marca como "no_remitido" y queda fuera de la cola para siempre. A partir de
// la activación, cada factura nueva se remite en el acto, como exige la
// norma. Así el interruptor nunca provoca un envío masivo retroactivo.
router.put("/envio", async (req, res, next) => {
  try {
    const activo = Boolean(req.body?.envioActivo);
    const empresa = await Empresa.findOne();
    if (!empresa) return res.status(404).json({ error: "Empresa no configurada" });

    let excluidos = 0;
    const ahora = new Date();
    if (activo) {
      const previos = await RegistroFacturacion.find({
        estadoEnvio: { $in: ["pendiente", "rechazado"] },
      }).select("_id facturaVenta");
      if (previos.length) {
        await RegistroFacturacion.updateMany(
          { _id: { $in: previos.map((r) => r._id) } },
          { $set: { estadoEnvio: "no_remitido" } }
        );
        await FacturaVenta.updateMany(
          { _id: { $in: previos.map((r) => r.facturaVenta).filter(Boolean) } },
          { $set: { "verifactu.estadoEnvio": "no_remitido", "verifactu.enviada": false } }
        );
        excluidos = previos.length;
      }
    }

    empresa.verifactu = {
      ...(empresa.verifactu?.toObject?.() ?? empresa.verifactu ?? {}),
      envioActivo: activo,
      enviarDesde: activo ? ahora : null,
    };
    await empresa.save();
    res.json({ envioActivo: activo, enviarDesde: activo ? ahora : null, excluidos });
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
