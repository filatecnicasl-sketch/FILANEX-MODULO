import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio, euros } from "../../components/ui.jsx";
import { ESTADOS_OT, nombreEstado, tonoEstado, nombreEstadoCita, tonoEstadoCita } from "./datos.js";
import RecepcionRapida from "./RecepcionRapida.jsx";
import ModalRecepcion from "./ModalRecepcion.jsx";

export default function TallerPanelPage() {
  const [panel, setPanel] = useState(null);
  const [error, setError] = useState(null);
  const [recepcion, setRecepcion] = useState(false);
  const [recepcionOT, setRecepcionOT] = useState(undefined); // OT recién creada: fotos + firma + hoja

  async function cargar() {
    try {
      const r = await fetch("/api/taller/panel");
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
        <CabeceraPagina titulo="Panel del taller" descripcion="Visión operativa del día a día." />
        <EstadoVacio titulo="No se pudo cargar el taller" descripcion={error} />
      </>
    );
  }
  if (!panel) return null;

  const kpis = [
    { etiqueta: "Vehículos", valor: panel.vehiculos },
    { etiqueta: "Órdenes abiertas", valor: panel.ordenesAbiertas },
    ...ESTADOS_OT.map((e) => ({ etiqueta: e.nombre, valor: panel.estados[e.clave], tono: e.tono })),
    { etiqueta: "Citas hoy", valor: panel.citasHoy?.length ?? 0 },
    {
      etiqueta: panel.cortesia?.vencidos > 0 ? `Cortesía (${panel.cortesia.vencidos} vencido/s)` : "Cortesía activos",
      valor: panel.cortesia?.activos ?? 0,
      alerta: panel.cortesia?.vencidos > 0,
    },
  ];

  return (
    <>
      <CabeceraPagina titulo="Panel del taller" descripcion="Visión operativa del día a día.">
        <button onClick={() => setRecepcion(true)} className="btn-primary">
          Recepción rápida
        </button>
      </CabeceraPagina>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
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
            <a href="/taller/agenda" className="text-xs text-accent hover:underline">Ver agenda</a>
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
                      {[c.matricula, c.motivo].filter(Boolean).join(" · ")}
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
            <a href="/taller/ordenes" className="text-xs text-accent hover:underline">Ver todas</a>
          </div>
          {panel.ultimas.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Sin órdenes todavía. Usa «Recepción rápida» para abrir la primera.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {panel.ultimas.map((o) => (
                <li key={o._id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold">
                      {o.numero} <span className="text-slate-400 font-normal">· {o.matricula}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {o.clienteNombre ?? "Sin cliente"}
                      {o.trabajos?.length > 0 ? ` · ${o.trabajos.join(", ")}` : ""}
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

      {recepcion && (
        <RecepcionRapida
          onCerrar={() => setRecepcion(false)}
          onCreada={(datos) => {
            setRecepcion(false);
            cargar();
            // Tras el alta: fotos del estado, firma e impresión de la hoja.
            if (datos?.orden) setRecepcionOT(datos.orden);
          }}
        />
      )}

      {recepcionOT !== undefined && (
        <ModalRecepcion
          orden={recepcionOT}
          recienCreada
          onCerrar={() => setRecepcionOT(undefined)}
          onGuardada={cargar}
        />
      )}
    </>
  );
}
