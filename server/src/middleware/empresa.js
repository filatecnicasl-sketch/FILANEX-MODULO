// Middleware de empresa: tras la autenticación, abre el contexto de la
// empresa indicada en el token (AsyncLocalStorage). Todas las consultas de
// negocio de la petición van a la base de datos de esa empresa.
import { alsEmpresa, conexionTenant, conContexto } from "../models/tenant.js";

export function middlewareEmpresa(req, res, next) {
  const db = req.usuario?.db;
  if (!db) {
    return res
      .status(401)
      .json({ error: "La sesión no tiene empresa asignada. Inicia sesión de nuevo." });
  }
  const store = { conn: conexionTenant(db), slug: req.usuario.t, dbName: db };
  req.contextoEmpresa = store;
  alsEmpresa.run(store, () => next());
}

// Se pone justo detrás de multer en las rutas que suben ficheros.
//
// Multer termina desde los eventos del socket y esos eventos no arrastran el
// contexto de la petición (se pierde sobre todo con ficheros grandes, que
// llegan en varios trozos). Sin esto, el manejador siguiente trabajaría sin
// empresa y las escrituras irían a la base de datos de plataforma.
export function contextoTrasSubida(req, res, next) {
  conContexto(req.contextoEmpresa ?? null, () => next());
}
