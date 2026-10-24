import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { EstadoVacio, euros } from "../../components/ui.jsx";
import { ESTADOS_OS, nombreEstado, tonoEstado, nombreEstadoCita, tonoEstadoCita } from "./datos.js";
import { IconAparato, IconOrdenes, IconAgenda, IconServicio } from "../../components/icons.jsx";

const TONOS_TARJETA = {
  sky: { fondo: "bg-sky-50", borde: "border-sky-200", texto: "text-sky-700", icono: "bg-sky-100 text-sky-600" },
  emerald: { fondo: "bg-emerald-50", borde: "border-emerald-200", texto: "text-emerald-700", icono: "bg-emerald-100 text-emerald-600" },
  amber: { fondo: "bg-amber-50", borde: "border-amber-200", texto: "text-amber-700", icono: "bg-amber-100 text-amber-600" },
  rose: { fondo: "bg-rose-50", borde: "border-rose-200", texto: "text-rose-700", icono: "bg-rose-100 text-rose-600" },
  indigo: { fondo: "bg-indigo-50", borde: "border-indigo-200", texto: "text-indigo-700", icono: "bg-indigo-100 text-indigo-600" },
  violet: { fondo: "bg-violet-50", borde: "border-violet-200", texto: "text-violet-700", icono: "bg-violet-100 text-violet-600" },
};

function TarjetaGrande({ titulo, valor, detalle, tono, to, Icono }) {
  const t = TONOS_TARJETA[tono];
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

function TarjetaContador({ etiqueta, valor, enlace }) {
  return (
    <Link to={enlace} className="block group">
      <div className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-150 group-hover:shadow-sm group-hover:-translate-y-0.5">
        <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-slate-400">{etiqueta}</p>
        <p className="text-2xl font-extrabold tracking-tight mt-2 tabular-nums text-slate-800">{valor}</p>
      </div>
    </Link>
  );
}

function BadgeClaro({ tono, children }) {
  const tonos = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    sky: "bg-sky-100 text-sky-700",
    slate: "bg-slate-100 text-slate-600",
    indigo: "bg-indigo-100 text-indigo-700",
    violet: "bg-violet-100 text-violet-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-medium ${tonos[tono] || tonos.slate}`}>
      {children}
    </span>
  );
}

export default function ServicioPanelPage() {
  const [panel, setPanel] = useState(null);
  const [error, setError] = useState(null);

  async function cargar() {
    try {
      const r = await fetch("/api/servicio/panel");
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar el panel");
      setPanel(datos);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  if (error) {
    return (
      <>
        <CabeceraPagina
          titulo="Servicio Técnico"
          descripcion="SAT de informática y electrónica: reparaciones en tienda y a domicilio."
        />
        <EstadoVacio titulo="No se pudo cargar el servicio técnico" descripcion={error} />
      </>
    );
  }
  if (!panel) return null;

  const totalOrdenes = Object.values(panel.estados).reduce((a, b) => a + b, 0);

  return (
    <>
      <CabeceraPagina
        titulo="Servicio Técnico"
        descripcion="SAT de informática y electrónica: reparaciones en tienda y a domicilio."
      >
        <Link to="/servicio/aparatos" className="btn-ghost">Aparatos</Link>
        <Link to="/servicio/ordenes" className="btn-primary">Órdenes</Link>
      </CabeceraPagina>

      {/* Tarjetas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <TarjetaGrande
          titulo="Aparatos"
          valor={panel.aparatos}
          detalle="Registrados en el SAT"
          tono="sky"
          to="/servicio/aparatos"
          Icono={IconAparato}
        />
        <TarjetaGrande
          titulo="Órdenes abiertas"
          valor={panel.ordenesAbiertas}
          detalle={`${totalOrdenes} órdenes en total`}
          tono="indigo"
          to="/servicio/ordenes"
          Icono={IconOrdenes}
        />
        <TarjetaGrande
          titulo="Citas hoy"
          valor={panel.citasHoy?.length ?? 0}
          detalle="Agenda del día"
          tono="emerald"
          to="/servicio/agenda"
          Icono={IconAgenda}
        />
        <TarjetaGrande
          titulo="En curso"
          valor={panel.estados.en_curso ?? 0}
          detalle="Reparaciones activas"
          tono="amber"
          to="/servicio/ordenes"
          Icono={IconServicio}
        />
      </div>

      {/* Contadores por estado */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {ESTADOS_OS.map((e) => (
          <TarjetaContador
            key={e.clave}
            etiqueta={e.nombre}
            valor={panel.estados[e.clave] ?? 0}
            enlace="/servicio/ordenes"
          />
        ))}
      </div>

      {/* Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-[0.875rem] font-semibold text-slate-800">Agenda de hoy</h2>
            <Link to="/servicio/agenda" className="text-xs text-accent hover:underline font-medium">Ver agenda →</Link>
          </div>
          {(panel.citasHoy ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">Sin citas para hoy.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {panel.citasHoy.map((c) => (
                <li key={c._id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {c.hora} <span className="text-slate-500 font-normal">· {c.clienteNombre ?? c.motivo ?? "—"}</span>
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {[c.aparatoDescripcion, c.motivo].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <BadgeClaro tono={tonoEstadoCita(c.estado)}>{nombreEstadoCita(c.estado)}</BadgeClaro>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-[0.875rem] font-semibold text-slate-800">Últimas órdenes</h2>
            <Link to="/servicio/ordenes" className="text-xs text-accent hover:underline font-medium">Ver todas →</Link>
          </div>
          {panel.ultimas.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              Sin órdenes todavía. Abre la primera desde «Órdenes».
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {panel.ultimas.map((o) => (
                <li key={o._id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {o.numero} <span className="text-slate-500 font-normal">· {o.aparatoDescripcion ?? "—"}</span>
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {o.clienteNombre ?? "Sin cliente"}
                      {o.tipoServicio === "domicilio" ? " · Domicilio" : ""}
                      {o.averia ? ` · ${o.averia}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <BadgeClaro tono={tonoEstado(o.estado)}>{nombreEstado(o.estado)}</BadgeClaro>
                    <span className="text-sm font-semibold text-slate-700 w-20 text-right tabular-nums">{euros(o.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
