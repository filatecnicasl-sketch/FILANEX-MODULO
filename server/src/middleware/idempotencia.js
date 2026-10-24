import Idempotencia from "../models/Idempotencia.js";

// Evita duplicados cuando la aplicación reenvía algo desde la cola sin
// conexión: la petición pudo llegar y ejecutarse, y perderse la respuesta
// por el corte de red. Si vuelve con la misma clave, se responde lo mismo
// que la primera vez sin tocar la base de datos.
//
// La clave se RESERVA antes de ejecutar la ruta (insert atómico con índice
// unique): así, dos reenvíos simultáneos de la misma clave no pueden
// ejecutar la operación los dos. El que pierde recibe la respuesta guardada
// (si ya terminó) o un 409 (si la otra petición sigue en curso).
const CADUCIDAD_RESERVA_MS = 2 * 60 * 1000;

export async function idempotencia(req, res, next) {
  const clave = req.get("X-Idem-Key");
  if (!clave || req.method === "GET") return next();

  let reserva;
  try {
    // estado 0 = en curso (el modelo pone 200 por defecto; aquí se pisa).
    reserva = await Idempotencia.create({
      clave,
      metodo: req.method,
      url: req.originalUrl,
      estado: 0,
      respuesta: null,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const previa = await Idempotencia.findOne({ clave }).lean().catch(() => null);
      if (previa?.estado > 0) {
        // Ya terminó: devolver la misma respuesta de la primera ejecución.
        res.set("X-Idem-Repetida", "1");
        return res.status(previa.estado).json(previa.respuesta ?? {});
      }
      // estado 0: otra petición la está procesando. Si la reserva tiene
      // más de 2 minutos, el proceso murió a medias: se libera y se
      // reintenta una sola vez.
      const antigua = !previa || Date.now() - new Date(previa.creadoEn ?? 0).getTime() > CADUCIDAD_RESERVA_MS;
      if (antigua) {
        if (previa) await Idempotencia.deleteOne({ _id: previa._id }).catch(() => {});
        try {
          reserva = await Idempotencia.create({
            clave, metodo: req.method, url: req.originalUrl, estado: 0, respuesta: null,
          });
        } catch {
          return res.status(409).json({ error: "Operación ya en curso. Reintenta en un momento." });
        }
      } else {
        return res.status(409).json({ error: "Operación ya en curso. Reintenta en un momento." });
      }
    } else {
      // Si el registro falla no se bloquea la operación: peor es no atenderla.
      console.warn("Idempotencia: no se pudo reservar la clave", error.message);
      return next();
    }
  }

  // Se envuelve res.json para guardar el resultado en cuanto la ruta responda.
  const jsonOriginal = res.json.bind(res);
  res.json = (cuerpo) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      Idempotencia.updateOne(
        { _id: reserva._id },
        { estado: res.statusCode, respuesta: cuerpo }
      ).catch((error) => {
        console.warn("Idempotencia: no se pudo guardar la respuesta", error.message);
      });
    } else {
      // La operación no llegó a efectuarse: liberar la clave para que el
      // cliente pueda reintentarla.
      Idempotencia.deleteOne({ _id: reserva._id }).catch(() => {});
    }
    return jsonOriginal(cuerpo);
  };

  next();
}
