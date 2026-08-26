import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import SelectorContacto from "../../components/SelectorContacto.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import { IconImprimir } from "../../components/icons.jsx";
import { imprimirFicha } from "../../utils/imprimir.js";

const campo = "input w-full";
const VACIO = { matricula: "", marca: "", modelo: "", km: "", tipo: "cliente", clienteId: "", clienteNombre: "", notas: "" };

export default function TallerVehiculosPage() {
  const [lista, setLista] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [historialDe, setHistorialDe] = useState(null); // vehículo cuyo historial se muestra
  const [q, setQ] = useState("");

  // Filtra por todos los campos visibles de la tabla.
  const filtrada = (lista ?? []).filter((v) =>
    coincideBusqueda(
      q,
      v.matricula,
      v.marca,
      v.modelo,
      v.clienteNombre,
      v.tipo === "cortesia" ? "cortesia" : "cliente",
      v.km != null ? String(v.km) : null
    )
  );

  async function cargar() {
    try {
      const r = await fetch("/api/taller/vehiculos");
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

  function abrirEdicion(v) {
    setEditando(v);
    setForm({
      matricula: v.matricula,
      marca: v.marca ?? "",
      modelo: v.modelo ?? "",
      km: v.km ?? "",
      tipo: v.tipo,
      clienteId: v.cliente ?? "",
      clienteNombre: v.clienteNombre ?? "",
      notas: v.notas ?? "",
    });
    setModal(true);
  }

  // Elegir de la cartera vincula el cliente y copia su nombre al listado.
  function elegirCliente(id) {
    const c = clientes.find((x) => x._id === id);
    setForm((f) => ({ ...f, clienteId: id, clienteNombre: c?.nombre ?? "" }));
  }

  async function guardar(e) {
    e.preventDefault();
    const cuerpo = {
      matricula: form.matricula,
      marca: form.marca || undefined,
      modelo: form.modelo || undefined,
      km: form.km ? Number(form.km) : undefined,
      tipo: form.tipo,
      cliente: form.clienteId || undefined,
      clienteNombre: form.clienteNombre || undefined,
      notas: form.notas || undefined,
    };
    const r = await fetch(`/api/taller/vehiculos${editando ? `/${editando._id}` : ""}`, {
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

  async function borrar(v) {
    if (!window.confirm(`¿Borrar el vehículo ${v.matricula}?`)) return;
    const r = await fetch(`/api/taller/vehiculos/${v._id}`, { method: "DELETE" });
    const datos = await r.json();
    if (r.ok) cargar();
    else alert(datos.error || "No se pudo borrar");
  }

  return (
    <>
      <CabeceraPagina titulo="Vehículos" descripcion="Vehículos vinculados a clientes y flota de cortesía.">
        <button onClick={abrirNuevo} className="btn-primary">
          Nuevo vehículo
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
            titulo="Sin vehículos"
            descripcion="Registra el primer vehículo o usa la Recepción rápida desde el panel del taller."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Vehículo</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th className="text-right">KM</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((v) => (
                  <tr key={v._id}>
                    <td className="font-bold text-white whitespace-nowrap num">{v.matricula}</td>
                    <td className="text-slate-300">
                      {[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="text-slate-300">{v.clienteNombre ?? "—"}</td>
                    <td>
                      <Badge tono={v.tipo === "cortesia" ? "amber" : "slate"}>
                        {v.tipo === "cortesia" ? "Cortesía" : "Cliente"}
                      </Badge>
                    </td>
                    <td className="text-right text-slate-300 num">
                      {v.km != null ? `${v.km.toLocaleString("es-ES")} km` : "—"}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          imprimirFicha({
                            titulo: "Vehículo",
                            subtitulo: v.matricula,
                            campos: [
                              ["Matrícula", v.matricula],
                              ["Vehículo", [v.marca, v.modelo].filter(Boolean).join(" ")],
                              ["Cliente", v.clienteNombre],
                              ["Tipo", v.tipo === "cortesia" ? "Cortesía" : "Cliente"],
                              ["Bastidor", v.bastidor],
                              ["Color", v.color],
                              ["Combustible", v.combustible],
                              ["Año", v.anio],
                              ["Kilómetros", v.km != null ? `${v.km.toLocaleString("es-ES")} km` : undefined],
                            ],
                          })
                        }
                        title="Imprimir ficha"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle mr-2"
                      >
                        <IconImprimir />
                      </button>
                      <button
                        onClick={() => setHistorialDe(v)}
                        title="Historial del vehículo (recepciones y fotos del estado)"
                        className="text-xs text-accent hover:underline mr-3"
                      >
                        Historial
                      </button>
                      <button
                        onClick={() => abrirEdicion(v)}
                        className="text-xs text-accent hover:underline mr-3"
                      >
                        Editar
                      </button>
                      <button onClick={() => borrar(v)} className="text-xs text-rose-400 hover:underline">
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-500 py-8">
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
              {editando ? `Vehículo ${editando.matricula}` : "Nuevo vehículo"}
            </h2>
            <form onSubmit={guardar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Matrícula *</label>
                  <input
                    className={`${campo} uppercase`}
                    value={form.matricula}
                    onChange={(e) => setForm({ ...form, matricula: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Tipo</label>
                  <select
                    className={campo}
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  >
                    <option value="cliente">Cliente</option>
                    <option value="cortesia">Cortesía</option>
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
                  <label className="text-sm text-slate-400 block mb-1">KM</label>
                  <input
                    type="number"
                    min="0"
                    className={campo}
                    value={form.km}
                    onChange={(e) => setForm({ ...form, km: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Cliente</label>
                  <SelectorContacto
                    tipo="cliente"
                    contactos={clientes}
                    valor={form.clienteId}
                    onChange={elegirCliente}
                    onCreado={(c) => setClientes((cs) => [...cs, c])}
                  />
                </div>
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
        <ModalHistorial vehiculo={historialDe} onCerrar={() => setHistorialDe(null)} />
      )}
    </>
  );
}

// Historial del vehículo: todos los documentos vinculados a esta matrícula.
function ModalHistorial({ vehiculo, onCerrar }) {
  const [datos, setDatos] = useState(null);
  const [fotoGrande, setFotoGrande] = useState(null);
  const [pestana, setPestana] = useState("ordenes");

  useEffect(() => {
    fetch(`/api/taller/vehiculos/${vehiculo._id}/documentos`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDatos)
      .catch(() => setDatos(null));
  }, [vehiculo._id]);

  const PESTANAS = [
    { clave: "ordenes", nombre: "Órdenes", datos: datos?.ordenes ?? [] },
    { clave: "presupuestos", nombre: "Presupuestos", datos: datos?.presupuestos ?? [] },
    { clave: "albaranes", nombre: "Albaranes", datos: datos?.albaranes ?? [] },
    { clave: "facturas", nombre: "Facturas", datos: datos?.facturas ?? [] },
    { clave: "citas", nombre: "Citas", datos: datos?.citas ?? [] },
    { clave: "valoraciones", nombre: "Valoraciones", datos: datos?.valoraciones ?? [] },
    { clave: "cortesias", nombre: "Cortesías", datos: datos?.cortesias ?? [] },
  ];

  const activa = PESTANAS.find((p) => p.clave === pestana);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="modal-panel w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Historial · {vehiculo.matricula}</h2>
            <p className="text-sm text-slate-400">
              {[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ") || "Vehículo"}
              {vehiculo.clienteNombre ? ` · ${vehiculo.clienteNombre}` : ""}
            </p>
          </div>
          <button onClick={onCerrar} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {!datos ? (
          <p className="text-sm text-slate-500 text-center py-8">Cargando…</p>
        ) : (
          <>
            {/* Pestañas */}
            <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-200 pb-2">
              {PESTANAS.map((p) => (
                <button
                  key={p.clave}
                  onClick={() => setPestana(p.clave)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    pestana === p.clave
                      ? "bg-accent text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {p.nombre} ({p.datos.length})
                </button>
              ))}
            </div>

            {/* Contenido de la pestaña activa */}
            {activa.datos.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Sin {activa.nombre.toLowerCase()} para este vehículo.
              </p>
            ) : (
              <ul className="space-y-3">
                {activa.datos.map((doc) => (
                  <DocumentoItem key={doc._id} doc={doc} tipo={pestana} onFoto={setFotoGrande} />
                ))}
              </ul>
            )}
          </>
        )}

        <div className="flex justify-end pt-4">
          <button type="button" onClick={onCerrar} className="btn-ghost">Cerrar</button>
        </div>

        {fotoGrande && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
            onClick={() => setFotoGrande(null)}
          >
            <img src={fotoGrande} alt="Foto ampliada" className="max-w-full max-h-full rounded-xl" />
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentoItem({ doc, tipo, onFoto }) {
  const fecha = doc.fecha ?? doc.createdAt;
  const numero = doc.numero ?? doc.numeroOrden ?? "—";
  const cliente = doc.clienteNombre ?? doc.cliente?.nombre ?? "";
  const total = doc.total ?? 0;
  const estado = doc.estado ?? "";

  const tonosEstado = {
    recepcion: "bg-sky-100 text-sky-700",
    en_curso: "bg-amber-100 text-amber-700",
    finalizado: "bg-emerald-100 text-emerald-700",
    entregado: "bg-slate-100 text-slate-600",
    borrador: "bg-slate-100 text-slate-600",
    emitida: "bg-emerald-100 text-emerald-700",
    cobrada: "bg-emerald-100 text-emerald-700",
    pendiente: "bg-amber-100 text-amber-700",
    aprobada: "bg-emerald-100 text-emerald-700",
    rechazada: "bg-rose-100 text-rose-700",
    facturado: "bg-emerald-100 text-emerald-700",
    cancelada: "bg-rose-100 text-rose-700",
    activo: "bg-emerald-100 text-emerald-700",
    devuelto: "bg-slate-100 text-slate-600",
  };

  // Ruta para abrir el documento según su tipo
  const rutas = {
    ordenes: `/taller/ordenes/${doc._id}`,
    presupuestos: `/presupuestos/${doc._id}`,
    albaranes: `/albaranes/${doc._id}`,
    facturas: `/ventas/${doc._id}`,
    citas: `/taller/agenda`,
    valoraciones: `/taller/valoraciones/${doc._id}`,
    cortesias: `/taller/cortesia`,
  };

  const ruta = rutas[tipo];

  const contenido = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-800">{numero}</span>
          {estado && (
            <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-medium ${tonosEstado[estado] || "bg-slate-100 text-slate-600"}`}>
              {estado.replace(/_/g, " ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {fecha ? new Date(fecha).toLocaleDateString("es-ES") : ""}
          </span>
          {total > 0 && (
            <span className="text-sm font-semibold text-slate-700 tabular-nums">
              {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(total)}
            </span>
          )}
        </div>
      </div>
      {cliente && <p className="text-xs text-slate-500 mt-1">{cliente}</p>}
      {doc.motivo && <p className="text-sm text-slate-600 mt-1">{doc.motivo}</p>}
      {doc.trabajos?.length > 0 && (
        <p className="text-xs text-slate-400 mt-1">{doc.trabajos.join(", ")}</p>
      )}
      {doc.fotos?.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2.5">
          {doc.fotos.map((f) => (
            <button key={f} type="button" onClick={(e) => { e.stopPropagation(); onFoto(f); }} className="group">
              <img
                src={f}
                alt="Foto"
                className="w-full h-16 object-cover rounded-lg border border-slate-200 group-hover:opacity-80 transition-opacity"
              />
            </button>
          ))}
        </div>
      )}
    </>
  );

  if (ruta) {
    return (
      <li>
        <Link
          to={ruta}
          className="block rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md hover:border-accent/30 transition-all"
        >
          {contenido}
        </Link>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      {contenido}
    </li>
  );
}
