import Proveedor from "../models/Proveedor.js";
import Articulo from "../models/Articulo.js";
import { normalizarNIF } from "./validacion.js";

// Matching determinista para evitar duplicados tras el OCR:
// primero por NIF (exacto), después por nombre normalizado contra
// el nombre y los alias conocidos del proveedor.

export function normalizarNombre(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\b(S\.?\s?L\.?U?\.?|S\.?\s?A\.?U?\.?|S\.?\s?C\.?|C\.?\s?B\.?)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function mismoNombre(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return (a.length > 5 && b.includes(a)) || (b.length > 5 && a.includes(b));
}

export async function buscarProveedor(proveedorOcr) {
  if (!proveedorOcr) return null;

  if (proveedorOcr.nif) {
    const porNif = await Proveedor.findOne({ nif: normalizarNIF(proveedorOcr.nif) });
    if (porNif) return porNif;
  }

  if (!proveedorOcr.nombre) return null;
  const objetivo = normalizarNombre(proveedorOcr.nombre);
  const candidatos = await Proveedor.find().select("nombre alias").limit(500);
  return (
    candidatos.find((c) =>
      [c.nombre, ...(c.alias ?? [])].some((n) => mismoNombre(normalizarNombre(n), objetivo))
    ) ?? null
  );
}

export async function sugerirArticulos(proveedorId, lineas) {
  if (!proveedorId || !lineas.length) {
    return lineas.map(() => ({ articuloId: null, crear: true }));
  }
  const existentes = await Articulo.find({ proveedor: proveedorId })
    .select("descripcion")
    .limit(500);
  return lineas.map((l) => {
    const objetivo = normalizarNombre(l.descripcion);
    const encontrado = existentes.find((a) => mismoNombre(normalizarNombre(a.descripcion), objetivo));
    return { articuloId: encontrado?._id ?? null, crear: !encontrado };
  });
}
