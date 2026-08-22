import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import BuscadorEntidad from "../../components/BuscadorEntidad.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import { TIPOS_APARATO, nombreTipoAparato } from "./datos.js";

const campo = "input w-full";
const TIPO_INICIAL = TIPOS_APARATO[0]?.clave ?? "otro";
const VACIO = {
  tipo: TIPO_INICIAL,
  marca: "",
  modelo: "",
  numeroSerie: "",
  clienteId: "",
  clienteNombre: "",
  accesorios: "",
  estadoFisico: "",
  garantiaHasta: "",
  notas: "",
};

// Fecha guardada (ISO) → valor de un input type="date".
const aFechaInput = (f) => {
  if (!f) return "";
  const d = new Date(f);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

export default function ServicioAparatosPage() {
  const [lista, setLista] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [historialDe, setHistorialDe] = useState(null); // aparato cuyo historial se muestra
  const [q, setQ] = useState("");

  // Filtra por todos los campos visibles de la tabla.
  const filtrada = (lista ?? []).filter((a) =>
    coincideBusqueda(
      q,
      a.codigo,
      nombreTipoAparato(a.tipo),
      a.marca,
      a.modelo,
      a.numeroSerie,
      a.clienteNombre
    )
  );

  async function cargar() {
    try {
      const r = await fetch("/api/servicio/aparatos");
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
    fetch("/api/clientes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .catch(() => setClientes([]));
  }, []);

  function abrirNuevo() {
    setEditando(null);
    setForm(VACIO);
    setModal(true);
  }

  function abrirEdicion(a) {
    setEditando(a);
    setForm({
      tipo: a.tipo ?? TIPO_INICIAL,
      marca: a.marca ?? "",
      modelo: a.modelo ?? "",
      numeroSerie: a.numeroSerie ?? "",
      clienteId: a.cliente ?? "",
      clienteNombre: a.clienteNombre ?? "",
      accesorios: a.accesorios ?? "",
      estadoFisico: a.estadoFisico ?? "",
      garantiaHasta: aFechaInput(a.garantiaHasta),
      notas: a.notas ?? "",
    });
    setModal(true);
  }

  // Propietario: de la cartera (vinculado) o nombre suelto. Si el texto deja
  // de coincidir con el nombre del cliente vinculado, se desvincula.
  function escribirCliente(t) {
    setForm((f) => {
      const vinculado = clientes.find((c) => String(c._id) === String(f.clienteId));
      return { ...f, clienteNombre: t, clienteId: vinculado?.nombre === t ? f.clienteId : "" };
    });
  }

  function elegirCliente(op) {
    setForm((f) => ({ ...f, clienteId: op?._id ?? "" }));
  }

  async function guardar(e) {
    e.preventDefault();
    // El código (AP-000001) lo asigna el servidor: no se pide en el formulario.
    const cuerpo = {
      tipo: form.tipo,
      marca: form.marca || undefined,
      modelo: form.modelo || undefined,
      numeroSerie: form.numeroSerie || undefined,
      cliente: form.clienteId || undefined,
      clienteNombre: form.clienteNombre || undefined,
      accesorios: form.accesorios || undefined,
      estadoFisico: form.estadoFisico || undefined,
      garantiaHasta: form.garantiaHasta || undefined,
      notas: form.notas || undefined,
    };
    const r = await fetch(`/api/servicio/aparatos${editando ? `/${editando._id}` : ""}`, {
      method: editando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const datos = await r.json();
    if (r.ok) {
      setModal(false);
      cargar();
    } else alert(datos.error || "Error al guardar");
  }

  async function borrar(a) {
    if (!window.confirm(`¿Borrar el aparato ${a.codigo}?`)) return;
    const r = await fetch(`/api/servicio/aparatos/${a._id}`, { method: "DELETE" });
    const datos = await r.json();
    // 409 (tiene órdenes de servicio) llega aquí con datos.error y se muestra.
    if (r.ok) cargar();
    else alert(datos.error || "No se pudo borrar");
  }

  return (
    <>
      <CabeceraPagina titulo="Aparatos" descripcion="Equipos de informática y electrónica de los clientes.">
        <button onClick={abrirNuevo} className="btn-primary">
          Nuevo aparato
        </button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {lista?.length > 0 && (
        <div className="mb-3">
          <InputBusqueda value={q} onChange={setQ} />
        </div>
      )}

      <div className="panel px-3.5 py-2">
        {!lista ? null : lista.length === 0 ? (
          <EstadoVacio
            titulo="Sin aparatos"
            descripcion="Registra el primer aparato o usa la Recepción rápida desde el panel del servicio técnico."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Marca / Modelo</th>
                  <th>Nº de serie</th>
                  <th>Cliente</th>
                  <th>Garantía hasta</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((a) => (
                  <tr key={a._id}>
                    <td className="font-bold text-white whitespace-nowrap num">{a.codigo}</td>
                    <td>
                      <Badge tono="slate">{nombreTipoAparato(a.tipo)}</Badge>
                    </td>
                    <td className="text-slate-300">
                      {[a.marca, a.modelo].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="text-slate-300 whitespace-nowrap num">{a.numeroSerie ?? "—"}</td>
                    <td className="text-slate-300">{a.clienteNombre ?? "—"}</td>
                    <td className="text-slate-300 whitespace-nowrap num">
                      {a.garantiaHasta ? new Date(a.garantiaHasta).toLocaleDateString("es-ES") : "—"}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        onClick={() => setHistorialDe(a)}
                        title="Historial del aparato (órdenes de servicio y fotos del estado)"
                        className="text-xs text-accent hover:underline mr-3"
                      >
                        Historial
                      </button>
                      <button
                        onClick={() => abrirEdicion(a)}
                        className="text-xs text-accent hover:underline mr-3"
                      >
                        Editar
                      </button>
                      <button onClick={() => borrar(a)} className="text-xs text-rose-400 hover:underline">
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-8">
                      Sin resultados para «{q}».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <div className="modal-panel w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">
              {editando ? `Aparato ${editando.codigo}` : "Nuevo aparato"}
            </h2>
            <form onSubmit={guardar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Tipo</label>
                  <select
                    className={campo}
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  >
                    {TIPOS_APARATO.map((t) => (
                      <option key={t.clave} value={t.clave}>{t.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Marca</label>
                  <input className={campo} value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Modelo</label>
                  <input className={campo} value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Nº de serie</label>
                  <input className={campo} value={form.numeroSerie} onChange={(e) => setForm({ ...form, numeroSerie: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Propietario</label>
                  <BuscadorEntidad
                    opciones={clientes}
                    valorTexto={form.clienteNombre}
                    onTexto={escribirCliente}
                    onElegir={elegirCliente}
                    placeholder="Buscar en la cartera o escribir…"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Garantía hasta</label>
                  <input
                    type="date"
                    className={campo}
                    value={form.garantiaHasta}
                    onChange={(e) => setForm({ ...form, garantiaHasta: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Accesorios</label>
                <input
                  className={campo}
                  value={form.accesorios}
                  onChange={(e) => setForm({ ...form, accesorios: e.target.value })}
                  placeholder="cables, funda, mando…"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Estado físico</label>
                <textarea
                  rows={2}
                  className={`${campo} resize-none`}
                  value={form.estadoFisico}
                  onChange={(e) => setForm({ ...form, estadoFisico: e.target.value })}
                  placeholder="Desperfectos visibles: golpes, arañazos, pantalla…"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Notas</label>
                <input className={campo} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-ghost">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {historialDe && (
        <ModalHistorial aparato={historialDe} onCerrar={() => setHistorialDe(null)} />
      )}
    </>
  );
}

// Historial del aparato: cada orden de servicio con sus fotos del estado.
function ModalHistorial({ aparato, onCerrar }) {
  const [entradas, setEntradas] = useState(null);

  useEffect(() => {
    fetch(`/api/servicio/aparatos/${aparato._id}/historial`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setEntradas)
      .catch(() => setEntradas([]));
  }, [aparato._id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="modal-panel w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Historial · {aparato.codigo}</h2>
            <p className="text-sm text-slate-400">
              {[aparato.marca, aparato.modelo].filter(Boolean).join(" ") || nombreTipoAparato(aparato.tipo)}
              {aparato.clienteNombre ? ` · ${aparato.clienteNombre}` : ""}
            </p>
          </div>
          <button onClick={onCerrar} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {!entradas ? null : entradas.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            Sin historial todavía. Las recepciones y las fotos del estado se guardan aquí automáticamente.
          </p>
        ) : (
          <ul className="space-y-4">
            {entradas.map((h, i) => (
              <li key={h.orden ?? i} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-bold text-slate-800">{h.numeroOrden ?? "Orden"}</span>
                  <span className="text-xs text-slate-500">
                    {h.fecha ? new Date(h.fecha).toLocaleDateString("es-ES") : ""}
                  </span>
                </div>
                {h.motivo && <p className="text-sm text-slate-600 mt-1">{h.motivo}</p>}
                {h.fotos?.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2.5">
                    {h.fotos.map((f) => (
                      <a
                        key={f}
                        href={f}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir la foto en una pestaña nueva"
                        className="group"
                      >
                        <img
                          src={f}
                          alt="Foto del estado"
                          className="w-full h-20 object-cover rounded-lg border border-slate-200 group-hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end pt-4">
          <button type="button" onClick={onCerrar} className="btn-ghost">Cerrar</button>
        </div>
      </div>
    </div>
  );
}
