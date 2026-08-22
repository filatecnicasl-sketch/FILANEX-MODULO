// Deduplicación por NIF/CIF para clientes y proveedores: el NIF identifica
// a la persona/empresa, así que no puede haber dos fichas con el mismo.
import { normalizarNIF } from "./validacion.js";

// Busca si ya existe OTRA ficha con el mismo NIF/CIF, comparando normalizado
// (sin mayúsculas, espacios, puntos ni guiones). Devuelve la ficha o null.
// `excluirId` es la propia ficha al editar, para no chocar consigo misma.
export async function buscarPorNif(Modelo, nif, excluirId) {
  const objetivo = normalizarNIF(nif);
  if (!objetivo) return null;
  const fichas = await Modelo.find({ nif: { $ne: null } }).select("nombre nif").lean();
  return (
    fichas.find(
      (f) => normalizarNIF(f.nif) === objetivo && String(f._id) !== String(excluirId)
    ) ?? null
  );
}

// Respuesta 409 estándar cuando el alta/edición choca con una ficha existente.
export function errorNifDuplicado(res, tipo, existente) {
  return res.status(409).json({
    error: `Ya existe ${tipo} con ese NIF/CIF: ${existente.nombre} (${existente.nif}). Edita la ficha existente en lugar de crear otra.`,
  });
}
