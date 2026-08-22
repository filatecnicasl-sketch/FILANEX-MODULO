/**
 * Catálogo de módulos de NEXOSPRO.
 * El núcleo de facturación siempre está activo; cada módulo se activa por
 * empresa (licencia). Los no disponibles se muestran como "próximamente".
 */
export const MODULOS = {
  taller: {
    nombre: "Taller",
    descripcion: "Chapa, pintura y mecánica: vehículos, órdenes de trabajo y recepción exprés.",
    disponible: true,
  },
  telefonia: {
    nombre: "Telefonía",
    descripcion: "Centralita IP (handSIP): identificación de llamadas, historial y click-to-call.",
    disponible: true,
  },
  logistica: {
    nombre: "Logística",
    descripcion: "Rutas, portes y seguimiento de envíos.",
    disponible: false,
  },
  cristaleria: {
    nombre: "Cristalería",
    descripcion: "Medidas, cortes y presupuestos a medida.",
    disponible: false,
  },
  carpinteria: {
    nombre: "Carpintería",
    descripcion: "Proyectos, materiales y partidas de obra.",
    disponible: false,
  },
};

export const MODULOS_ACTIVABLES = Object.entries(MODULOS)
  .filter(([, m]) => m.disponible)
  .map(([k]) => k);

/** Middleware: exige que la empresa tenga el módulo activo. */
export function requiereModulo(clave) {
  return async (req, res, next) => {
    try {
      const { default: Empresa } = await import("../models/Empresa.js");
      const empresa = await Empresa.findOne().lean();
      if (!empresa) return res.status(500).json({ error: "No hay empresa configurada" });
      if (!(empresa.modulos ?? []).includes(clave)) {
        return res.status(403).json({
          error: `El módulo "${MODULOS[clave]?.nombre ?? clave}" no está activado en esta instalación`,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
