import { useEffect, useState } from "react";
import { useSync } from "../hooks/useSync.js";
import { registrarSW } from "../lib/pwa.js";

// Avisos discretos abajo a la derecha: falta de conexión, cola pendiente y versión nueva.
export default function AvisoConexion() {
  const { online, deCache, pendientes, sincronizar, sincronizando } = useSync();
  const [activarNueva, setActivarNueva] = useState(null);

  useEffect(() => {
    registrarSW((activar) => setActivarNueva(() => activar));
  }, []);

  const mostrarOffline = !online || deCache;
  if (!mostrarOffline && !activarNueva && !pendientes) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      {mostrarOffline && (
        <div className="pointer-events-auto flex max-w-xs items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/90 px-3 py-2 text-xs text-amber-200 shadow-lg backdrop-blur">
          <span className="mt-1 w-2 h-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
          <span>
            Sin conexión — estás viendo los últimos datos guardados. Los cambios se guardarán
            cuando vuelva internet.
          </span>
        </div>
      )}
      {online && pendientes > 0 && (
        <button
          type="button"
          onClick={sincronizar}
          disabled={sincronizando}
          className="pointer-events-auto flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent backdrop-blur disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={sincronizando ? "animate-spin" : ""}>
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          {sincronizando ? "Subiendo..." : `${pendientes} pendiente${pendientes > 1 ? "s" : ""}`}
        </button>
      )}
      {activarNueva && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent backdrop-blur">
          <span>Hay una versión nueva de FILANEX.</span>
          <button
            type="button"
            onClick={() => activarNueva()}
            className="rounded-lg bg-accent px-2.5 py-1 font-semibold text-slate-950"
          >
            Actualizar
          </button>
        </div>
      )}
    </div>
  );
}
