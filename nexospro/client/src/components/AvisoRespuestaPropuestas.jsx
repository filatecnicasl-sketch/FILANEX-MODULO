import { useEffect, useState } from "react";
import { enModoSoporte, payloadToken } from "../lib/sesion.js";

// Aviso flotante en la pantalla principal: cuando el equipo FILANEX responde
// a una propuesta del usuario, al entrar en el programa salta esta ventana
// con su propuesta y la respuesta. Al cerrarla ("Entendido") queda marcada
// como leída y no vuelve a aparecer. Solo salta al autor de la propuesta
// (o a cualquiera si no se sabe su correo), y nunca en sesión de soporte.
function fechaTxt(iso) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AvisoRespuestaPropuestas() {
  const [pendientes, setPendientes] = useState([]);

  useEffect(() => {
    // El soporte trabajando dentro de la empresa no ve los avisos del cliente.
    if (enModoSoporte()) return;
    const email = payloadToken()?.email ?? "";
    let vivo = true;
    fetch("/api/propuestas")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => {
        if (!vivo || !Array.isArray(lista)) return;
        setPendientes(
          lista.filter(
            (p) =>
              p.respuesta &&
              !p.respuestaLeida &&
              (!p.usuarioEmail || !email || p.usuarioEmail === email)
          )
        );
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  function cerrar() {
    const ids = pendientes.map((p) => p._id);
    setPendientes([]);
    // Si falla el marcado, el aviso volverá a salir la próxima vez: es lo
    // seguro (nunca se pierde una respuesta por un fallo de red).
    for (const id of ids) {
      fetch(`/api/propuestas/${id}/leida`, { method: "POST" }).catch(() => {});
    }
  }

  if (pendientes.length === 0) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={cerrar}
    >
      <div
        className="modal-panel w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">
            Respuesta del equipo FILANEX
            {pendientes.length > 1 ? ` (${pendientes.length})` : ""}
          </h2>
          <button
            type="button"
            onClick={cerrar}
            className="text-slate-400 hover:text-white text-xl leading-none px-1"
            title="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {pendientes.map((p) => (
            <div key={p._id} className="space-y-2.5">
              <p className="text-xs text-slate-500">
                Tu propuesta {p.respuestaFecha ? `del ${fechaTxt(p.createdAt)} ` : ""}
                {p.respuestaFecha ? `· respondida el ${fechaTxt(p.respuestaFecha)}` : ""}
              </p>
              <p className="text-sm text-slate-400 italic line-clamp-4 border-l-2 border-slate-600 pl-3">
                “{(p.texto ?? "").slice(0, 220)}
                {(p.texto ?? "").length > 220 ? "…" : ""}”
              </p>
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5">
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {p.respuesta}
                </p>
                {p.respondidaPor && (
                  <p className="text-xs text-emerald-400 mt-2">— {p.respondidaPor}</p>
                )}
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-500">
            Puedes releerla cuando quieras en Ayuda → Novedades → Propuestas.
          </p>
        </div>

        <div className="border-t border-white/10 px-6 py-4 flex justify-end gap-2">
          <button type="button" onClick={cerrar} className="btn-primary">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
