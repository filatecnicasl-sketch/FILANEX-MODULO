import { useCallback, useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import Calendario, { aFechaInput } from "../../components/Calendario.jsx";
import CitaModal from "./CitaModal.jsx";
import RecepcionRapida from "./RecepcionRapida.jsx";
import { InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import { ESTADOS_CITA } from "./datos.js";

const NOMBRE_ESTADO = Object.fromEntries(ESTADOS_CITA.map((e) => [e.clave, e.nombre]));

// Badges de contexto de la cita: compañía de seguros / particular y cortesía.
function BadgesCita({ cita }) {
  return (
    <>
      {cita.aseguradoraNombre ? (
        <span
          title={`Va por compañía: ${cita.aseguradoraNombre}`}
          className="ml-1.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 text-[0.625rem] font-bold px-1.5 py-0.5 align-middle"
        >
          {cita.aseguradoraNombre}
        </span>
      ) : (
        <span
          title="Reparación de particular (sin compañía)"
          className="ml-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[0.625rem] font-bold px-1.5 py-0.5 align-middle"
        >
          Particular
        </span>
      )}
      {(cita.cortesia || cita.prestamoCortesia) && (
        <span
          title={`Coche de cortesía${cita.prestamoCortesia?.matricula ? `: ${cita.prestamoCortesia.matricula}` : cita.cortesiaMatricula ? `: ${cita.cortesiaMatricula}` : " (reservado)"}`}
          className="ml-1.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200 text-[0.625rem] font-bold px-1.5 py-0.5 align-middle"
        >
          V. cortesía {cita.prestamoCortesia?.matricula || cita.cortesiaMatricula || "(reservado)"}
        </span>
      )}
    </>
  );
}

export default function TallerAgendaPage() {
  const [rango, setRango] = useState(null); // { desde, hasta } visibles en el calendario
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { cita?, fecha, tipo? }
  const [recepcion, setRecepcion] = useState(null); // cita pendiente a recepcionar
  const [aviso, setAviso] = useState(null); // confirmación de recepción creada
  const [q, setQ] = useState("");
  const [pestana, setPestana] = useState("citas"); // "citas" | "peritaje"

  // Búsqueda por cualquier campo visible de la cita; cada pestaña muestra
  // solo su tipo (las de peritaje van aparte).
  const citasFiltradas = (citas ?? []).filter(
    (c) =>
      (pestana === "peritaje" ? c.tipo === "peritaje" : c.tipo !== "peritaje") &&
      coincideBusqueda(
        q,
        c.matricula,
        c.clienteNombre,
        c.telefono,
        c.motivo,
        c.notas,
        c.hora,
        new Date(c.fecha).toLocaleDateString("es-ES"),
        NOMBRE_ESTADO[c.estado],
        c.presupuesto ? "presupuesto" : "",
        c.aseguradoraNombre,
        c.numeroSiniestro,
        c.cortesia || c.prestamoCortesia ? "cortesia" : ""
      )
  );

  const cargar = useCallback(async () => {
    if (!rango) return;
    try {
      // Con texto de búsqueda se consultan todas las citas (la buscada puede
      // estar fuera del periodo visible); sin texto, solo el rango visible.
      const url = q.trim()
        ? "/api/taller/citas"
        : `/api/taller/citas?desde=${rango.desde}&hasta=${rango.hasta}`;
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
    await fetch(`/api/taller/citas/${cita._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    cargar();
  }

  return (
    <>
      <CabeceraPagina titulo="Citas del taller" descripcion="Citas de recepción y entrega de vehículos.">
        {pestana === "peritaje" && (
          <button
            onClick={() => setModal({ fecha: aFechaInput(new Date()), tipo: "peritaje" })}
            className="btn-primary"
          >
            Nueva cita peritaje
          </button>
        )}
      </CabeceraPagina>

      {/* Pestañas: agenda normal / citas de peritaje (viene el perito) */}
      <div className="flex gap-2 mb-4 no-print">
        {[
          ["citas", "Citas"],
          ["peritaje", "Citas peritaje"],
        ].map(([id, et]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPestana(id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              pestana === id
                ? "bg-accent text-white"
                : "bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700/50"
            }`}
          >
            {et}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {aviso && (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center justify-between gap-3">
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">
            ×
          </button>
        </div>
      )}

      <div className="mb-3 max-w-md no-print">
        <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por matrícula, cliente, teléfono, motivo…" />
      </div>

      {pestana === "peritaje" ? (
        // Citas de peritaje: el cliente deja el coche y viene el perito de
        // la compañía. Lista plana ordenada por fecha y hora.
        <div className="panel overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th className="whitespace-nowrap">Fecha</th>
                <th className="whitespace-nowrap">Hora</th>
                <th>Matrícula</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Compañía</th>
                <th>Siniestro</th>
                <th>Peritación</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {[...citasFiltradas]
                .sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || String(a.hora).localeCompare(String(b.hora)))
                .map((c) => {
                  const est = ESTADOS_CITA.find((e) => e.clave === c.estado);
                  return (
                    <tr key={c._id} className="cursor-pointer" onClick={() => setModal({ cita: c, fecha: aFechaInput(c.fecha), tipo: "peritaje" })}>
                      <td className="whitespace-nowrap">{new Date(c.fecha).toLocaleDateString("es-ES")}</td>
                      <td className="whitespace-nowrap font-medium">{c.hora}</td>
                      <td className="font-medium">{c.matricula ?? "—"}</td>
                      <td className="text-slate-600">{c.clienteNombre ?? "—"}</td>
                      <td className="text-slate-500 num">{c.telefono ?? "—"}</td>
                      <td className="text-slate-600">{c.aseguradoraNombre ?? "—"}</td>
                      <td className="text-slate-500 num">{c.numeroSiniestro ?? "—"}</td>
                      <td>
                        {c.adjuntos?.length ? (
                          <a
                            href={c.adjuntos[0].url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-semibold text-violet-600 hover:underline"
                            title={c.adjuntos[0].nombre || "Abrir la peritación"}
                          >
                            Ver{c.adjuntos.length > 1 ? ` (${c.adjuntos.length})` : ""}
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: est?.color ?? "#64748b" }}>{est?.nombre ?? c.estado}</span>
                      </td>
                      <td className="text-right text-xs whitespace-nowrap">
                        {!["realizada", "cancelada"].includes(c.estado) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRecepcion(c);
                            }}
                            className="font-semibold text-emerald-600 hover:text-emerald-800 hover:underline mr-2"
                          >
                            Recepcionar
                          </button>
                        )}
                        <span className="text-accent">Abrir</span>
                      </td>
                    </tr>
                  );
                })}
              {citasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-slate-500 py-8">
                    {q.trim() ? `Sin resultados para «${q}».` : "No hay citas de peritaje en este periodo."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : q.trim() ? (
        // Resultados de la búsqueda: lista plana de todas las citas que
        // coinciden, estén en el periodo visible o no.
        <div className="panel overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th className="whitespace-nowrap">Fecha</th>
                <th className="whitespace-nowrap">Hora</th>
                <th>Matrícula</th>
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
                    <td className="font-medium">{c.matricula ?? "—"}</td>
                    <td className="text-slate-600">{c.clienteNombre ?? "—"}</td>
                    <td className="text-slate-500 max-w-[220px] truncate">
                      {c.motivo ?? "—"}
                      {c.presupuesto && (
                        <span className="ml-1.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 text-[0.625rem] font-bold px-1.5 py-0.5 align-middle">
                          Pto
                        </span>
                      )}
                      <BadgesCita cita={c} />
                    </td>
                    <td>
                      <span className="text-xs" style={{ color: est?.color ?? "#64748b" }}>{est?.nombre ?? c.estado}</span>
                    </td>
                    <td className="text-right text-xs whitespace-nowrap">
                      {!["realizada", "cancelada"].includes(c.estado) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRecepcion(c);
                          }}
                          className="font-semibold text-emerald-600 hover:text-emerald-800 hover:underline mr-2"
                        >
                          Recepcionar
                        </button>
                      )}
                      <span className="text-accent">Abrir</span>
                    </td>
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
        onNueva={(fecha) => setModal({ fecha, tipo: "normal" })}
        onAbrir={(cita) => setModal({ cita, fecha: aFechaInput(cita.fecha), tipo: cita.tipo ?? "normal" })}
        onEstado={cambiarEstado}
      />
      )}

      {modal && (
        <CitaModal
          cita={modal.cita ?? null}
          fechaInicial={modal.fecha}
          tipoInicial={modal.tipo}
          onCerrar={() => setModal(null)}
          onGuardada={() => {
            setModal(null);
            cargar();
          }}
          onRecepcionar={(c) => {
            setModal(null);
            setRecepcion(c);
          }}
        />
      )}

      {recepcion && (
        <RecepcionRapida
          citaInicial={recepcion}
          onCerrar={() => setRecepcion(null)}
          onCreada={(datos) => {
            setRecepcion(null);
            cargar();
            const numero = datos?.orden?.numero ?? "";
            setAviso(
              `Recepción creada${numero ? ` (orden ${numero})` : ""}. La cita quedó realizada; sigue en Taller → Órdenes.`
            );
          }}
        />
      )}
    </>
  );
}
