// Siguiente código de ficha libre para clientes/proveedores: el mayor código
// numérico existente + 1 (los códigos no numéricos se ignoran). Empieza en 1.
export async function siguienteCodigoFicha(Modelo) {
  const codigos = await Modelo.distinct("codigo");
  let max = 0;
  for (const c of codigos) {
    const n = parseInt(c, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}
