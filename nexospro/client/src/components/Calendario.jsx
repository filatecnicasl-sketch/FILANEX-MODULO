import { useEffect, useMemo, useState } from "react";

// Calendario tradicional reutilizable (citas del taller y agenda general):
// tres vistas — AGENDA (lista por días), SEMANA (7 columnas) y MES
// (cuadrícula clásica) — con navegación, botón "Hoy" y alta tocando el día.
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const ESTADOS = [
  { clave: "pendiente", nombre: "Pendiente" },
  { clave: "confirmada", nombre: "Confirmada" },
  { clave: "realizada", nombre: "Realizada" },
  { clave: "cancelada", nombre: "Cancelada" },
];

const CHIP_ESTADO = {
  pendiente: "bg-amber-100 text-amber-800 border-amber-300",
  confirmada: "bg-sky-100 text-sky-800 border-sky-300",
  realizada: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelada: "bg-slate-100 text-slate-400 border-slate-200 line-through",
};

// "2026-08-15" en hora local (sin líos de zona horaria)
export const aFechaInput = (d) => {
  const f = d instanceof Date ? d : new Date(d);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};

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

function textoCita(c) {
  return c.matricula ?? c.clienteNombre ?? c.motivo ?? "—";
}

// "Sábado, 15 de agosto de 2026"
function tituloDia(d) {
  const t = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return t[0].toUpperCase() + t.slice(1);
}

function Chip({ cita, compacto, onClick }) {
  const tono = CHIP_ESTADO[cita.estado] ?? CHIP_ESTADO.pendiente;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(cita);
      }}
      title={`${cita.hora} · ${textoCita(cita)}${cita.motivo ? ` · ${cita.motivo}` : ""}`}
      className={`block w-full text-left rounded-md border px-1.5 py-0.5 truncate transition-opacity hover:opacity-75 ${
        cita.estado === "cancelada" ? "opacity-50" : ""
      } ${tono} ${compacto ? "text-[0.65625rem]" : "text-[0.71875rem]"}`}
    >
      <span className="font-bold num">{cita.hora}</span> {textoCita(cita)}
    </button>
  );
}

// Selector de estado en pastilla coloreada (vista agenda: cambio rápido).
function SelectorEstado({ cita, onEstado }) {
  const tono = CHIP_ESTADO[cita.estado] ?? CHIP_ESTADO.pendiente;
  return (
    <select
      value={cita.estado}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        onEstado?.(cita, e.target.value);
      }}
      className={`rounded-full border text-[0.71875rem] font-semibold pl-3 pr-7 py-1 cursor-pointer appearance-none bg-no-repeat ${tono}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23718196' stroke-width='1.6' fill='none' stroke-linecap='round'/></svg>\")",
        backgroundPosition: "right 10px center",
      }}
    >
      {ESTADOS.map((e) => (
        <option key={e.clave} value={e.clave}>{e.nombre}</option>
      ))}
    </select>
  );
}

export default function Calendario({ citas, onNueva, onAbrir, onRango, onEstado, etiquetaNueva = "Nueva cita" }) {
  const [vista, setVista] = useState("agenda"); // agenda | semana | mes
  const [ref, setRef] = useState(() => new Date());
  const hoyTxt = aFechaInput(new Date());

  // Rango visible y título según la vista activa.
  const { desde, hasta, titulo } = useMemo(() => {
    if (vista === "mes") {
      const primero = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const inicio = lunesDe(primero);
      const mes = MESES[ref.getMonth()];
      return {
        desde: inicio,
        hasta: sumarDias(inicio, 41),
        titulo: `${mes[0].toUpperCase()}${mes.slice(1)} de ${ref.getFullYear()}`,
      };
    }
    if (vista === "semana") {
      const inicio = lunesDe(ref);
      const fin = sumarDias(inicio, 6);
      const f = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
      return { desde: inicio, hasta: fin, titulo: `Semana del ${f(inicio)} al ${f(fin)}` };
    }
    // agenda: lista rodante de 45 días desde la fecha de referencia
    const inicio = new Date(ref);
    inicio.setHours(0, 0, 0, 0);
    const fin = sumarDias(inicio, 45);
    const f = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
    return { desde: inicio, hasta: fin, titulo: `Del ${f(inicio)} al ${f(fin)}` };
  }, [vista, ref]);

  // La página padre pide al servidor las citas del rango visible.
  useEffect(() => {
    onRango?.(aFechaInput(desde), aFechaInput(hasta));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta]);

  const porDia = useMemo(() => {
    const mapa = {};
    for (const c of citas ?? []) {
      const clave = aFechaInput(c.fecha);
      (mapa[clave] ??= []).push(c);
    }
    return mapa;
  }, [citas]);

  function mover(dir) {
    const d = new Date(ref);
    if (vista === "mes") d.setMonth(d.getMonth() + dir);
    else if (vista === "semana") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir * 30);
    setRef(d);
  }

  function irSemanaDe(dia) {
    setRef(dia);
    setVista("semana");
  }

  const claseToggle = (activa) =>
    `px-3.5 py-2 transition-colors ${
      activa ? "seg-activo" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
    }`;

  // Vista agenda: solo los días que tienen citas, en orden.
  const diasConCitas = useMemo(() => {
    if (vista !== "agenda") return [];
    const dias = [];
    for (let i = 0; i <= 45; i++) {
      const dia = sumarDias(desde, i);
      const txt = aFechaInput(dia);
      if (porDia[txt]?.length) dias.push({ dia, txt, lista: porDia[txt] });
    }
    return dias;
  }, [vista, desde, porDia]);

  return (
    <div>
      {/* Barra de herramientas del calendario */}
      <div className="no-print flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex rounded-lg overflow-hidden border border-slate-300 bg-white text-[0.78125rem] font-semibold">
          <button onClick={() => mover(-1)} className="px-3 py-2 text-slate-500 hover:bg-slate-100" title="Anterior">←</button>
          <button onClick={() => setRef(new Date())} className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 border-x border-slate-300">Hoy</button>
          <button onClick={() => mover(1)} className="px-3 py-2 text-slate-500 hover:bg-slate-100" title="Siguiente">→</button>
        </div>
        <h2 className="text-[1.0625rem] font-bold text-slate-800 mr-2">{titulo}</h2>
        <span className="flex-1" />
        <div className="inline-flex rounded-lg overflow-hidden border border-slate-300 bg-white text-[0.78125rem] font-semibold">
          <button onClick={() => setVista("agenda")} className={claseToggle(vista === "agenda")}>Agenda</button>
          <button onClick={() => setVista("semana")} className={claseToggle(vista === "semana")}>Semana</button>
          <button onClick={() => setVista("mes")} className={claseToggle(vista === "mes")}>Mes</button>
        </div>
        <button onClick={() => onNueva(hoyTxt)} className="btn-primary">+ {etiquetaNueva}</button>
      </div>

      {vista === "agenda" && (
        diasConCitas.length === 0 ? (
          <div className="panel px-6 py-10 text-center text-sm text-slate-400">
            No hay citas en este periodo. Toca un día del mes o pulsa «+ {etiquetaNueva}» para crear una.
          </div>
        ) : (
          <div className="space-y-5 max-w-4xl">
            {diasConCitas.map(({ dia, txt, lista }) => (
              <section key={txt}>
                <h3 className="flex items-center gap-2 text-[0.84375rem] font-bold text-slate-700 mb-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  {tituloDia(dia)}
                  {txt === hoyTxt && (
                    <span className="rounded-full bg-accent/10 text-accent text-[0.65625rem] font-bold px-2 py-0.5">HOY</span>
                  )}
                </h3>
                <div className="space-y-2">
                  {lista.map((c) => (
                    <button
                      key={c._id}
                      onClick={() => onAbrir(c)}
                      className={`panel w-full text-left px-4 py-3 flex items-center gap-3 sm:gap-4 hover:border-accent/50 transition-colors ${
                        c.estado === "cancelada" ? "opacity-55" : ""
                      }`}
                    >
                      <span className="num text-sm font-bold text-slate-700 w-12 shrink-0">{c.hora}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 truncate">
                          {c.matricula ?? c.clienteNombre ?? "—"}
                          {c.motivo && <span className="text-slate-400 font-normal"> · {c.motivo}</span>}
                          {c.presupuesto && (
                            <span
                              title="Cita que viene de un presupuesto"
                              className="ml-1.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 text-[0.625rem] font-bold px-1.5 py-0.5 align-middle"
                            >
                              Pto
                            </span>
                          )}
                        </span>
                        {(c.matricula && c.clienteNombre) || c.notas ? (
                          <span className="block text-xs text-slate-500 truncate mt-0.5">
                            {[c.matricula ? c.clienteNombre : null, c.notas].filter(Boolean).join(" · ")}
                          </span>
                        ) : null}
                      </span>
                      <SelectorEstado cita={c} onEstado={onEstado} />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      )}

      {vista === "mes" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          {/* Cabecera Lun–Dom */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
            {DIAS.map((d) => (
              <p key={d} className="py-2 text-center text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">
                <span className="hidden sm:inline">{d}</span>
                <span className="sm:hidden">{d[0]}</span>
              </p>
            ))}
          </div>
          {/* Cuadrícula de 6 semanas */}
          <div className="grid grid-cols-7 gap-px bg-slate-200">
            {Array.from({ length: 42 }, (_, i) => {
              const dia = sumarDias(desde, i);
              const txt = aFechaInput(dia);
              const delMes = dia.getMonth() === ref.getMonth();
              const esHoy = txt === hoyTxt;
              const lista = porDia[txt] ?? [];
              const visibles = lista.slice(0, 3);
              return (
                <div
                  key={txt}
                  onClick={() => onNueva(txt)}
                  className={`min-h-[74px] sm:min-h-[104px] p-1 sm:p-1.5 cursor-pointer transition-colors hover:bg-accent/5 ${
                    delMes ? "bg-white" : "bg-slate-50"
                  }`}
                  title="Nueva cita este día"
                >
                  <p className="flex justify-end px-0.5">
                    <span
                      className={`num text-[0.75rem] leading-6 w-6 text-center rounded-full font-semibold ${
                        esHoy
                          ? "bg-accent text-white"
                          : delMes
                            ? "text-slate-700"
                            : "text-slate-400"
                      }`}
                    >
                      {dia.getDate()}
                    </span>
                  </p>
                  <div className="space-y-0.5 mt-0.5">
                    {visibles.map((c) => (
                      <Chip key={c._id} cita={c} compacto onClick={onAbrir} />
                    ))}
                    {lista.length > 3 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          irSemanaDe(dia);
                        }}
                        className="block w-full text-left text-[0.65625rem] font-semibold text-accent hover:underline px-1"
                      >
                        +{lista.length - 3} más
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vista === "semana" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-7 min-w-[840px]">
            {Array.from({ length: 7 }, (_, i) => {
              const dia = sumarDias(desde, i);
              const txt = aFechaInput(dia);
              const esHoy = txt === hoyTxt;
              const lista = porDia[txt] ?? [];
              return (
                <div key={txt} className="border-l border-slate-200 first:border-l-0 flex flex-col min-h-[420px]">
                  <button
                    onClick={() => onNueva(txt)}
                    className={`px-2 py-2.5 text-center border-b border-slate-200 transition-colors hover:bg-accent/5 ${
                      esHoy ? "bg-accent/10" : "bg-slate-50"
                    }`}
                    title="Nueva cita este día"
                  >
                    <span className="block text-[0.65625rem] font-bold uppercase tracking-widest text-slate-500">
                      {DIAS[i]}
                    </span>
                    <span
                      className={`num inline-block mt-0.5 text-[1.0625rem] leading-8 w-8 rounded-full font-bold ${
                        esHoy ? "bg-accent text-white" : "text-slate-800"
                      }`}
                    >
                      {dia.getDate()}
                    </span>
                  </button>
                  <div className="p-1.5 space-y-1 flex-1">
                    {lista.map((c) => (
                      <Chip key={c._id} cita={c} onClick={onAbrir} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
