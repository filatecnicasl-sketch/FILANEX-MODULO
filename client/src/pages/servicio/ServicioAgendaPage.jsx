import { useCallback, useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import Calendario, { aFechaInput } from "../../components/Calendario.jsx";
import CitaModalServicio from "./CitaModalServicio.jsx";
import { InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import { ESTADOS_CITA } from "./datos.js";

const NOMBRE_ESTADO = Object.fromEntries(ESTADOS_CITA.map((e) => [e.clave, e.nombre]));

export default function ServicioAgendaPage() {
  const [rango, setRango] = useState(null); // { desde, hasta } visibles en el calendario
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { cita?, fecha }
  const [q, setQ] = useState("");

  // Búsqueda por cualquier campo visible de la cita.
  const citasFiltradas = (citas ?? []).filter((c) =>
    coincideBusqueda(
      q,
      c.aparatoDescripcion,
      c.clienteNombre,
      c.telefono,
      c.direccion,
      c.motivo,
      c.notas,
      c.hora,
      new Date(c.fecha).toLocaleDateString("es-ES"),
      NOMBRE_ESTADO[c.estado],
      c.presupuesto ? "presupuesto" : ""
    )
  );

  const cargar = useCallback(async () => {
    if (!rango) return;
    try {
      // Con texto de búsqueda se consultan todas las citas (la buscada puede
      // estar fuera del periodo visible); sin texto, solo el rango visible.
      const url = q.trim()
        ? "/api/servicio/citas"
        : `/api/servicio/citas?desde=${rango.desde}&hasta=${rango.hasta}`;
      const r = await fetch(url);
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar la agenda");
      setCitas(datos);
    } catch (e) {
      setError(e.message);
      setCitas([]);
    }
  }, [rango, q]);

  // Recarga al cambiar el rango; con búsqueda, tras una pequeña pausa al teclear.
  useEffect(() => {
    if (!q.trim()) {
      cargar();
      return;
    }
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar, q]);

  // Cambio rápido de estado desde la vista de lista.
  async function cambiarEstado(cita, estado) {
    await fetch(`/api/servicio/citas/${cita._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    cargar();
  }

  return (
    <>
      <CabeceraPagina
        titulo="Citas del servicio técnico"
        descripcion="Recepciones de aparatos en tienda y visitas a domicilio."
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="mb-3 max-w-md no-print">
        <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por aparato, cliente, teléfono, motivo…" />
      </div>

      {q.trim() ? (
        // Resultados de la búsqueda: lista plana de todas las citas que
        // coinciden, estén en el periodo visible o no.
        <div className="panel overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th className="whitespace-nowrap">Fecha</th>
                <th className="whitespace-nowrap">Hora</th>
                <th>Aparato</th>
                <th>Cliente</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {citasFiltradas.map((c) => {
                const est = ESTADOS_CITA.find((e) => e.clave === c.estado);
                return (
                  <tr key={c._id} className="cursor-pointer" onClick={() => setModal({ cita: c, fecha: aFechaInput(c.fecha) })}>
                    <td className="whitespace-nowrap">{new Date(c.fecha).toLocaleDateString("es-ES")}</td>
                    <td className="whitespace-nowrap font-medium">{c.hora}</td>
                    <td className="font-medium">{c.aparatoDescripcion ?? "—"}</td>
                    <td className="text-slate-600">{c.clienteNombre ?? "—"}</td>
                    <td className="text-slate-500 max-w-[220px] truncate">
                      {c.motivo ?? "—"}
                      {c.presupuesto && (
                        <span className="ml-1.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 text-[0.625rem] font-bold px-1.5 py-0.5 align-middle">
                          Pto
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="text-xs" style={{ color: est?.color ?? "#64748b" }}>{est?.nombre ?? c.estado}</span>
                    </td>
                    <td className="text-right text-xs text-accent">Abrir</td>
                  </tr>
                );
              })}
              {citasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-8">
                    Sin resultados para «{q}».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
      <Calendario
        citas={citasFiltradas}
        etiquetaNueva="Nueva cita"
        onRango={(desde, hasta) => setRango({ desde, hasta })}
        onNueva={(fecha) => setModal({ fecha })}
        onAbrir={(cita) => setModal({ cita, fecha: aFechaInput(cita.fecha) })}
        onEstado={cambiarEstado}
      />
      )}

      {modal && (
        <CitaModalServicio
          cita={modal.cita ?? null}
          fechaInicial={modal.fecha}
          onCerrar={() => setModal(null)}
          onGuardada={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
    </>
  );
}
