// Utilidades de cálculo energético compartidas por las rutas del módulo de
// energía: periodos de consumos, factores de emisión de CO2 y detección de
// anomalías de consumo.

// Factores de emisión orientativos (kg CO2 equivalente por kWh).
// - Luz: mix eléctrico español reciente (Red Eléctrica publica el factor real
//   de cada año; 0,19 es un valor prudente para estimaciones de cartera).
// - Gas: poder calorífico inferior del gas natural.
export const FACTOR_CO2 = { luz: 0.19, gas: 0.202 };

// Periodo "YYYY-MM" del mes actual menos n meses.
export function periodoDesdeHace(nMeses) {
  const d = new Date();
  const p = new Date(d.getFullYear(), d.getMonth() - nMeses, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
}

// Detección de anomalías: dado el histórico de un suministro (array de
// { periodo, kwh } ordenado de más reciente a más antiguo), compara el último
// mes apuntado con la media de los 12 anteriores. Devuelve null si no hay
// anomalía o no hay historia suficiente (mínimo 4 meses antes del último).
export function anomaliaConsumo(historico) {
  if (!Array.isArray(historico) || historico.length < 5) return null;
  const ordenado = [...historico].sort((a, b) => (a.periodo < b.periodo ? 1 : -1));
  const ultimo = ordenado[0];
  const previos = ordenado.slice(1, 13).filter((c) => Number(c.kwh) > 0);
  if (previos.length < 4) return null;
  const media = previos.reduce((a, c) => a + c.kwh, 0) / previos.length;
  if (media <= 0) return null;
  const desviacion = ultimo.kwh / media - 1;
  if (desviacion < 0.25) return null; // solo avisamos de subidas ≥ +25 %
  return { periodo: ultimo.periodo, kwh: ultimo.kwh, media, desviacion };
}
