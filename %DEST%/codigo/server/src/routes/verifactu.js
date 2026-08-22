import { Router } from "express";
import RegistroFacturacion from "../models/RegistroFacturacion.js";
import FacturaVenta from "../models/FacturaVenta.js";
import { remitirAeat } from "../services/verifactu.js";

const router = Router();

// Estado de la cadena de registros y de los envíos a la AEAT.
router.get("/estado", async (req, res, next) => {
  try {
    const [ultimo, pendientes] = await Promise.all([
      RegistroFacturacion.findOne().sort({ fechaHoraGeneracion: -1 }),
      RegistroFacturacion.countDocuments({ estadoEnvio: "pendiente" }),
    ]);
    res.json({
      ultimaHuella: ultimo?.huella ?? null,
      registrosPendientesEnvio: pendientes,
      certificadoConfigurado: !!process.env.AEAT_CERT_PFX,
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
    if (!process.env.AEAT_CERT_PFX) {
      return res.status(503).json({ error: "Certificado AEAT no configurado (AEAT_CERT_PFX en server/.env)" });
    }
    const pendientes = await RegistroFacturacion.find({
      estadoEnvio: { $in: ["pendiente", "rechazado"] },
    }).sort({ _id: 1 });

    const resultados = [];
    for (const registro of pendientes) {
      try {
        const resp = await remitirAeat(registro.xml);
        const aceptado = /EstadoEnvio>Correcto</.test(resp.cuerpo);
        const conErrores = /AceptadoConErrores/.test(resp.cuerpo);
        registro.estadoEnvio = aceptado ? "aceptado" : conErrores ? "aceptado_con_errores" : "rechazado";
        registro.respuestaAeat = { httpStatus: resp.httpStatus, cuerpo: resp.cuerpo.slice(0, 4000) };
        await registro.save();
        if ((aceptado || conErrores) && registro.facturaVenta) {
          await FacturaVenta.findByIdAndUpdate(registro.facturaVenta, {
            "verifactu.enviada": true,
            "verifactu.estadoEnvio": registro.estadoEnvio,
          });
        }
        resultados.push({ numSerie: registro.numSerieFactura, estado: registro.estadoEnvio });
      } catch (e) {
        resultados.push({ numSerie: registro.numSerieFactura, estado: "error", detalle: e.message });
      }
    }
    res.json({ procesados: resultados.length, resultados });
  } catch (err) {
    next(err);
  }
});

export default router;
