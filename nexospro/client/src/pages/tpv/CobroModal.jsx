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

  function tecla(k) {
    if (k === "C") setEntregado("0");
    else if (k === "B") setEntregado((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
    else if (k === ".") {
      if (!entregado.includes(".")) setEntregado((prev) => prev + ".");
    } else setEntregado((prev) => (prev === "0" ? k : prev + k));
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
      onCobrado(datos);
    } catch (e) {
      setError(e.message);
    } finally {
      setCobrando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 text-slate-100 shadow-2xl border border-slate-700">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold">Cobrar</h2>
          <button onClick={onCerrar} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-5">
          <div className="text-center mb-5">
            <p className="text-sm text-slate-400 uppercase tracking-wide">Total a cobrar</p>
            <p className="text-5xl font-extrabold text-emerald-400">{euros(total)}</p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {METODOS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetodo(m.id)}
                className={`py-4 rounded-xl font-bold text-lg transition ${
                  metodo === m.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {m.etiqueta}
              </button>
            ))}
          </div>

          {metodo === "efectivo" && (
            <>
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-1">Entregado</label>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  value={entregado}
                  onChange={(e) => setEntregado(e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))}
                  className="w-full text-center text-3xl font-bold bg-slate-800 border border-slate-600 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4">
                {IMPORTES_RAPIDOS.map((v) => (
                  <button
                    key={v}
                    onClick={() => ponerImporte(v)}
                    className="py-3 rounded-lg bg-slate-800 hover:bg-slate-700 font-semibold"
                  >
                    +{v}€
                  </button>
                ))}
                <button
                  onClick={() => ponerImporte("justo")}
                  className="py-3 rounded-lg bg-slate-800 hover:bg-slate-700 font-semibold text-emerald-400"
                >
                  Justo
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {["1","2","3","4","5","6","7","8","9",".","0","B"].map((k) => (
                  <button
                    key={k}
                    onClick={() => tecla(k)}
                    className="py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-2xl font-bold"
                  >
                    {k === "B" ? "⌫" : k}
                  </button>
                ))}
              </div>

              <div className="text-center mb-4">
                <p className="text-sm text-slate-400">Cambio</p>
                <p className="text-3xl font-bold text-amber-400">{euros(cambio)}</p>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-400 mb-3 text-center">{error}</p>}

          <button
            onClick={cobrar}
            disabled={cobrando || (metodo === "efectivo" && Number(entregado) < total)}
            className="w-full py-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-2xl font-extrabold tracking-wide transition"
          >
            {cobrando ? "Cobrando…" : "COBRAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
