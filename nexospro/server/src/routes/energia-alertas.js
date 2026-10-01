import { Router } from "express";
import Suministro from "../models/Suministro.js";
import EstudioEnergia from "../models/EstudioEnergia.js";

// Agenda automática del canal de energía: lo que hay que hacer, al vistazo.
// - Renovaciones por antigüedad: contratos activos con 7 a 10 meses desde el
//   alta — la ventana para llamar al cliente y renovarlo antes de que cumpla
//   el año y se pase a tarifa por defecto.
// - Renovaciones por fecha de fin: contratos activos cuyo fin vence en los
//   próximos 60 días (o ya venció).
// - Estudios sin respuesta: estudios enviados hace más de 7 días.
const router = Router();

const DIAS_RENOVACION = 60;
const DIAS_ESTUDIO = 7;
const MESES_VENTANA_MIN = 7;
const MESES_VENTANA_MAX = 10;

// Meses completos transcurridos desde una fecha.
function mesesDesde(fecha) {
  const f = new Date(fecha);
  const ahora = new Date();
  return (ahora.getFullYear() - f.getFullYear()) * 12 + (ahora.getMonth() - f.getMonth());
}

router.get("/", async (req, res, next) => {
  try {
    const ahora = new Date();
    const limite = new Date(ahora.getTime() + DIAS_RENOVACION * 24 * 60 * 60 * 1000);
    const haceDiasEstudio = new Date(ahora.getTime() - DIAS_ESTUDIO * 24 * 60 * 60 * 1000);

    const [renovaciones, estudiosSinRespuesta, conAlta] = await Promise.all([
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
      Suministro.find({ estado: "activo", fechaAlta: { $ne: null } })
        .sort({ fechaAlta: 1 })
        .populate("cliente", "nombre grupo telefono")
        .lean(),
    ]);

    // Contratos con 7-10 meses de vida: hay que llamar para renovar. El
    // aniversario (12 meses desde el alta) es la fecha límite real.
    const porAntiguedad = conAlta
      .map((s) => ({ s, meses: mesesDesde(s.fechaAlta) }))
      .filter(({ meses }) => meses >= MESES_VENTANA_MIN && meses <= MESES_VENTANA_MAX)
      .sort((a, b) => b.meses - a.meses)
      .map(({ s, meses }) => {
        const alta = new Date(s.fechaAlta);
        const aniversario = new Date(alta.getFullYear(), alta.getMonth() + 12, alta.getDate());
        return {
          _id: s._id,
          cups: s.cups,
          tipo: s.tipo,
          clienteNombre: s.clienteNombre ?? s.cliente?.nombre,
          telefono: s.cliente?.telefono ?? null,
          comercializadoraNombre: s.comercializadoraNombre,
          fechaAlta: s.fechaAlta,
          meses,
          faltanMeses: 12 - meses,
          aniversario,
        };
      });

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
      porAntiguedad,
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
      total: renovaciones.length + porAntiguedad.length + estudiosSinRespuesta.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
