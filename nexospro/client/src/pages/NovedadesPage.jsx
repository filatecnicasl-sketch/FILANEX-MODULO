import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { CAMBIOS } from "../data/novedades.js";
import { payloadToken } from "../lib/sesion.js";

const TIPOS = {
  nuevo: { etiqueta: "Nuevo", clases: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  mejora: { etiqueta: "Mejora", clases: "bg-sky-100 text-sky-700 border-sky-200" },
  correccion: { etiqueta: "Corrección", clases: "bg-amber-100 text-amber-700 border-amber-200" },
  seguridad: { etiqueta: "Seguridad", clases: "bg-red-100 text-red-700 border-red-200" },
};

function fechaTxt(iso) {
  return new Date(iso).toLocaleDateString("es-ES", {
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
  const [propuestas, setPropuestas] = useState(null);
  const [texto, setTexto] = useState("");
  const [capturas, setCapturas] = useState([]); // File[] con su URL de vista previa
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);
  const inputCapturasRef = useRef(null);
  const usuario = payloadToken()?.nombre ?? "";

  useEffect(() => {
    fetch("/api/propuestas")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No se pudieron cargar"))))
      .then(setPropuestas)
      .catch((e) => setError(e.message));
  }, []);

  function anadirCapturas(e) {
    const nuevas = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!nuevas.length) return;
    setCapturas((cs) =>
      [...cs, ...nuevas.map((archivo) => ({ archivo, vista: URL.createObjectURL(archivo) }))].slice(0, 4)
    );
  }

  function quitarCaptura(i) {
    setCapturas((cs) => {
      URL.revokeObjectURL(cs[i]?.vista);
      return cs.filter((_, j) => j !== i);
    });
  }

  async function enviar(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setError(null);
    setAviso(null);
    try {
      const fd = new FormData();
      fd.append("texto", texto);
      capturas.forEach((c) => fd.append("capturas", c.archivo));
      const r = await fetch("/api/propuestas", { method: "POST", body: fd });
      if (!r.ok) throw new Error((await r.json()).error || "No se pudo enviar");
      const creada = await r.json();
      setPropuestas((ps) => [creada, ...(ps ?? [])]);
      setTexto("");
      capturas.forEach((c) => URL.revokeObjectURL(c.vista));
      setCapturas([]);
      setAviso("Propuesta enviada. Gracias por ayudarnos a mejorar.");
    } catch (e2) {
      setError(e2.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <CabeceraPagina
        titulo="Novedades del programa"
        descripcion="Registro de mejoras y cambios, y buzón de propuestas de los usuarios."
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
            Propuestas{propuestas ? ` (${propuestas.length})` : ""}
          </button>
        </div>

        {vista === "cambios" && (
          <div className="space-y-3">
            {CAMBIOS.map((c, i) => {
              const tipo = TIPOS[c.tipo] ?? TIPOS.mejora;
              return (
                <div key={i} className="panel p-4 flex gap-4">
                  <div className="shrink-0 w-28 text-xs text-slate-500 pt-0.5">
                    {fechaTxt(`${c.fecha}T12:00:00`)}
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
          <div className="space-y-4">
            <form onSubmit={enviar} className="panel p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-slate-800">¿Qué te gustaría que hiciera el programa?</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Escribe tu idea o mejora. La leemos y la tenemos en cuenta para las próximas versiones.
                </p>
              </div>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Ej.: Me gustaría poder exportar el listado de clientes a Excel…"
                className="input w-full"
              />
              <input
                ref={inputCapturasRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={anadirCapturas}
              />
              {capturas.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {capturas.map((c, i) => (
                    <span key={c.vista} className="relative inline-block">
                      <img
                        src={c.vista}
                        alt={`Captura ${i + 1}`}
                        className="h-16 w-16 object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => quitarCaptura(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-700 text-white text-xs leading-none hover:bg-red-500"
                        title="Quitar captura"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
              {aviso && <p className="text-sm text-emerald-600">{aviso}</p>}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => inputCapturasRef.current?.click()} className="btn-ghost !py-1.5 text-sm">
                    Adjuntar captura{capturas.length > 0 ? ` (${capturas.length}/4)` : ""}
                  </button>
                  <p className="text-xs text-slate-500">
                    Se envía como <span className="font-semibold text-slate-600">{usuario || "usuario actual"}</span>
                  </p>
                </div>
                <button type="submit" disabled={enviando || !texto.trim()} className="btn-primary">
                  {enviando ? "Enviando…" : "Enviar propuesta"}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {propuestas === null && !error && (
                <p className="text-sm text-slate-500">Cargando propuestas…</p>
              )}
              {propuestas?.length === 0 && (
                <p className="text-sm text-slate-500">
                  Todavía no hay propuestas. Sé el primero en escribir una.
                </p>
              )}
              {propuestas?.map((p) => (
                <div key={p._id} className="panel p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">
                      {p.usuarioNombre || p.usuarioEmail || "Usuario"}
                    </span>
                    <span className="text-xs text-slate-500">{fechaTxt(p.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-line">{p.texto}</p>
                  {p.adjuntos?.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {p.adjuntos.map((a, j) => (
                        <a key={a.url} href={a.url} target="_blank" rel="noreferrer" title={a.nombre || "Ver captura"}>
                          <img
                            src={a.url}
                            alt={a.nombre || `Captura ${j + 1}`}
                            className="h-16 w-16 object-cover rounded-lg border border-slate-200 hover:border-accent hover:opacity-80 transition-all"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
