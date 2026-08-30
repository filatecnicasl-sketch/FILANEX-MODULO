// Cola serializada compartida para TODOS los registros VeriFactu del
// proceso (facturas normales, rectificativas y tickets TPV). La huella es
// una cadena encadenada por empresa: dos registros concurrentes no pueden
// leer la misma huella anterior, así que las rutas que crean registros se
// ejecutan de una en una dentro de este middleware.
let cola = Promise.resolve();

export function serializarRegistro(req, res, next) {
  const anterior = cola;
  let liberar;
  cola = new Promise((resolve) => {
    liberar = resolve;
  });
  anterior
    .catch(() => {})
    .then(() => {
      let liberado = false;
      const finalizar = () => {
        if (liberado) return;
        liberado = true;
        liberar();
      };
      res.once("finish", finalizar);
      res.once("close", finalizar);
      next();
    });
}
