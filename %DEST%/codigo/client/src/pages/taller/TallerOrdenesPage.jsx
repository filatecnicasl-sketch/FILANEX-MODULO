import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { EstadoVacio, euros } from "../../components/ui.jsx";
import EditorLineas, { lineaVacia } from "../../components/EditorLineas.jsx";
import { enterComoTab } from "../../utils/enter-tab.js";
import { ESTADOS_OT, tonoEstado } from "./datos.js";
import RecepcionRapida from "./RecepcionRapida.jsx";
import { IconImprimir } from "../../components/icons.jsx";
import { imprimirDocumento } from "../../utils/imprimir.js";

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

// Desplegable de estado con aspecto de pill coloreada (referencia).
const CLASES_PILL_ESTADO = {
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  cyan: "bg-sky-100 text-sky-700 border-sky-200",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

// Vista kanban (referencia RO App /orders/board): una columna por estado,
// tarjetas arrastrables que cambian el estado de la orden al soltarse.
function TableroKanban({ ordenes, onMover, onLineas, onFacturar }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
      {ESTADOS_OT.map((col) => {
        const enColumna = ordenes.filter((o) => o.estado === col.clave);
        return (
          <div
            key={col.clave}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/orden-id");
              const o = ordenes.find((x) => x._id === id);
              if (o && o.estado !== col.clave) onMover(o, col.clave);
            }}
            className="rounded-xl bg-slate-100/80 border border-slate-200/70 p-2.5 min-h-[220px]"
          >
            <div className="flex items-center justify-between px-1 pb-2.5">
              <span
                className={`inline-block rounded-full border text-[11px] font-semibold px-3 py-1 ${
                  CLASES_PILL_ESTADO[col.tono] ?? CLASES_PILL_ESTADO.slate
                }`}
              >
                {col.nombre}
              </span>
              <span className="text-xs font-medium text-slate-400 num">{enColumna.length}</span>
            </div>
            <div className="space-y-2">
              {enColumna.map((o) => (
                <div
                  key={o._id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/orden-id", o._id)}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 cursor-grab active:cursor-grabbing hover:border-accent/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-800 num">{o.numero}</p>
                    <p className="num text-sm font-semibold text-slate-700">{euros(o.total)}</p>
                  </div>
                  <p className="num text-sm text-slate-600 mt-0.5">{o.matricula}</p>
                  <p className="text-xs text-slate-500 truncate">{o.clienteNombre ?? "—"}</p>
                  {o.trabajos?.length > 0 && (
                    <p className="text-[11px] text-slate-400 mt-1 truncate">{o.trabajos.join(", ")}</p>
                  )}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400 num">{fecha(o.fechaEntrada)}</span>
                    <span className="flex items-center gap-2">
                      <button
                        onClick={() => onLineas(o)}
                        className="text-[11px] text-accent hover:underline"
                      >
                        Líneas
                      </button>
                      {!o.factura && ["finalizado", "entregado"].includes(o.estado) && (
                        <button
                          onClick={() => onFacturar(o)}
                          className="text-[11px] text-amber-600 hover:underline"
                        >
                          Facturar
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              ))}
              {enColumna.length === 0 && (
                <p className="text-[11px] text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-lg">
                  Arrastra aquí
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TallerOrdenesPage() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [recepcion, setRecepcion] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [editandoLineas, setEditandoLineas] = useState(null); // orden abierta en el modal
  const [lineas, setLineas] = useState([]);
  const [vista, setVista] = useState("tablero"); // "tablero" (kanban) | "lista"

  async function cargar() {
    try {
      const r = await fetch("/api/taller/ordenes");
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setLista(datos);
    } catch (e) {
      setError(e.message);
      setLista([]);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function cambiarEstado(o, estado) {
    const r = await fetch(`/api/taller/ordenes/${o._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const datos = await r.json();
    if (r.ok) cargar();
    else alert(datos.error || "No se pudo cambiar el estado");
  }

  async function borrar(o) {
    if (!window.confirm(`¿Borrar la orden ${o.numero}?`)) return;
    const r = await fetch(`/api/taller/ordenes/${o._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  function abrirLineas(o) {
    setEditandoLineas(o);
    setLineas(o.lineas?.length > 0 ? o.lineas.map((l) => ({ ...l })) : [lineaVacia()]);
  }

  async function guardarLineas(e) {
    e.preventDefault();
    const r = await fetch(`/api/taller/ordenes/${editandoLineas._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineas: lineas.filter((l) => l.descripcion) }),
    });
    const datos = await r.json();
    if (r.ok) {
      setEditandoLineas(null);
      cargar();
    } else alert(datos.error || "No se pudieron guardar las líneas");
  }

  async function facturar(o) {
    if (!window.confirm(`¿Generar la factura (borrador) de ${o.numero} por ${euros(o.total)}?`)) return;
    const r = await fetch(`/api/taller/ordenes/${o._id}/facturar`, { method: "POST" });
    const datos = await r.json();
    if (r.ok) {
      cargar();
      alert("Factura creada en Ventas como borrador: emítela desde allí para enviarla a VeriFactu.");
    } else alert(datos.error || "No se pudo facturar");
  }

  const q = busqueda.trim().toLowerCase();
  const filtrada = (lista ?? []).filter(
    (o) =>
      !q ||
      o.numero.toLowerCase().includes(q) ||
      o.matricula.toLowerCase().includes(q) ||
      (o.clienteNombre ?? "").toLowerCase().includes(q)
  );

  return (
    <>
      <CabeceraPagina titulo="Órdenes de trabajo" descripcion="Chapa, pintura y mecánica.">
        <div className="inline-flex rounded-lg overflow-hidden border border-white/15 text-[12.5px] font-semibold mr-2">
          <button
            onClick={() => setVista("tablero")}
            className={`px-3.5 py-2 transition-colors ${vista === "tablero" ? "bg-white text-slate-800" : "text-slate-300 hover:text-white"}`}
          >
            Tablero
          </button>
          <button
            onClick={() => setVista("lista")}
            className={`px-3.5 py-2 transition-colors ${vista === "lista" ? "bg-white text-slate-800" : "text-slate-300 hover:text-white"}`}
          >
            Lista
          </button>
        </div>
        <button
          onClick={() => setRecepcion(true)}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
          </svg>
          Recepción rápida
        </button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      <div className="mb-4">
        <input
          className="input w-full max-w-sm"
          placeholder="Buscar por nº, matrícula o cliente…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {vista === "tablero" ? (
        lista && (
          <TableroKanban
            ordenes={filtrada}
            onMover={cambiarEstado}
            onLineas={abrirLineas}
            onFacturar={facturar}
          />
        )
      ) : (
      <div className="panel px-3.5 py-2">
        {!lista ? null : filtrada.length === 0 ? (
          <EstadoVacio
            titulo={q ? "Sin resultados" : "Sin órdenes de trabajo"}
            descripcion="La recepción rápida crea la orden y da de alta el vehículo en un paso."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Vehículo</th>
                  <th>Cliente</th>
                  <th>Trabajos</th>
                  <th>Entrada</th>
                  <th>Estado</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((o) => (
                  <tr key={o._id}>
                    <td className="font-bold text-white whitespace-nowrap num">{o.numero}</td>
                    <td className="text-slate-300 num">{o.matricula}</td>
                    <td className="text-slate-300">{o.clienteNombre ?? "—"}</td>
                    <td className="text-slate-400">{o.trabajos?.length > 0 ? o.trabajos.join(", ") : "—"}</td>
                    <td className="text-slate-400 whitespace-nowrap num">{fecha(o.fechaEntrada)}</td>
                    <td>
                      <select
                        value={o.estado}
                        onChange={(e) => cambiarEstado(o, e.target.value)}
                        className={`cursor-pointer appearance-none rounded-full border text-[11px] font-semibold pl-3 pr-7 py-1 bg-no-repeat focus:outline-none ${
                          CLASES_PILL_ESTADO[tonoEstado(o.estado)] ?? CLASES_PILL_ESTADO.slate
                        }`}
                        style={{
                          backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                          backgroundPosition: "right 9px center",
                        }}
                      >
                        {ESTADOS_OT.map((e2) => (
                          <option key={e2.clave} value={e2.clave}>{e2.nombre}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-right text-slate-300 whitespace-nowrap num">{euros(o.total)}</td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          imprimirDocumento({
                            tipo: "Orden de trabajo",
                            numero: o.numero,
                            fecha: o.fechaEntrada,
                            contraparte: { nombre: `${o.clienteNombre ?? ""} · Vehículo ${o.matricula}` },
                            lineas: o.lineas ?? [],
                            notas: o.trabajos?.length > 0 ? `Trabajos: ${o.trabajos.join(", ")}` : undefined,
                          })
                        }
                        title="Imprimir hoja de taller"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle mr-2"
                      >
                        <IconImprimir />
                      </button>
                      <button onClick={() => abrirLineas(o)} className="text-xs text-accent hover:underline mr-3">
                        Líneas
                      </button>
                      {o.factura ? (
                        <Link to="/ventas" className="text-xs text-emerald-300 hover:underline mr-3">
                          Facturada
                        </Link>
                      ) : (
                        ["finalizado", "entregado"].includes(o.estado) && (
                          <button onClick={() => facturar(o)} className="text-xs text-amber-300 hover:underline mr-3">
                            Facturar
                          </button>
                        )
                      )}
                      <button onClick={() => borrar(o)} className="text-xs text-rose-400 hover:underline">
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {recepcion && (
        <RecepcionRapida
          onCerrar={() => setRecepcion(false)}
          onCreada={() => {
            setRecepcion(false);
            cargar();
          }}
        />
      )}

      {editandoLineas && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setEditandoLineas(null)}
        >
          <div
            className="modal-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white mb-1">
              Líneas de {editandoLineas.numero} · {editandoLineas.matricula}
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Mano de obra y materiales que se facturarán al cliente.
            </p>
            <form onSubmit={guardarLineas} onKeyDown={enterComoTab} className="space-y-4">
              <EditorLineas lineas={lineas} setLineas={setLineas} />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditandoLineas(null)} className="btn-ghost">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">Guardar líneas</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
