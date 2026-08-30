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
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [devolviendo, setDevolviendo] = useState(null);
  const [parcial, setParcial] = useState(null); // { ticket, cantidades: {indice: n} }

  const cargar = useCallback(async () => {
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const [rTickets, rResumen] = await Promise.all([
        fetch(`/api/tpv/tickets?fecha=${hoy}`),
        fetch(`/api/tpv/resumen?fecha=${hoy}`),
      ]);
      const datos = await rTickets.json();
      if (!rTickets.ok) throw new Error(datos.error || "Error al cargar tickets");
      setTickets(datos);
      if (rResumen.ok) setResumen(await rResumen.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function devolver(t, lineas) {
    setDevolviendo(t._id);
    setError(null);
    try {
      const r = await fetch(`/api/tpv/tickets/${t._id}/devolucion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: lineas ? JSON.stringify({ lineas }) : undefined,
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo devolver");
      setParcial(null);
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

  function imprimirRegalo(t) {
    window.open(`/api/tpv/tickets/${t._id}/imprimir?regalo=1`, "_blank", "width=400,height=600");
  }

  function confirmarParcial() {
    const lineas = Object.entries(parcial.cantidades)
      .filter(([, cantidad]) => cantidad > 0)
      .map(([indice, cantidad]) => ({ indice: Number(indice), cantidad }));
    if (!lineas.length) return;
    devolver(parcial.ticket, lineas);
  }

  const totalParcial = parcial
    ? parcial.ticket.lineas.reduce((acc, l, i) => {
        const cantidad = parcial.cantidades[i] ?? 0;
        return acc + cantidad * l.precio * (1 - (l.descuento ?? 0) / 100) * (1 + l.iva / 100);
      }, 0)
    : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <CabeceraPagina
        titulo="Tickets del día"
        subtitulo="Ventas del TPV registradas hoy"
        acciones={
          <button onClick={() => navigate("/tpv")} className="btn-primary">
            Volver al terminal
          </button>
        }
      />

      {error && <p className="text-sm text-rose-400 mb-4">{error}</p>}

      {/* Resumen del día */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Ventas</p>
            <p className="num text-2xl font-extrabold text-emerald-300">{euros(resumen.ventas)}</p>
            <p className="text-xs text-slate-500 mt-1">{resumen.numeroTickets} tickets</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Devoluciones</p>
            <p className="num text-2xl font-extrabold text-rose-400">{euros(resumen.devoluciones)}</p>
            <p className="text-xs text-slate-500 mt-1">{resumen.numeroDevoluciones} rectificativas</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Por método</p>
            <p className="num text-sm font-semibold mt-1 text-slate-300">
              <span className="text-emerald-300">{euros(resumen.porMetodo.efectivo)}</span> efec.
            </p>
            <p className="num text-sm font-semibold text-slate-300">
              <span className="text-cyan-300">{euros(resumen.porMetodo.tarjeta)}</span> tarj.
              {(resumen.porMetodo.otro ?? 0) !== 0 && (
                <span className="text-slate-400"> · {euros(resumen.porMetodo.otro)} otros</span>
              )}
            </p>
          </div>
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Más vendidos</p>
            <div className="text-xs mt-1 space-y-0.5 text-slate-300">
              {resumen.topArticulos.slice(0, 3).map((a) => (
                <p key={a.descripcion} className="truncate">
                  <span className="font-bold text-slate-200">{a.cantidad}</span> × {a.descripcion}
                </p>
              ))}
              {!resumen.topArticulos.length && <p className="text-slate-500">—</p>}
            </div>
          </div>
        </div>
      )}

      {cargando ? (
        <p className="text-slate-400">Cargando…</p>
      ) : !tickets.length ? (
        <p className="text-slate-500">No hay tickets hoy.</p>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const esDevolucion = t.total < 0;
            const devueltoTodo = t.estado === "rectificada";
            return (
              <div
                key={t._id}
                className="panel flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-200">
                    {t.serieNumero}{" "}
                    <span className="text-sm font-normal text-slate-500">
                      {new Date(t.fechaExpedicion).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                  <p className="text-sm text-slate-500 truncate">
                    {t.lineas?.length ?? 0} líneas · {METODOS[t.metodoCobro] ?? t.metodoCobro}
                    {esDevolucion && <span className="ml-2 font-semibold text-rose-400">devolución</span>}
                    {!esDevolucion && !devueltoTodo && t.lineas?.some((l) => l.devuelto > 0) && (
                      <span className="ml-2 font-semibold text-amber-300">devolución parcial</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className={`num text-xl font-extrabold mr-1 ${esDevolucion ? "text-rose-400" : "text-emerald-300"}`}>
                    {euros(t.total)}
                  </p>
                  {devueltoTodo ? (
                    <span className="px-3 py-1 rounded-full bg-rose-400/10 border border-rose-400/25 text-rose-400 text-sm font-semibold">
                      Devuelto
                    </span>
                  ) : (
                    <>
                      <button onClick={() => imprimir(t)} className="btn-ghost">
                        Reimprimir
                      </button>
                      {!esDevolucion && (
                        <>
                          <button
                            onClick={() => imprimirRegalo(t)}
                            title="Ticket regalo (sin precios, para cambios)"
                            className="btn-ghost"
                          >
                            Regalo
                          </button>
                          <button
                            onClick={() => setParcial({ ticket: t, cantidades: {} })}
                            disabled={devolviendo === t._id}
                            className="inline-flex items-center gap-2 border border-amber-400/25 bg-amber-400/10 text-amber-300 font-semibold text-sm px-4 py-2 rounded-lg transition-colors hover:bg-amber-400/15 disabled:opacity-50"
                          >
                            Devolución
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Devolución: elegir líneas/cantidades o íntegra */}
      {parcial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-panel w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-200 mb-1">
              Devolución de {parcial.ticket.serieNumero}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Elige las cantidades a devolver (genera rectificativa R5):
            </p>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {parcial.ticket.lineas.map((l, i) => {
                const pendiente = l.pendiente ?? l.cantidad;
                if (pendiente <= 0) return null;
                const cantidad = parcial.cantidades[i] ?? 0;
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-200 truncate">{l.descripcion}</p>
                      <p className="text-xs text-slate-500">
                        {euros(l.precio)} · pendiente {pendiente}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setParcial((p) => ({
                            ...p,
                            cantidades: { ...p.cantidades, [i]: Math.max(0, cantidad - 1) },
                          }))
                        }
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 font-bold"
                      >
                        −
                      </button>
                      <span className="num w-6 text-center font-bold text-slate-200">{cantidad}</span>
                      <button
                        onClick={() =>
                          setParcial((p) => ({
                            ...p,
                            cantidades: { ...p.cantidades, [i]: Math.min(pendiente, cantidad + 1) },
                          }))
                        }
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="num text-right text-lg font-bold text-amber-300 mb-4">
              A devolver: {euros(totalParcial)}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setParcial(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => devolver(parcial.ticket)}
                disabled={devolviendo === parcial.ticket._id}
                className="btn-peligro flex-1 py-3 opacity-80 hover:opacity-100"
              >
                Íntegra
              </button>
              <button
                onClick={confirmarParcial}
                disabled={devolviendo === parcial.ticket._id || totalParcial <= 0}
                className="btn-peligro flex-1 py-3"
              >
                {devolviendo === parcial.ticket._id ? "…" : "Parcial"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
