import { useCallback, useEffect, useMemo, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";

// Panel de actividad: estadísticas de uso por usuario + registro detallado.
// Solo visible para administradores (Ajustes).

const NOMBRE_METODO = { POST: "Alta", PUT: "Cambio", PATCH: "Cambio", DELETE: "Borrado" };

function Kpi({ titulo, valor, detalle, tono = "slate" }) {
  const tonos = {
    slate: "bg-white border-slate-200",
    azul: "bg-sky-50 border-sky-200",
    verde: "bg-emerald-50 border-emerald-200",
    rojo: "bg-rose-50 border-rose-200",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tonos[tono]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}

export default function ActividadPage() {
  const [resumen, setResumen] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [metodo, setMetodo] = useState("");
  const [usuario, setUsuario] = useState("");
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/auditoria/resumen")
      .then((r) => r.json())
      .then(setResumen)
      .catch(() => {});
  }, []);

  const cargar = useCallback(async (texto, met, usu, pag) => {
    setCargando(true);
    try {
      const params = new URLSearchParams({ pagina: String(pag) });
      if (texto) params.set("q", texto);
      if (met) params.set("metodo", met);
      if (usu) params.set("usuario", usu);
      const r = await fetch(`/api/auditoria?${params}`);
      const datos = await r.json();
      setItems(datos.items ?? []);
      setTotal(datos.total ?? 0);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => cargar(q, metodo, usuario, pagina), 300);
    return () => clearTimeout(t);
  }, [q, metodo, usuario, pagina, cargar]);

  const paginas = Math.max(1, Math.ceil(total / 50));
  const maxDia = useMemo(
    () => Math.max(1, ...(resumen?.dias ?? []).map((d) => d.total)),
    [resumen]
  );
  const altas = resumen?.porMetodo?.POST ?? 0;
  const cambios = (resumen?.porMetodo?.PUT ?? 0) + (resumen?.porMetodo?.PATCH ?? 0);
  const borrados = resumen?.porMetodo?.DELETE ?? 0;

  return (
    <div className="space-y-6">
      <CabeceraPagina
        titulo="Actividad"
        subtitulo="Uso de la aplicación por usuario: altas, cambios y borrados."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Hoy" valor={resumen?.hoy ?? "…"} detalle="operaciones" tono="azul" />
        <Kpi titulo="Últimos 7 días" valor={resumen?.ultimos7 ?? "…"} detalle="operaciones" />
        <Kpi
          titulo="Altas / Cambios / Borrados"
          valor={`${altas} / ${cambios} / ${borrados}`}
          detalle="histórico total"
          tono="verde"
        />
        <Kpi
          titulo="Errores (7 días)"
          valor={resumen?.errores7 ?? "…"}
          detalle="respuestas con fallo"
          tono={resumen?.errores7 > 0 ? "rojo" : "slate"}
        />
      </div>

      {/* Gráfico de actividad diaria */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Actividad de los últimos 14 días</h2>
        <div className="flex items-end gap-1.5 h-32">
          {(resumen?.dias ?? []).map((d) => (
            <div key={d.fecha} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.fecha}: ${d.total}`}>
              <span className="text-[10px] text-slate-400">{d.total > 0 ? d.total : ""}</span>
              <div
                className={`w-full rounded-t ${d.total > 0 ? "bg-sky-500" : "bg-slate-100"}`}
                style={{ height: `${Math.max(4, (d.total / maxDia) * 88)}px` }}
              />
              <span className="text-[9px] text-slate-400">
                {d.fecha.slice(8)}/{d.fecha.slice(5, 7)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Ranking de usuarios */}
      {(resumen?.usuarios?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Actividad por usuario (7 días)</h2>
          <div className="space-y-2">
            {resumen.usuarios.map((u) => {
              const max = resumen.usuarios[0].total || 1;
              return (
                <button
                  key={String(u.usuario)}
                  onClick={() => { setUsuario(usuario === String(u.usuario) ? "" : String(u.usuario)); setPagina(1); }}
                  className={`w-full text-left rounded-xl border px-3 py-2 transition ${
                    usuario === String(u.usuario) ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{u.nombre || u.email}</span>
                    <span className="text-xs text-slate-500 shrink-0">
                      {u.total} op.{u.errores > 0 && <span className="text-rose-600 font-semibold"> · {u.errores} err.</span>}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(u.total / max) * 100}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
          {usuario && (
            <button className="mt-3 text-xs text-sky-700 hover:underline" onClick={() => setUsuario("")}>
              Quitar filtro de usuario
            </button>
          )}
        </div>
      )}

      {/* Registro detallado */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mr-auto">Registro detallado · {total}</h2>
          <select value={metodo} onChange={(e) => { setMetodo(e.target.value); setPagina(1); }} className="input !w-auto !py-1.5 text-sm">
            <option value="">Todas las operaciones</option>
            <option value="POST">Altas</option>
            <option value="PUT">Cambios</option>
            <option value="DELETE">Borrados</option>
          </select>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPagina(1); }}
            placeholder="Buscar por usuario u operación…"
            className="input !w-64 !py-1.5 text-sm"
          />
        </div>

        {cargando && items.length === 0 ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-slate-500">Sin actividad registrada con esos filtros.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((a) => (
              <div key={a._id} className="rounded-lg border border-slate-100 px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-slate-50">
                <span className="text-xs text-slate-400 w-32 shrink-0">
                  {new Date(a.createdAt).toLocaleString("es-ES")}
                </span>
                <span className="font-medium text-sm">{a.nombre || a.email || "—"}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  a.metodo === "DELETE" ? "bg-rose-100 text-rose-700" :
                  a.metodo === "POST" ? "bg-emerald-100 text-emerald-700" :
                  "bg-sky-100 text-sky-700"
                }`}>
                  {NOMBRE_METODO[a.metodo] ?? a.metodo}
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
    </div>
  );
}
