import { Router } from "express";
import Suministro from "../models/Suministro.js";
import EstudioEnergia from "../models/EstudioEnergia.js";

// Alertas del canal de energía: lo que necesita atención hoy.
// - Renovaciones: contratos activos cuyo fin vence en los próximos 60 días
//   (o ya venció), para llamar al cliente antes de que pase a tarifa por
//   defecto.
// - Estudios sin respuesta: estudios enviados hace más de 7 días que siguen
//   sin contestar.
const router = Router();

const DIAS_RENOVACION = 60;
const DIAS_ESTUDIO = 7;

router.get("/", async (req, res, next) => {
  try {
    const ahora = new Date();
    const limite = new Date(ahora.getTime() + DIAS_RENOVACION * 24 * 60 * 60 * 1000);
    const haceDiasEstudio = new Date(ahora.getTime() - DIAS_ESTUDIO * 24 * 60 * 60 * 1000);

    const [renovaciones, estudiosSinRespuesta] = await Promise.all([
      Suministro.find({
        estado: "activo",
        fechaFin: { $ne: null, $lte: limite },
      })
        .sort({ fechaFin: 1 })
        .populate("cliente", "nombre grupo telefono")
        .limit(100)
        .lean(),
      EstudioEnergia.find({
        estado: "enviado",
        fechaEnvio: { $ne: null, $lte: haceDiasEstudio },
      })
        .sort({ fechaEnvio: 1 })
        .populate("cliente", "nombre grupo telefono")
        .limit(100)
        .lean(),
    ]);

    res.json({
      renovaciones: renovaciones.map((s) => ({
        _id: s._id,
        cups: s.cups,
        tipo: s.tipo,
        clienteNombre: s.clienteNombre ?? s.cliente?.nombre,
        telefono: s.cliente?.telefono ?? null,
        comercializadoraNombre: s.comercializadoraNombre,
        fechaFin: s.fechaFin,
        dias: Math.ceil((new Date(s.fechaFin).getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000)),
      })),
      estudiosSinRespuesta: estudiosSinRespuesta.map((e) => ({
        _id: e._id,
        cups: e.cups,
        clienteNombre: e.clienteNombre ?? e.cliente?.nombre,
        telefono: e.cliente?.telefono ?? null,
        comercializadoraNombre: e.comercializadoraNombre,
        ahorroAnual: e.ahorroAnual,
        fechaEnvio: e.fechaEnvio,
        dias: Math.floor((ahora.getTime() - new Date(e.fechaEnvio).getTime()) / (24 * 60 * 60 * 1000)),
      })),
      total: renovaciones.length + estudiosSinRespuesta.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
