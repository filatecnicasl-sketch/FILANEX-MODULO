import Idempotencia from "../models/Idempotencia.js";

// Evita duplicados cuando la aplicación reenvía algo desde la cola sin
// conexión: la petición pudo llegar y ejecutarse, y perderse la respuesta
// por el corte de red. Si vuelve con la misma clave, se responde lo mismo
// que la primera vez sin tocar la base de datos.
export async function idempotencia(req, res, next) {
  const clave = req.get("X-Idem-Key");
  if (!clave || req.method === "GET") return next();

  try {
    const previa = await Idempotencia.findOne({ clave }).lean();
    if (previa) {
      res.set("X-Idem-Repetida", "1");
      return res.status(previa.estado || 200).json(previa.respuesta ?? {});
    }
  } catch (error) {
    // Si el registro falla no se bloquea la operación: peor es no atenderla.
    console.warn("Idempotencia: no se pudo consultar la clave", error.message);
    return next();
  }

  // Se envuelve res.json para guardar el resultado en cuanto la ruta responda.
  const jsonOriginal = res.json.bind(res);
  res.json = (cuerpo) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      Idempotencia.create({
        clave,
        metodo: req.method,
        url: req.originalUrl,
        estado: res.statusCode,
        respuesta: cuerpo,
      }).catch((error) => {
        // Clave duplicada por dos reenvíos simultáneos: no es un problema.
        if (error?.code !== 11000) {
          console.warn("Idempotencia: no se pudo guardar la clave", error.message);
        }
      });
    }
    return jsonOriginal(cuerpo);
  };

  next();
}
