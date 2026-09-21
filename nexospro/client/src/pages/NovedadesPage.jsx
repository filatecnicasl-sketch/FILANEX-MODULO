import { useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { CAMBIOS, PROPUESTAS } from "../data/novedades.js";

const TIPOS = {
  nuevo: { etiqueta: "Nuevo", clases: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  mejora: { etiqueta: "Mejora", clases: "bg-sky-100 text-sky-700 border-sky-200" },
  correccion: { etiqueta: "Corrección", clases: "bg-amber-100 text-amber-700 border-amber-200" },
  seguridad: { etiqueta: "Seguridad", clases: "bg-red-100 text-red-700 border-red-200" },
};

const ESTADOS = {
  estudio: { etiqueta: "En estudio", clases: "bg-slate-100 text-slate-600 border-slate-200" },
  programada: { etiqueta: "Programada", clases: "bg-sky-100 text-sky-700 border-sky-200" },
  cliente: { etiqueta: "Pendiente del cliente", clases: "bg-violet-100 text-violet-700 border-violet-200" },
};

function fechaTxt(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Chip({ texto, clases }) {
  return (
    <span className={`shrink-0 text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full border ${clases}`}>
      {texto}
    </span>
  );
}

export default function NovedadesPage() {
  const [vista, setVista] = useState("cambios");

  return (
    <>
      <CabeceraPagina
        titulo="Novedades del programa"
        descripcion="Registro de mejoras y cambios, y propuestas pendientes de estudio."
      />

      <div className="max-w-4xl space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setVista("cambios")}
            className={vista === "cambios" ? "btn-primary !py-1.5 text-sm" : "btn-ghost !py-1.5 text-sm"}
          >
            Cambios realizados ({CAMBIOS.length})
          </button>
          <button
            onClick={() => setVista("propuestas")}
            className={vista === "propuestas" ? "btn-primary !py-1.5 text-sm" : "btn-ghost !py-1.5 text-sm"}
          >
            Propuestas para estudiar ({PROPUESTAS.length})
          </button>
        </div>

        {vista === "cambios" && (
          <div className="space-y-3">
            {CAMBIOS.map((c, i) => {
              const tipo = TIPOS[c.tipo] ?? TIPOS.mejora;
              return (
                <div key={i} className="panel p-4 flex gap-4">
                  <div className="shrink-0 w-28 text-xs text-slate-500 pt-0.5">
                    {fechaTxt(c.fecha)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Chip texto={tipo.etiqueta} clases={tipo.clases} />
                      <h3 className="font-semibold text-slate-800">{c.titulo}</h3>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{c.detalle}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {vista === "propuestas" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Ideas recogidas para mejorar el programa. Las marcadas como «Programada» tienen fecha
              o compromiso; las demás se estudian y se priorizan.
            </p>
            {PROPUESTAS.map((p, i) => {
              const estado = ESTADOS[p.estado] ?? ESTADOS.estudio;
              return (
                <div key={i} className="panel p-4 flex gap-4">
                  <div className="shrink-0 w-28 text-xs text-slate-500 pt-0.5">
                    {fechaTxt(p.fecha)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Chip texto={estado.etiqueta} clases={estado.clases} />
                      <h3 className="font-semibold text-slate-800">{p.titulo}</h3>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{p.detalle}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
