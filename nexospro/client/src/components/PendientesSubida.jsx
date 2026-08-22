import { useEffect, useState } from "react";
import { contarPendientes, descartar, listarPendientes, procesarCola, reintentar } from "../lib/colaOffline.js";

// Contador discreto en la barra superior: cuántos trabajos quedan por subir.
// Al pulsarlo se abre el detalle, con reintentar y descartar para lo que haya
// fallado. Si no hay nada pendiente no se ve nada.
export default function PendientesSubida() {
  const [resumen, setResumen] = useState({ total: 0, conError: 0 });
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState([]);

  async function refrescar() {
    try {
      setResumen(await contarPendientes());
      setLista(await listarPendientes());
    } catch {
      // Sin IndexedDB (modo privado antiguo): simplemente no se muestra.
    }
  }

  useEffect(() => {
    refrescar();
    const alCambiar = () => refrescar();
    window.addEventListener("filanex:cola", alCambiar);
    return () => window.removeEventListener("filanex:cola", alCambiar);
  }, []);

  if (!resumen.total) return null;

  const hayError = resumen.conError > 0;

  return (
    <div className="relative shrink-0 no-print">
      <button
        onClick={() => setAbierto((v) => !v)}
        title="Trabajos guardados que faltan por subir"
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[0.75rem] font-semibold border transition-colors ${
          hayError
            ? "text-rose-300 border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20"
            : "text-amber-300 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
        {resumen.total}
        <span className="hidden md:inline">{hayError ? "con error" : "por subir"}</span>
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 top-full mt-2 z-40 w-80 max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-[#0B1220] shadow-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[0.6875rem] uppercase tracking-wider text-slate-500">Pendiente de subir</p>
              <button onClick={() => procesarCola()} className="text-[0.75rem] text-accent hover:underline">
                Subir ahora
              </button>
            </div>
            <ul className="space-y-2">
              {lista.map((op) => (
                <li key={op.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2">
                  <p className="text-[0.8125rem] text-slate-200 font-medium">{op.etiqueta}</p>
                  <p className="text-[0.6875rem] text-slate-500">
                    {new Date(op.creadoEn).toLocaleString("es-ES")}
                  </p>
                  {op.estado === "error" ? (
                    <>
                      <p className="text-[0.75rem] text-rose-400 mt-1">{op.error}</p>
                      <div className="flex gap-3 mt-1">
                        <button onClick={() => reintentar(op.id)} className="text-[0.75rem] text-accent hover:underline">
                          Reintentar
                        </button>
                        <button onClick={() => descartar(op.id)} className="text-[0.75rem] text-slate-400 hover:text-rose-400">
                          Descartar
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-[0.75rem] text-amber-400 mt-1">Esperando conexión</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
