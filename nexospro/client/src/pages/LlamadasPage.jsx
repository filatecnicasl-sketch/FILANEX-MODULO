import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Badge } from "../components/ui.jsx";
import { IconBorrar, IconTelefono } from "../components/icons.jsx";

const TONO_ESTADO = {
  sonando: "amber",
  "en-curso": "cyan",
  atendida: "green",
  perdida: "red",
};

const NOMBRE_ESTADO = {
  sonando: "Sonando",
  "en-curso": "En curso",
  atendida: "Atendida",
  perdida: "Perdida",
};

function duracion(seg) {
  if (!seg) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fechaHora(iso) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) +
    " " +
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  );
}

const Flecha = ({ entrante }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={entrante ? "text-emerald-500" : "text-sky-500"}
    aria-hidden="true"
  >
    {entrante ? <path d="M17 7 7 17M7 8v9h9" /> : <path d="M7 17 17 7M8 7h9v9" />}
  </svg>
);

export default function LlamadasPage() {
  const [llamadas, setLlamadas] = useState([]);
  const [q, setQ] = useState("");
  const [direccion, setDireccion] = useState("");
  const [estado, setEstado] = useState("");
  const [error, setError] = useState(null);

  async function cargar() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (direccion) params.set("direccion", direccion);
    if (estado) params.set("estado", estado);
    const r = await fetch(`/api/telefonia/llamadas?${params}`);
    if (r.ok) setLlamadas(await r.json());
    else setError("No se pudieron cargar las llamadas");
  }

  useEffect(() => {
    cargar();
    // Se recarga solo cuando llega un evento de llamada (SSE).
    const fuente = new EventSource("/api/telefonia/stream");
    fuente.onmessage = () => cargar();
    return () => fuente.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, direccion, estado]);

  async function simular() {
    await fetch("/api/telefonia/simular", { method: "POST" });
  }

  async function editarNota(l) {
    const notas = window.prompt(`Notas de la llamada ${l.numero}`, l.notas ?? "");
    if (notas === null) return;
    const r = await fetch(`/api/telefonia/llamadas/${l._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notas }),
    });
    if (r.ok) await cargar();
  }

  async function borrar(l) {
    if (!window.confirm(`¿Eliminar la llamada ${l.numero} del historial?`)) return;
    const r = await fetch(`/api/telefonia/llamadas/${l._id}`, { method: "DELETE" });
    if (r.ok) await cargar();
  }

  const contacto = (l) => l.cliente?.nombre ?? l.proveedor?.nombre ?? null;

  return (
    <>
      <CabeceraPagina
        titulo="Llamadas"
        descripcion="Historial de la centralita IP: llamadas entrantes y salientes."
      >
        <button
          onClick={simular}
          title="Simula una llamada entrante para probar el aviso en pantalla"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 px-3.5 py-2 text-[0.78125rem] font-semibold hover:bg-emerald-500/25 transition-colors"
        >
          <IconTelefono size={15} />
          Simular llamada
        </button>
      </CabeceraPagina>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por número…"
          className="input w-56"
        />
        <select value={direccion} onChange={(e) => setDireccion(e.target.value)} className="input">
          <option value="">Entrantes y salientes</option>
          <option value="entrante">Entrantes</option>
          <option value="saliente">Salientes</option>
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input">
          <option value="">Todos los estados</option>
          <option value="atendida">Atendidas</option>
          <option value="perdida">Perdidas</option>
          <option value="en-curso">En curso</option>
          <option value="sonando">Sonando</option>
        </select>
      </div>

      <div className="panel overflow-x-auto">
        {llamadas.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Aún no hay llamadas. Cuando la centralita esté conectada aparecerán aquí
            automáticamente. Mientras tanto, usa «Simular llamada» para ver cómo funciona.
          </div>
        ) : (
          <table className="tabla text-sm">
            <thead>
              <tr className="text-left text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-3.5 py-3">Fecha</th>
                <th className="px-3.5 py-3">Número</th>
                <th className="px-3.5 py-3">Contacto</th>
                <th className="px-3.5 py-3">Tipo</th>
                <th className="px-3.5 py-3">Estado</th>
                <th className="px-3.5 py-3 text-right">Duración</th>
                <th className="px-3.5 py-3">Notas</th>
                <th className="px-3.5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {llamadas.map((l) => (
                <tr key={l._id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-3.5 py-2.5 text-slate-400 whitespace-nowrap num">{fechaHora(l.inicio)}</td>
                  <td className="px-3.5 py-2.5 font-medium text-white whitespace-nowrap num">{l.numero}</td>
                  <td className="px-3.5 py-2.5 text-slate-300 max-w-[200px]">
                    <span className="block truncate">
                      {contacto(l) ?? <span className="text-slate-500 italic">Desconocido</span>}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                      <Flecha entrante={l.direccion === "entrante"} />
                      {l.direccion === "entrante" ? "Entrante" : "Saliente"}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <Badge tono={TONO_ESTADO[l.estado]}>{NOMBRE_ESTADO[l.estado] ?? l.estado}</Badge>
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-slate-400 num">{duracion(l.duracionSeg)}</td>
                  <td
                    className="px-3.5 py-2.5 text-slate-400 text-xs max-w-[180px] cursor-pointer hover:text-accent"
                    title={l.notas ? `${l.notas} (clic para editar)` : "Clic para añadir notas"}
                    onClick={() => editarNota(l)}
                  >
                    <span className="block truncate">{l.notas || <span className="text-slate-600">+ nota</span>}</span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`tel:${l.numero}`}
                        title="Llamar a este número"
                        className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                      >
                        <IconTelefono size={14} />
                      </a>
                      <button
                        onClick={() => borrar(l)}
                        title="Eliminar del historial"
                        className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <IconBorrar />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel p-4 mt-4 text-xs text-slate-500 leading-relaxed">
        <span className="font-semibold text-slate-400">Conexión con la centralita (handSIP):</span>{" "}
        el proveedor debe enviar los eventos de llamada a{" "}
        <code className="text-accent bg-accent/10 rounded px-1.5 py-0.5">
          POST {window.location.origin}/api/telefonia/evento?token=filanex-telefonia
        </code>{" "}
        con los campos <code>numero</code>, <code>direccion</code> (entrante/saliente) y{" "}
        <code>estado</code> (sonando/en-curso/colgada).
      </div>
    </>
  );
}
