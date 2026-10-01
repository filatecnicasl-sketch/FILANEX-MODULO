import { useEffect, useState } from "react";
import { IconBorrar } from "../../components/icons.jsx";

const fmtEuro = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n ?? 0);
const fmtKwh = (n) => `${Number(n ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 2 })} kWh`;

function fmtPeriodo(p) {
  if (!p) return "—";
  const [a, m] = p.split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("es-ES", { month: "short", year: "numeric" });
}

// Modal de consumos mensuales de un suministro: histórico, gráfica de barras,
// media y alta rápida de un mes. Un registro por mes; repetir un mes lo
// actualiza.
export default function ModalConsumos({ suministro, onCerrar }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const hoy = new Date();
  const [periodo, setPeriodo] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`);
  const [kwh, setKwh] = useState("");
  const [importe, setImporte] = useState("");

  async function cargar() {
    try {
      const r = await fetch(`/api/energia/consumos/suministro/${suministro._id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar");
      setDatos(d);
    } catch (e) {
      setError(e.message);
      setDatos({ lista: [], estadisticas: { n: 0, mediaKwh: 0, totalAnualKwh: 0, totalAnualImporte: 0 } });
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suministro._id]);

  async function guardar(e) {
    e.preventDefault();
    const r = await fetch("/api/energia/consumos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suministro: suministro._id, periodo, kwh: Number(kwh) || 0, importe: Number(importe) || 0 }),
    });
    const d = await r.json();
    if (r.ok) {
      setKwh("");
      setImporte("");
      cargar();
    } else alert(d.error || "No se pudo guardar");
  }

  async function borrar(c) {
    if (!window.confirm(`¿Borrar el consumo de ${fmtPeriodo(c.periodo)}?`)) return;
    const r = await fetch(`/api/energia/consumos/${c._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  const lista = datos?.lista ?? [];
  const max = Math.max(1, ...lista.map((c) => c.kwh));
  const stats = datos?.estadisticas ?? {};
  const fmtCo2 = (kg) =>
    kg >= 1000 ? `${(kg / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} t CO2e` : `${Number(kg ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 0 })} kg CO2e`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="panel max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Consumos</h2>
            <p className="num text-xs text-slate-500">{suministro.cups} — {suministro.clienteNombre ?? "sin cliente"}</p>
          </div>
          <button onClick={onCerrar} className="btn-ghost px-3 py-1">Cerrar</button>
        </div>

        {error && <div className="panel px-4 py-3 text-sm text-rose-400">{error}</div>}

        {datos === null ? (
          <p className="text-slate-500 text-sm">Cargando…</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-slate-600/40 p-3">
                <p className="text-xs text-slate-500">Media mensual</p>
                <p className="num font-bold text-slate-100">{fmtKwh(stats.mediaKwh)}</p>
              </div>
              <div className="rounded-xl border border-slate-600/40 p-3">
                <p className="text-xs text-slate-500">Últimos 12 meses</p>
                <p className="num font-bold text-slate-100">{fmtKwh(stats.totalAnualKwh)}</p>
              </div>
              <div className="rounded-xl border border-slate-600/40 p-3">
                <p className="text-xs text-slate-500">Facturado (12 m.)</p>
                <p className="num font-bold text-slate-100">{fmtEuro(stats.totalAnualImporte)}</p>
              </div>
              <div className="rounded-xl border border-slate-600/40 p-3">
                <p className="text-xs text-slate-500">Coste medio</p>
                <p className="num font-bold text-slate-100">
                  {stats.costeMedioKwh
                    ? `${Number(stats.costeMedioKwh).toLocaleString("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} €/kWh`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-600/40 p-3">
                <p className="text-xs text-slate-500">Presupuesto (12 m.)</p>
                {stats.presupuestoAnual > 0 ? (
                  <>
                    <p className="num font-bold text-slate-100">{fmtEuro(stats.presupuestoAnual)}</p>
                    <p className={`text-xs num ${stats.desviacionPresupuesto > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {stats.desviacionPresupuesto > 0 ? "+" : ""}
                      {fmtEuro(stats.desviacionPresupuesto)} de desviación
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">Sin presupuesto definido</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-600/40 p-3" title="Estimación: kWh × factor de emisión del mix eléctrico o del gas natural">
                <p className="text-xs text-slate-500">CO2 estimado (12 m.)</p>
                <p className="num font-bold text-slate-100">{fmtCo2(stats.co2Kg)}</p>
              </div>
            </div>

            {lista.length > 0 && (
              <div className="rounded-xl border border-slate-600/40 p-4">
                <div className="flex items-end gap-1 h-28">
                  {[...lista].reverse().slice(-14).map((c) => (
                    <div key={c._id} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0" title={`${fmtPeriodo(c.periodo)}: ${fmtKwh(c.kwh)}`}>
                      <div
                        className="w-full rounded-t bg-amber-400/70"
                        style={{ height: `${Math.max(3, Math.round((c.kwh / max) * 100))}%` }}
                      />
                      <span className="text-[0.6rem] text-slate-500 num truncate w-full text-center">
                        {c.periodo.slice(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={guardar} className="rounded-xl border border-slate-600/40 p-4 flex flex-wrap items-end gap-3">
              <label className="text-sm text-slate-400">
                Mes
                <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="input" required />
              </label>
              <label className="text-sm text-slate-400">
                kWh
                <input value={kwh} onChange={(e) => setKwh(e.target.value)} className="input num" inputMode="decimal" required />
              </label>
              <label className="text-sm text-slate-400">
                Factura (€)
                <input value={importe} onChange={(e) => setImporte(e.target.value)} className="input num" inputMode="decimal" />
              </label>
              <button type="submit" className="btn-primary">Apuntar</button>
              <p className="text-xs text-slate-500 w-full">Repetir un mes ya apuntado lo actualiza.</p>
            </form>

            {lista.length > 0 && (
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th className="text-right">kWh</th>
                      <th className="text-right">Factura</th>
                      <th>Origen</th>
                      <th className="text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((c) => (
                      <tr key={c._id}>
                        <td className="text-slate-300 whitespace-nowrap">{fmtPeriodo(c.periodo)}</td>
                        <td className="text-right num text-slate-200 whitespace-nowrap">{fmtKwh(c.kwh)}</td>
                        <td className="text-right num text-slate-300 whitespace-nowrap">{c.importe > 0 ? fmtEuro(c.importe) : "—"}</td>
                        <td className="text-xs text-slate-500">{c.origen === "ocr" ? "Factura (IA)" : "Manual"}</td>
                        <td className="text-right">
                          <button onClick={() => borrar(c)} className="p-1.5 text-slate-400 hover:text-rose-400" title="Borrar">
                            <IconBorrar />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
