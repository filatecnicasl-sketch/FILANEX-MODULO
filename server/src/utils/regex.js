// Escapa un texto libre para usarlo dentro de una expresión regular de
// MongoDB: sin esto, una búsqueda con metacaracteres (".*", "(a+)+$")
// puede devolver toda la colección o bloquear la base de datos (ReDoS).
export function escaparRegex(texto) {
  return String(texto ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
