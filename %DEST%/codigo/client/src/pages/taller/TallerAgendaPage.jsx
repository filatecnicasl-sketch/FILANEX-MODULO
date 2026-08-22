import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Badge } from "../../components/ui.jsx";
import { nombreEstadoCita, tonoEstadoCita, aFechaInput } from "./datos.js";
import CitaModal from "./CitaModal.jsx";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function lunesDe(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function sumarDias(fecha, n) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + n);
  return d;
}

export default function TallerAgendaPage() {
  const [inicio, setInicio] = useState(() => lunesDe(new Date()));
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { cita?, fecha }

  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i));
  const hoyTxt = aFechaInput(new Date());

  async function cargar() {
    try {
      const desde = aFechaInput(inicio);
      const hasta = aFechaInput(sumarDias(inicio, 6));
      const r = await fetch(`/api/taller/citas?desde=${desde}&hasta=${hasta}`);
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar la agenda");
      setCitas(datos);
    } catch (e) {
      setError(e.message);
      setCitas([]);
    }
  }

  useEffect(() => {
    cargar();
  }, [inicio]);

  const citasPorDia = (dia) =>
    (citas ?? []).filter((c) => aFechaInput(c.fecha) === aFechaInput(dia));

  const tituloSemana = `Semana del ${dias[0].toLocaleDateString("es-ES", { day: "numeric", month: "long" })} al ${dias[6].toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`;

  return (
    <>
      <CabeceraPagina titulo="Agenda del taller" descripcion={tituloSemana}>
        <div className="flex items-center gap-2">
          <button onClick={() => setInicio(sumarDias(inicio, -7))} className="btn-ghost">←</button>
          <button onClick={() => setInicio(lunesDe(new Date()))} className="btn-ghost">Hoy</button>
          <button onClick={() => setInicio(sumarDias(inicio, 7))} className="btn-ghost">→</button>
          <button
            onClick={() => setModal({ fecha: hoyTxt })}
            className="btn-primary"
          >
            Nueva cita
          </button>
        </div>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      <div className="grid grid-cols-7 gap-2">
        {dias.map((dia, i) => {
          const txt = aFechaInput(dia);
          const esHoy = txt === hoyTxt;
          return (
            <div
              key={txt}
              className={`panel min-h-64 p-2.5 flex flex-col ${esHoy ? "ring-1 ring-accent/40" : ""}`}
            >
              <button
                onClick={() => setModal({ fecha: txt })}
                className={`text-left px-1.5 pb-2 mb-2 border-b border-white/[0.07] group ${
                  esHoy ? "text-accent" : "text-slate-400"
                }`}
                title="Nueva cita este día"
              >
                <span className="block text-[10px] font-bold uppercase tracking-widest">{DIAS[i]}</span>
                <span className={`text-lg font-extrabold ${esHoy ? "text-accent" : "text-white group-hover:text-accent"}`}>
                  {dia.getDate()}
                </span>
              </button>
              <div className="space-y-1.5 flex-1">
                {citasPorDia(dia).map((c) => (
                  <button
                    key={c._id}
                    onClick={() => setModal({ cita: c, fecha: txt })}
                    className={`w-full text-left rounded-lg border border-white/[0.07] px-2 py-1.5 hover:border-accent/40 transition ${
                      c.estado === "cancelada" ? "opacity-40" : "bg-white/[0.03]"
                    }`}
                  >
                    <p className="text-xs font-bold text-white">
                      {c.hora}
                      {c.matricula ? <span className="text-slate-400 font-medium"> · {c.matricula}</span> : null}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {c.clienteNombre ?? c.motivo ?? "—"}
                    </p>
                    {c.clienteNombre && c.motivo && (
                      <p className="text-[11px] text-slate-500 truncate">{c.motivo}</p>
                    )}
                    <div className="mt-1">
                      <Badge tono={tonoEstadoCita(c.estado)}>{nombreEstadoCita(c.estado)}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <CitaModal
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
