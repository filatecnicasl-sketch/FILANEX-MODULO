import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { EstadoVacio, euros } from "../../components/ui.jsx";
import { ESTADOS_OT, tonoEstado } from "./datos.js";
import RecepcionRapida from "./RecepcionRapida.jsx";
import FormOrden from "./FormOrden.jsx";
import MenuImprimirOrden from "../../components/MenuImprimirOrden.jsx";
import ModalRecepcion from "./ModalRecepcion.jsx";

// Icono de cámara para la recepción digital (fotos del estado + firma).
function IconCamara() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

// Nº del presupuesto vinculado a la orden (píldora violeta).
function BadgePresupuesto({ numero }) {
  if (!numero) return null;
  return (
    <span
      title={`Nace del presupuesto ${numero}`}
      className="inline-block rounded-full border bg-violet-100 text-violet-700 border-violet-200 text-[0.625rem] font-semibold px-1.5 py-px ml-1.5 align-middle"
    >
      {numero}
    </span>
  );
}

// Desplegable de estado con aspecto de pill coloreada (referencia).
const CLASES_PILL_ESTADO = {
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  cyan: "bg-sky-100 text-sky-700 border-sky-200",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

// Vista kanban (referencia RO App /orders/board): una columna por estado,
// tarjetas arrastrables que cambian el estado de la orden al soltarse.
function TableroKanban({ ordenes, onMover, onEditar, onFacturar, onRecepcion }) {
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
                className={`inline-block rounded-full border text-[0.6875rem] font-semibold px-3 py-1 ${
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
                    <p className="font-bold text-slate-800 num">
                      {o.numero}
                      <BadgePresupuesto numero={o.presupuestoNumero} />
                    </p>
                    <p className="num text-sm font-semibold text-slate-700">{euros(o.total)}</p>
                  </div>
                  <p className="num text-sm text-slate-600 mt-0.5">{o.matricula}</p>
                  <p className="text-xs text-slate-500 truncate">{o.clienteNombre ?? "—"}</p>
                  {o.trabajos?.length > 0 && (
                    <p className="text-[0.6875rem] text-slate-400 mt-1 truncate">{o.trabajos.join(", ")}</p>
                  )}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                    <span className="text-[0.6875rem] text-slate-400 num">{fecha(o.fechaEntrada)}</span>
                    <span className="flex items-center gap-2">
                      <MenuImprimirOrden orden={o} pequeno />
                      <button
                        onClick={() => onRecepcion(o)}
                        title="Recepción digital (fotos + firma)"
                        className={`inline-flex items-center transition-colors ${
                          o.recepcionDigital?.firma?.fecha
                            ? "text-emerald-500 hover:text-emerald-600"
                            : "text-slate-400 hover:text-accent"
                        }`}
                      >
                        <IconCamara />
                      </button>
                      <button
                        onClick={() => onEditar(o)}
                        className="text-[0.6875rem] text-accent hover:underline"
                      >
                        Editar
                      </button>
                      {!o.factura && ["finalizado", "entregado"].includes(o.estado) && (
                        <button
                          onClick={() => onFacturar(o)}
                          className="text-[0.6875rem] text-amber-600 hover:underline"
                        >
                          Facturar
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              ))}
              {enColumna.length === 0 && (
                <p className="text-[0.6875rem] text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-lg">
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
  // undefined = cerrado · null = orden nueva · objeto = edición
  const [ordenForm, setOrdenForm] = useState(undefined);
  const [recepcionOT, setRecepcionOT] = useState(undefined); // orden en recepción digital
  const [recepcionNueva, setRecepcionNueva] = useState(false); // recién creada (flujo recepción rápida)
  const [vista, setVista] = useState("tablero"); // "tablero" (kanban) | "lista"
  const [params, setParams] = useSearchParams();

  // Abre directamente una orden cuando llega ?abrir=<id> (p. ej. desde el historial del vehículo).
  useEffect(() => {
    const id = params.get("abrir");
    if (!id || !lista) return;
    const o = lista.find((x) => x._id === id);
    if (o) {
      setOrdenForm(o);
      params.delete("abrir");
      setParams(params, { replace: true });
    }
  }, [lista, params, setParams]);

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

  async function facturar(o) {
    const aseg = o.facturarA === "aseguradora" && o.aseguradora?.nombre;
    const texto = aseg
      ? `¿Generar la factura (borrador) de ${o.numero} a nombre de ${o.aseguradora.nombre}, con sus descuentos negociados aplicados?`
      : `¿Generar la factura (borrador) de ${o.numero} por ${euros(o.total)}?`;
    if (!window.confirm(texto)) return;
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
        <div className="inline-flex rounded-lg overflow-hidden border border-slate-300 bg-white text-[0.78125rem] font-semibold mr-2">
          <button
            onClick={() => setVista("tablero")}
            className={`px-3.5 py-2 transition-colors ${vista === "tablero" ? "seg-activo" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
          >
            Tablero
          </button>
          <button
            onClick={() => setVista("lista")}
            className={`px-3.5 py-2 transition-colors ${vista === "lista" ? "seg-activo" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
          >
            Lista
          </button>
        </div>
        <button onClick={() => setOrdenForm(null)} className="btn-primary mr-2">
          + Nueva orden
        </button>
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
            onEditar={setOrdenForm}
            onFacturar={facturar}
            onRecepcion={setRecepcionOT}
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
                    <td className="font-bold text-white whitespace-nowrap num">
                      {o.numero}
                      <BadgePresupuesto numero={o.presupuestoNumero} />
                    </td>
                    <td className="text-slate-300 num">{o.matricula}</td>
                    <td className="text-slate-300">
                      {o.clienteNombre ?? "—"}
                      {o.aseguradora?.nombre && (
                        <p className="text-[0.6875rem] text-amber-300/90 truncate max-w-[160px]" title={`Siniestro${o.numeroSiniestro ? ` ${o.numeroSiniestro}` : ""}`}>
                          {o.facturarA === "aseguradora" ? "→ " : ""}{o.aseguradora.nombre}
                        </p>
                      )}
                    </td>
                    <td className="text-slate-400">{o.trabajos?.length > 0 ? o.trabajos.join(", ") : "—"}</td>
                    <td className="text-slate-400 whitespace-nowrap num">{fecha(o.fechaEntrada)}</td>
                    <td>
                      <select
                        value={o.estado}
                        onChange={(e) => cambiarEstado(o, e.target.value)}
                        className={`cursor-pointer appearance-none rounded-full border text-[0.6875rem] font-semibold pl-3 pr-7 py-1 bg-no-repeat focus:outline-none ${
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
                      <MenuImprimirOrden orden={o} />
                      <button
                        onClick={() => setRecepcionOT(o)}
                        title="Recepción digital (fotos + firma)"
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors align-middle mx-1 ${
                          o.recepcionDigital?.firma?.fecha
                            ? "text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                            : "text-slate-400 hover:text-accent hover:bg-accent/10"
                        }`}
                      >
                        <IconCamara />
                      </button>
                      <button onClick={() => setOrdenForm(o)} className="text-xs text-accent hover:underline mr-3 ml-1">
                        Editar
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
          onCreada={(datos) => {
            setRecepcion(false);
            cargar();
            // Al terminar el alta se abre la recepción digital de la nueva OT
            // para fotos del estado, firma del cliente e impresión de la hoja.
            if (datos?.orden) {
              setRecepcionNueva(true);
              setRecepcionOT(datos.orden);
            }
          }}
        />
      )}

      {ordenForm !== undefined && (
        <FormOrden
          orden={ordenForm}
          onCerrar={() => setOrdenForm(undefined)}
          onGuardada={() => {
            setOrdenForm(undefined);
            cargar();
          }}
        />
      )}

      {recepcionOT !== undefined && (
        <ModalRecepcion
          orden={recepcionOT}
          recienCreada={recepcionNueva}
          onCerrar={() => {
            setRecepcionOT(undefined);
            setRecepcionNueva(false);
          }}
          onGuardada={cargar}
        />
      )}
    </>
  );
}
