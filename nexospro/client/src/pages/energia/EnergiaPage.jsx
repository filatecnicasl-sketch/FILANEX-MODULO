import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { IconEnergia, IconFirma, IconAseguradora, IconCobros, IconComparativas, IconAvisos, IconDocumentos } from "../../components/icons.jsx";

const TONOS = {
  emerald: { fondo: "bg-emerald-50", borde: "border-emerald-200", texto: "text-emerald-700", icono: "bg-emerald-100 text-emerald-600" },
  sky: { fondo: "bg-sky-50", borde: "border-sky-200", texto: "text-sky-700", icono: "bg-sky-100 text-sky-600" },
  amber: { fondo: "bg-amber-50", borde: "border-amber-200", texto: "text-amber-700", icono: "bg-amber-100 text-amber-600" },
  indigo: { fondo: "bg-indigo-50", borde: "border-indigo-200", texto: "text-indigo-700", icono: "bg-indigo-100 text-indigo-600" },
  violet: { fondo: "bg-violet-50", borde: "border-violet-200", texto: "text-violet-700", icono: "bg-violet-100 text-violet-600" },
  teal: { fondo: "bg-teal-50", borde: "border-teal-200", texto: "text-teal-700", icono: "bg-teal-100 text-teal-600" },
  slate: { fondo: "bg-slate-50", borde: "border-slate-200", texto: "text-slate-600", icono: "bg-slate-100 text-slate-500" },
};

const fmtEuro = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n ?? 0);

function Tarjeta({ titulo, valor, detalle, tono, to, Icono }) {
  const t = TONOS[tono];
  return (
    <Link to={to} className="block group">
      <div className={`rounded-2xl border ${t.borde} ${t.fondo} p-5 transition-all duration-150 group-hover:shadow-md group-hover:-translate-y-0.5`}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{titulo}</p>
          <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${t.icono}`}>
            <Icono />
          </span>
        </div>
        <p className={`text-[1.875rem] leading-tight font-extrabold tracking-tight mt-3 tabular-nums ${t.texto}`}>
          {valor}
        </p>
        <p className="text-xs text-slate-500 mt-1.5">{detalle}</p>
      </div>
    </Link>
  );
}

// Panel de Energía: foto de la cartera de suministros. Solo datos reales:
// totales, luz/gas, estados y distribución por comercializadora.
export default function EnergiaPage() {
  const [suministros, setSuministros] = useState(null);
  const [comercializadoras, setComercializadoras] = useState(null);
  const [tramites, setTramites] = useState([]);
  const [resumenComisiones, setResumenComisiones] = useState(null);
  const [estudios, setEstudios] = useState([]);
  const [alertas, setAlertas] = useState(null);
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
    fetch("/api/energia/comisiones/resumen")
      .then((r) => (r.ok ? r.json() : null))
      .then(setResumenComisiones)
      .catch(() => setResumenComisiones(null));
    fetch("/api/energia/estudios")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setEstudios(Array.isArray(d) ? d : []))
      .catch(() => setEstudios([]));
    fetch("/api/energia/alertas")
      .then((r) => (r.ok ? r.json() : null))
      .then(setAlertas)
      .catch(() => setAlertas(null));
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
  const tramitesEnCurso = tramites.filter((t) =>
    ["documentacion", "enviado", "en_tramite"].includes(t.estado)
  ).length;
  const estudiosEnCurso = estudios.filter((e) => ["borrador", "enviado"].includes(e.estado));
  const ahorroPotencial = estudiosEnCurso.reduce((a, e) => a + Math.max(0, e.ahorroAnual ?? 0), 0);
  const kwhGestionados = activos.reduce((a, s) => a + (Number(s.consumoAnual) || 0), 0);
  const nAlertas = alertas?.total ?? 0;

  // Distribución por comercializadora (solo activos).
  const porComercializadora = Object.entries(
    activos.reduce((acc, s) => {
      const nombre = s.comercializadoraNombre ?? s.comercializadora?.nombre ?? "Sin asignar";
      acc[nombre] = (acc[nombre] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const tarjetas = [
    { titulo: "Suministros activos", valor: activos.length, detalle: `${luz} de luz · ${gas} de gas`, tono: "emerald", to: "/energia/suministros", Icono: IconEnergia },
    { titulo: "Trámites en curso", valor: tramitesEnCurso, detalle: "altas, cambios y bajas en marcha", tono: "sky", to: "/energia/tramites", Icono: IconFirma },
    {
      titulo: "Estudios en curso",
      valor: estudiosEnCurso.length,
      detalle: `ahorro potencial: ${fmtEuro(ahorroPotencial)}/año`,
      tono: "amber",
      to: "/energia/estudios",
      Icono: IconComparativas,
    },
    {
      titulo: "Comisiones pendientes",
      valor: fmtEuro(resumenComisiones?.pendiente.total ?? 0),
      detalle: `cobradas este mes: ${fmtEuro(resumenComisiones?.cobradasMes.total ?? 0)}`,
      tono: "teal",
      to: "/energia/comisiones",
      Icono: IconCobros,
    },
    {
      titulo: "Alertas",
      valor: nAlertas,
      detalle: "renovaciones y estudios sin respuesta",
      tono: nAlertas > 0 ? "amber" : "slate",
      to: "/energia/suministros",
      Icono: IconAvisos,
    },
    {
      titulo: "Energía gestionada",
      valor: `${Number(kwhGestionados).toLocaleString("es-ES")} kWh`,
      detalle: "consumo anual de la cartera activa",
      tono: "indigo",
      to: "/energia/suministros",
      Icono: IconEnergia,
    },
    { titulo: "Autofacturas", valor: "Liquidación", detalle: "conciliación mensual de comisiones", tono: "violet", to: "/energia/autofacturas", Icono: IconDocumentos },
    { titulo: "Comercializadoras", valor: comercializadoras.length, detalle: "con condiciones de comisión", tono: "violet", to: "/energia/comercializadoras", Icono: IconAseguradora },
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          {tarjetas.map((t) => (
            <Tarjeta key={t.titulo} {...t} />
          ))}
        </div>
      )}

      {alertas && alertas.total > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-4">
          <h2 className="text-sm font-semibold text-amber-800 mb-3">Alertas del canal</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {alertas.renovaciones.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">Contratos por renovar</p>
                <ul className="space-y-1.5">
                  {alertas.renovaciones.slice(0, 5).map((r) => (
                    <li key={r._id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-slate-700 truncate">
                        <b>{r.clienteNombre ?? "Sin cliente"}</b> · {r.tipo} · <span className="num text-xs">{r.cups}</span>
                      </span>
                      <span className={`text-xs font-medium whitespace-nowrap ${r.dias < 0 ? "text-rose-600" : "text-amber-700"}`}>
                        {r.dias < 0 ? "vencido" : `${r.dias} días`}
                        {r.telefono ? ` · ${r.telefono}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {alertas.estudiosSinRespuesta.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">Estudios sin respuesta (+7 días)</p>
                <ul className="space-y-1.5">
                  {alertas.estudiosSinRespuesta.slice(0, 5).map((e) => (
                    <li key={e._id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-slate-700 truncate">
                        <b>{e.clienteNombre ?? "Sin cliente"}</b> → {e.comercializadoraNombre ?? "—"}
                      </span>
                      <span className="text-xs text-amber-700 whitespace-nowrap">
                        enviado hace {e.dias} días{e.telefono ? ` · ${e.telefono}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link to="/energia/estudios" className="inline-block mt-2 text-xs font-medium text-sky-700 hover:underline">
                  Ir a los estudios
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {porComercializadora.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Suministros activos por comercializadora</h2>
          <div className="space-y-2">
            {porComercializadora.map(([nombre, n]) => {
              const pct = activos.length > 0 ? Math.round((n / activos.length) * 100) : 0;
              return (
                <div key={nombre} className="flex items-center gap-3 text-sm">
                  <span className="w-48 truncate text-slate-600">{nombre}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="num text-slate-500 w-16 text-right whitespace-nowrap">{n} ({pct} %)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </CabeceraPagina>
  );
}
