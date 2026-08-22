import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio, euros } from "../../components/ui.jsx";
import { ESTADOS_OS, nombreEstado, tonoEstado, nombreEstadoCita, tonoEstadoCita } from "./datos.js";

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

  const kpis = [
    { etiqueta: "Aparatos", valor: panel.aparatos },
    { etiqueta: "Órdenes abiertas", valor: panel.ordenesAbiertas },
    ...ESTADOS_OS.map((e) => ({ etiqueta: e.nombre, valor: panel.estados[e.clave], tono: e.tono })),
    { etiqueta: "Citas hoy", valor: panel.citasHoy?.length ?? 0 },
  ];

  return (
    <>
      <CabeceraPagina
        titulo="Servicio Técnico"
        descripcion="SAT de informática y electrónica: reparaciones en tienda y a domicilio."
      >
        <a href="/servicio/aparatos" className="btn-ghost">
          Aparatos
        </a>
        <a href="/servicio/ordenes" className="btn-primary">
          Órdenes
        </a>
      </CabeceraPagina>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {kpis.map((k) => (
          <div key={k.etiqueta} className="panel px-4 py-4">
            <p className={`text-2xl font-extrabold ${k.alerta ? "text-red-300" : "text-white"}`}>{k.valor}</p>
            <p className="text-xs text-slate-500 mt-1">{k.etiqueta}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Agenda de hoy</h2>
            <a href="/servicio/agenda" className="text-xs text-accent hover:underline">Ver agenda</a>
          </div>
          {(panel.citasHoy ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Sin citas para hoy.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {panel.citasHoy.map((c) => (
                <li key={c._id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold">
                      {c.hora} <span className="text-slate-400 font-normal">· {c.clienteNombre ?? c.motivo ?? "—"}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {[c.aparatoDescripcion, c.motivo].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Badge tono={tonoEstadoCita(c.estado)}>{nombreEstadoCita(c.estado)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Últimas órdenes</h2>
            <a href="/servicio/ordenes" className="text-xs text-accent hover:underline">Ver todas</a>
          </div>
          {panel.ultimas.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Sin órdenes todavía. Abre la primera desde «Órdenes».
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {panel.ultimas.map((o) => (
                <li key={o._id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold">
                      {o.numero} <span className="text-slate-400 font-normal">· {o.aparatoDescripcion ?? "—"}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {o.clienteNombre ?? "Sin cliente"}
                      {o.tipoServicio === "domicilio" ? " · Domicilio" : ""}
                      {o.averia ? ` · ${o.averia}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge tono={tonoEstado(o.estado)}>{nombreEstado(o.estado)}</Badge>
                    <span className="text-sm text-slate-300 w-20 text-right">{euros(o.total)}</span>
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
