import { useState, useEffect, useRef } from "react";
import { useSync } from "../../hooks/useSync.js";
import { euros } from "../../components/ui.jsx";

const METODOS = [
  { id: "efectivo", etiqueta: "Efectivo" },
  { id: "tarjeta", etiqueta: "Tarjeta" },
  { id: "otro", etiqueta: "Otro" },
];

const IMPORTES_RAPIDOS = [5, 10, 20, 50];

export default function CobroModal({ total, onCobrado, onCerrar }) {
  const [metodo, setMetodo] = useState("efectivo");
  const [entregado, setEntregado] = useState(total.toFixed(2));
  const [error, setError] = useState(null);
  const [cobrando, setCobrando] = useState(false);
  const [conRegalo, setConRegalo] = useState(false);
  const inputRef = useRef(null);
  const { sincronizar } = useSync();

  useEffect(() => {
    setEntregado(total.toFixed(2));
    setTimeout(() => inputRef.current?.select(), 80);
  }, [total, metodo]);

  const cambio = Math.max(0, Number(entregado) - total);

  function ponerImporte(v) {
    if (v === "justo") setEntregado(total.toFixed(2));
    else setEntregado((prev) => (Number(prev) + v).toFixed(2));
  }

  async function cobrar() {
    setCobrando(true);
    setError(null);
    try {
      const r = await fetch("/api/tpv/cobrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineas: window.__tpvLineas,
          metodoCobro: metodo,
          entregado: metodo === "efectivo" ? Number(entregado) : undefined,
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo cobrar");
      sincronizar();
      onCobrado({ ...datos, conRegalo });
    } catch (e) {
      setError(e.message);
    } finally {
      setCobrando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white text-slate-800 shadow-2xl border border-slate-200">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold">Cobrar</h2>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>

        <div className="p-5">
          <div className="text-center mb-5">
            <p className="text-sm text-slate-400 uppercase tracking-wide">Total a cobrar</p>
            <p className="text-5xl font-extrabold text-emerald-600">{euros(total)}</p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {METODOS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetodo(m.id)}
                className={`py-3 rounded-xl font-bold text-base transition ${
                  metodo === m.id
                    ? "bg-neutral-900 text-white shadow-lg"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {m.etiqueta}
              </button>
            ))}
          </div>

          {metodo === "efectivo" && (
            <>
              <div className="mb-3">
                <label className="block text-sm text-slate-500 mb-1">Entregado</label>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  value={entregado}
                  onChange={(e) => setEntregado(e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))}
                  className="w-full text-center text-3xl font-bold bg-slate-50 border border-slate-300 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4">
                {IMPORTES_RAPIDOS.map((v) => (
                  <button
                    key={v}
                    onClick={() => ponerImporte(v)}
                    className="py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700"
                  >
                    +{v}€
                  </button>
                ))}
                <button
                  onClick={() => ponerImporte("justo")}
                  className="py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-emerald-600"
                >
                  Justo
                </button>
              </div>

              <div className="text-center mb-4">
                <p className="text-sm text-slate-400">Cambio</p>
                <p className="text-3xl font-bold text-amber-500">{euros(cambio)}</p>
              </div>
            </>
          )}

          {error && <p className="text-sm text-rose-600 mb-3 text-center">{error}</p>}

          <label className="flex items-center justify-center gap-2 mb-4 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={conRegalo}
              onChange={(e) => setConRegalo(e.target.checked)}
              className="w-5 h-5 accent-neutral-900"
            />
            Imprimir también <strong>ticket regalo</strong> (sin precios)
          </label>

          <button
            onClick={cobrar}
            disabled={cobrando || (metodo === "efectivo" && Number(entregado) < total)}
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xl font-extrabold tracking-wide transition"
          >
            {cobrando ? "Cobrando…" : "COBRAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
