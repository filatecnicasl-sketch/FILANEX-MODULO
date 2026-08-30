import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { euros } from "../../components/ui.jsx";

const METODOS = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

export default function TpvTicketsPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [devolviendo, setDevolviendo] = useState(null);
  const [confirmar, setConfirmar] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const r = await fetch(`/api/tpv/tickets?fecha=${hoy}`);
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar tickets");
      setTickets(datos);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function devolver(t) {
    setDevolviendo(t._id);
    setError(null);
    try {
      const r = await fetch(`/api/tpv/tickets/${t._id}/devolucion`, { method: "POST" });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo devolver");
      setConfirmar(null);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setDevolviendo(null);
    }
  }

  function imprimir(t) {
    window.open(`/api/tpv/tickets/${t._id}/imprimir`, "_blank", "width=400,height=600");
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <CabeceraPagina
        titulo="Tickets del día"
        subtitulo="Ventas del TPV registradas hoy"
        acciones={
          <button
            onClick={() => navigate("/tpv")}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
          >
            Volver al terminal
          </button>
        }
      />

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {cargando ? (
        <p className="text-slate-400">Cargando…</p>
      ) : !tickets.length ? (
        <p className="text-slate-500">No hay tickets hoy.</p>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div
              key={t._id}
              className="flex items-center justify-between bg-slate-900 rounded-xl p-4 border border-slate-800"
            >
              <div>
                <p className="font-bold text-lg">
                  {t.serieNumero}{" "}
                  <span className="text-sm font-normal text-slate-400">
                    {new Date(t.fechaExpedicion).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
                <p className="text-sm text-slate-400">
                  {t.lineas?.length ?? 0} líneas · {METODOS[t.metodoCobro] ?? t.metodoCobro}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xl font-extrabold text-emerald-400">{euros(t.total)}</p>
                {t.estado === "rectificada" ? (
                  <span className="px-3 py-1 rounded-full bg-rose-600/20 text-rose-400 text-sm font-semibold">
                    Devuelto
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => imprimir(t)}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
                    >
                      Reimprimir
                    </button>
                    <button
                      onClick={() => setConfirmar(t)}
                      disabled={devolviendo === t._id}
                      className="px-3 py-2 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 text-sm disabled:opacity-50"
                    >
                      {devolviendo === t._id ? "…" : "Devolver"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6">
            <h3 className="text-lg font-bold mb-2">Devolución</h3>
            <p className="text-slate-400 mb-4">
              ¿Generar rectificativa R5 por el ticket {confirmar.serieNumero}? Se reintegrará{" "}
              {euros(confirmar.total)} en caja si la sesión sigue abierta.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmar(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => devolver(confirmar)}
                disabled={devolviendo === confirmar._id}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold disabled:opacity-50"
              >
                {devolviendo === confirmar._id ? "Procesando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
