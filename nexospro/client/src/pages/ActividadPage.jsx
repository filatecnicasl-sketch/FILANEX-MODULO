import { useCallback, useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";

// Registro de actividad: qué usuario hizo cada alta, cambio o borrado.
// Solo visible para administradores (Ajustes).
export default function ActividadPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (texto, pag) => {
    setCargando(true);
    try {
      const params = new URLSearchParams({ pagina: String(pag) });
      if (texto) params.set("q", texto);
      const r = await fetch(`/api/auditoria?${params}`);
      const datos = await r.json();
      setItems(datos.items ?? []);
      setTotal(datos.total ?? 0);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => cargar(q, pagina), 300);
    return () => clearTimeout(t);
  }, [q, pagina, cargar]);

  const paginas = Math.max(1, Math.ceil(total / 50));

  return (
    <div>
      <CabeceraPagina
        titulo={`Actividad · ${total} registros`}
        subtitulo="Qué usuario hizo cada alta, cambio o borrado, y cuándo."
      />

      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setPagina(1); }}
        placeholder="Buscar por usuario u operación…"
        className="input mb-4"
      />

      {cargando && items.length === 0 ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          Sin actividad registrada todavía.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a._id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-xs text-slate-400 w-36 shrink-0">
                {new Date(a.createdAt).toLocaleString("es-ES")}
              </span>
              <span className="font-medium text-sm">{a.nombre || a.email || "—"}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                a.metodo === "DELETE" ? "bg-rose-100 text-rose-700" :
                a.metodo === "POST" ? "bg-emerald-100 text-emerald-700" :
                "bg-sky-100 text-sky-700"
              }`}>
                {a.metodo === "POST" ? "Alta" : a.metodo === "DELETE" ? "Borrado" : "Cambio"}
              </span>
              <span className="text-sm text-slate-600 break-all">{a.ruta}</span>
              {a.resultado >= 400 && (
                <span className="text-xs text-rose-600 font-medium">Error {a.resultado}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {paginas > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button className="btn-secondary" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
          <span className="text-sm text-slate-500">Página {pagina} de {paginas}</span>
          <button className="btn-secondary" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
        </div>
      )}
    </div>
  );
}
