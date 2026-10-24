import Empresa from "../models/Empresa.js";

// Código propio automático: ART-000001 (pipeline: funciona sin migración).
export async function siguienteCodigoArticulo() {
  const empresa = await Empresa.findOneAndUpdate(
    {},
    [{ $set: { "contadores.articulo": { $add: [{ $ifNull: ["$contadores.articulo", 0] }, 1] } } }],
    { new: true }
  );
  if (!empresa) throw new Error("No hay empresa configurada");
  return `ART-${String(empresa.contadores.articulo).padStart(6, "0")}`;
}
