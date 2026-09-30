import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";

// Panel de Energía: foto de la cartera de suministros. Solo datos reales:
// totales, luz/gas, estados y distribución por comercializadora.
export default function EnergiaPage() {
  const [suministros, setSuministros] = useState(null);
  const [comercializadoras, setComercializadoras] = useState(null);
  const [tramites, setTramites] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/energia/suministros")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error al cargar suministros"))))
      .then((d) => setSuministros(Array.isArray(d) ? d : []))
      .catch((e) => {
        setError(e.message);
        setSuministros([]);
      });
    fetch("/api/energia/comercializadoras")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setComercializadoras(Array.isArray(d) ? d : []))
      .catch(() => setComercializadoras([]));
    fetch("/api/energia/tramites")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTramites(Array.isArray(d) ? d : []))
      .catch(() => setTramites([]));
  }, []);

  if (suministros === null || comercializadoras === null) {
    return (
      <CabeceraPagina titulo="Energía" descripcion="Panel del módulo de energía.">
        <div className="panel px-4 py-10 text-center text-slate-500">Cargando…</div>
      </CabeceraPagina>
    );
  }

  const activos = suministros.filter((s) => s.estado === "activo");
  const luz = activos.filter((s) => s.tipo === "luz").length;
  const gas = activos.filter((s) => s.tipo === "gas").length;
  const inactivos = suministros.filter((s) => s.estado !== "activo").length;
  const tramitesEnCurso = tramites.filter((t) =>
    ["documentacion", "enviado", "en_tramite"].includes(t.estado)
  ).length;

  // Distribución por comercializadora (solo activos).
  const porComercializadora = Object.entries(
    activos.reduce((acc, s) => {
      const nombre = s.comercializadoraNombre ?? s.comercializadora?.nombre ?? "Sin asignar";
      acc[nombre] = (acc[nombre] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const tarjetas = [
    { etiqueta: "Suministros activos", valor: activos.length, tono: "text-emerald-300", enlace: "/energia/suministros" },
    { etiqueta: "Trámites en curso", valor: tramitesEnCurso, tono: "text-sky-300", enlace: "/energia/tramites" },
    { etiqueta: "Luz", valor: luz, tono: "text-amber-300", enlace: "/energia/suministros" },
    { etiqueta: "Gas", valor: gas, tono: "text-sky-300", enlace: "/energia/suministros" },
    { etiqueta: "Inactivos / baja", valor: inactivos, tono: "text-slate-400", enlace: "/energia/suministros" },
    { etiqueta: "Comercializadoras", valor: comercializadoras.length, tono: "text-violet-300", enlace: "/energia/comercializadoras" },
  ];

  return (
    <CabeceraPagina titulo="Energía" descripcion="Cartera de suministros de luz y gas de tus clientes.">
      {error && <div className="panel px-4 py-3 text-sm text-rose-400 mb-3">{error}</div>}

      {suministros.length === 0 && comercializadoras.length === 0 ? (
        <div className="panel px-6 py-10 text-center space-y-3">
          <p className="text-slate-300 font-medium">El módulo de Energía está activo y vacío.</p>
          <p className="text-sm text-slate-500">
            Empieza creando tus comercializadoras con sus condiciones de comisión; después darás de alta los
            suministros (CUPS) de tus clientes.
          </p>
          <Link to="/energia/comercializadoras" className="btn-primary inline-block mt-2">
            Crear la primera comercializadora
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-4">
          {tarjetas.map((t) => (
            <Link key={t.etiqueta} to={t.enlace} className="panel px-4 py-4 hover:border-sky-500/40 transition-colors">
              <p className="text-xs uppercase tracking-wider text-slate-500">{t.etiqueta}</p>
              <p className={`text-3xl font-bold num mt-1 ${t.tono}`}>{t.valor}</p>
            </Link>
          ))}
        </div>
      )}

      {porComercializadora.length > 0 && (
        <div className="panel p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-3">Suministros activos por comercializadora</h2>
          <div className="space-y-2">
            {porComercializadora.map(([nombre, n]) => {
              const pct = activos.length > 0 ? Math.round((n / activos.length) * 100) : 0;
              return (
                <div key={nombre} className="flex items-center gap-3 text-sm">
                  <span className="w-48 truncate text-slate-300">{nombre}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-700/50 overflow-hidden">
                    <div className="h-full rounded-full bg-sky-500/70" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="num text-slate-400 w-16 text-right">{n} ({pct} %)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </CabeceraPagina>
  );
}
