import { useState } from "react";
import { comprobarActualizacion, aplicarActualizacion } from "../lib/actualizacion.js";

// Botón de la barra superior: comprueba si hay una versión nueva del
// programa y la aplica. Pensado para usuarios que no cierran la app en
// días (TPV, recepción de taller…): no hace falta salir y entrar.
export default function BotonActualizar() {
  const [estado, setEstado] = useState("idle"); // idle | comprobando | aldia

  async function pulsar() {
    if (estado === "comprobando") return;
    setEstado("comprobando");
    try {
      if (await comprobarActualizacion()) {
        await aplicarActualizacion(); // recarga la página
        return;
      }
      setEstado("aldia");
      setTimeout(() => setEstado("idle"), 2500);
    } catch {
      setEstado("idle");
    }
  }

  const titulo =
    estado === "aldia"
      ? "Ya tienes la última versión"
      : "Buscar actualizaciones del programa";

  return (
    <button
      type="button"
      onClick={pulsar}
      title={titulo}
      className={`flex items-center gap-1.5 text-[0.75rem] font-medium transition-colors ${
        estado === "aldia" ? "text-emerald-400" : "text-slate-400 hover:text-accent"
      }`}
    >
      {estado === "aldia" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={estado === "comprobando" ? "animate-spin" : ""}
        >
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        </svg>
      )}
      <span className="hidden sm:inline">
        {estado === "aldia" ? "Al día" : "Actualizar"}
      </span>
    </button>
  );
}
