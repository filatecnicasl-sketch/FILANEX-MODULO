import { useCallback, useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { ESTADOS_OT } from "./datos.js";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const aFechaInput = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function lunesDe(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const sumarDias = (f, n) => {
  const d = new Date(f);
  d.setDate(d.getDate() + n);
  return d;
};

const TONO_ESTADO = {
  recepcion: "border-amber-300 bg-amber-50 text-amber-800",
  en_curso: "border-sky-300 bg-sky-50 text-sky-800",
  finalizado: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

const nombreEstado = (clave) => ESTADOS_OT.find((e) => e.clave === clave)?.nombre ?? clave;

// Planning semanal del taller: qué vehículos hay que entregar cada día y
// qué coches de cortesía están fuera (ocupación).
export default function PlanningPage() {
  const [inicio, setInicio] = useState(() => lunesDe(new Date()));
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const desde = aFechaInput(inicio);
      const hasta = aFechaInput(sumarDias(inicio, 6));
      const r = await fetch(`/api/taller/planning?desde=${desde}&hasta=${hasta}`);
      const datos2 = await r.json();
      if (!r.ok) throw new Error(datos2.error || "Error al cargar el planning");
      setDatos(datos2);
    } catch (e) {
      setError(e.message);
      setDatos(null);
    }
  }, [inicio]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function mover(dir) {
    setInicio((d) => sumarDias(d, dir * 7));
  }

  const hoyTxt = aFechaInput(new Date());
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i));

  const ordenesDel = (diaTxt) => (datos?.ordenes ?? []).filter((o) => aFechaInput(new Date(o.dia)) === diaTxt);

  const prestamosDel = (dia) => {
    const fin = new Date(dia);
    fin.setHours(23, 59, 59, 999);
    return (datos?.prestamos ?? []).filter(
      (p) => new Date(p.fechaSalida) <= fin && new Date(p.fechaFinEfectiva) >= dia
    );
  };

  const finSemana = sumarDias(inicio, 6);
  const f = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "long" });

  return (
    <>
      <CabeceraPagina
        titulo="Planning del taller"
        descripcion="Entregas previstas de la semana y ocupación de los coches de cortesía."
      />

      <div className="no-print flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex rounded-lg overflow-hidden border border-slate-300 bg-white text-[0.78125rem] font-semibold">
          <button onClick={() => mover(-1)} className="px-3 py-2 text-slate-500 hover:bg-slate-100" title="Semana anterior">←</button>
          <button onClick={() => setInicio(lunesDe(new Date()))} className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 border-x border-slate-300">Hoy</button>
          <button onClick={() => mover(1)} className="px-3 py-2 text-slate-500 hover:bg-slate-100" title="Semana siguiente">→</button>
        </div>
        <h2 className="text-[1.0625rem] font-bold text-slate-800">{`Semana del ${f(inicio)} al ${f(finSemana)}`}</h2>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 min-w-[980px]">
          {dias.map((dia, i) => {
            const txt = aFechaInput(dia);
            const esHoy = txt === hoyTxt;
            const ots = ordenesDel(txt);
            const prestamos = prestamosDel(dia);
            return (
              <div key={txt} className="border-l border-slate-200 first:border-l-0 flex flex-col min-h-[380px]">
                <div className={`px-2 py-2.5 text-center border-b border-slate-200 ${esHoy ? "bg-accent/10" : "bg-slate-50"}`}>
                  <span className="block text-[0.65625rem] font-bold uppercase tracking-widest text-slate-500">{DIAS[i]}</span>
                  <span className={`num inline-block mt-0.5 text-[1.0625rem] leading-8 w-8 rounded-full font-bold ${esHoy ? "bg-accent text-white" : "text-slate-800"}`}>
                    {dia.getDate()}
                  </span>
                </div>

                <div className="p-1.5 space-y-1.5 flex-1">
                  {ots.map((o) => (
                    <div
                      key={o._id}
                      className={`rounded-lg border px-2 py-1.5 text-[0.71875rem] leading-snug ${TONO_ESTADO[o.estado] ?? TONO_ESTADO.recepcion}`}
                      title={`${nombreEstado(o.estado)} · ${o.clienteNombre ?? ""}${o.trabajos?.length ? ` · ${o.trabajos.join(", ")}` : ""}`}
                    >
                      <p className="flex items-center justify-between gap-1">
                        <span className="font-bold num">{o.matricula}</span>
                        <span className="num text-[0.625rem] opacity-70">{o.numero}</span>
                      </p>
                      <p className="truncate opacity-80">{o.clienteNombre ?? "—"}</p>
                      {o.trabajos?.length > 0 && <p className="truncate text-[0.625rem] opacity-60">{o.trabajos.join(", ")}</p>}
                      <p className="text-[0.625rem] font-semibold mt-0.5 uppercase tracking-wide opacity-70">
                        {o.porPromesa ? "Entrega prometida" : "Entrada"}
                      </p>
                    </div>
                  ))}
                  {ots.length === 0 && prestamos.length === 0 && (
                    <p className="text-center text-[0.65625rem] text-slate-300 pt-3">—</p>
                  )}
                </div>

                {/* Ocupación de cortesía al pie del día */}
                {prestamos.length > 0 && (
                  <div className="border-t border-dashed border-violet-300 bg-violet-50/60 p-1.5 space-y-1">
                    {prestamos.map((p) => (
                      <p
                        key={p._id}
                        className="rounded border border-violet-300 bg-violet-100 text-violet-800 px-1.5 py-0.5 text-[0.65625rem] font-semibold truncate"
                        title={`Cortesía ${p.vehiculo?.matricula ?? ""} → ${p.clienteNombre ?? p.matricula ?? ""} · prevista ${new Date(p.fechaFinEfectiva).toLocaleDateString("es-ES")}`}
                      >
                        🚗 {p.vehiculo?.matricula ?? "Cortesía"} → {p.clienteNombre ?? p.matricula ?? "—"}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-4 mt-3 text-[0.6875rem] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-amber-300 bg-amber-50 inline-block" /> Recepción</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-sky-300 bg-sky-50 inline-block" /> En curso</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-emerald-300 bg-emerald-50 inline-block" /> Finalizado</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-violet-300 bg-violet-100 inline-block" /> Coche de cortesía fuera</span>
      </div>
    </>
  );
}
