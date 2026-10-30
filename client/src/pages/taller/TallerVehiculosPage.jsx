import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import SelectorContacto from "../../components/SelectorContacto.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import { IconImprimir } from "../../components/icons.jsx";
import { imprimirFicha } from "../../utils/imprimir.js";
import { cargarClientesLigeros } from "../../lib/clientesLigeros.js";
import { urlApiConSesion } from "../../lib/sesion.js";
import { fondoSeguro } from "../../lib/cierreProtegido.js";

const campo = "input w-full";
const VACIO = { matricula: "", marca: "", modelo: "", bastidor: "", color: "", combustible: "", anio: "", km: "", tipo: "cliente", clienteId: "", clienteNombre: "", notas: "" };

export default function TallerVehiculosPage() {
  const [lista, setLista] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [historialDe, setHistorialDe] = useState(null); // vehículo cuyo historial se muestra
  const [q, setQ] = useState("");

  // Préstamo activo por vehículo (cortesía prestada o coche del cliente con cortesía).
  const prestamoPorVehiculo = Object.fromEntries(
    prestamos.filter((p) => p.estado === "activo").map((p) => [String(p.vehiculo), p])
  );
  // Para vehículos de cliente: si su dueño tiene un cortesía activo.
  const cortesiaDelCliente = Object.fromEntries(
    prestamos.filter((p) => p.estado === "activo" && p.clienteNombre).map((p) => [p.clienteNombre, p])
  );

  // Busca el teléfono por el cliente vinculado y, si el vehículo solo tiene
  // el nombre (recepción rápida, valoración importada...), por coincidencia
  // de nombre con la cartera de clientes.
  const normalizar = (s) => (s ?? "").trim().toLowerCase();
  const telefonoCliente = (v) =>
    clientes.find((c) => String(c._id) === String(v.cliente))?.telefono ??
    (v.clienteNombre
      ? clientes.find((c) => normalizar(c.nombre) === normalizar(v.clienteNombre))?.telefono
      : undefined);

  // Filtra por todos los campos visibles de la tabla.
  const filtrada = (lista ?? []).filter((v) =>
    coincideBusqueda(
      q,
      v.matricula,
      v.marca,
      v.modelo,
      v.bastidor,
      v.color,
      v.combustible,
      v.clienteNombre,
      telefonoCliente(v),
      v.tipo === "cortesia" ? "cortesia" : "cliente",
      v.anio != null ? String(v.anio) : null,
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
    cargarClientesLigeros().then(setClientes);
    fetch("/api/taller/cortesia")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPrestamos)
      .catch(() => setPrestamos([]));
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
      bastidor: v.bastidor ?? "",
      color: v.color ?? "",
      combustible: v.combustible ?? "",
      anio: v.anio ?? "",
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
      bastidor: form.bastidor || undefined,
      color: form.color || undefined,
      combustible: form.combustible || undefined,
      anio: form.anio ? Number(form.anio) : undefined,
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
                  <th>Teléfono</th>
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
                      {(v.anio != null || v.combustible || v.color) && (
                        <p className="text-[0.6875rem] text-slate-500">
                          {[v.anio, v.combustible, v.color].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="text-slate-300">{v.clienteNombre ?? "—"}</td>
                    <td className="text-slate-300 whitespace-nowrap num">{telefonoCliente(v) ?? "—"}</td>
                    <td>
                      <Badge tono={v.tipo === "cortesia" ? "amber" : "slate"}>
                        {v.tipo === "cortesia" ? "Cortesía" : "Cliente"}
                      </Badge>
                      {v.tipo === "cortesia" && prestamoPorVehiculo[String(v._id)] && (
                        <span
                          title={`Prestado a ${prestamoPorVehiculo[String(v._id)].clienteNombre}, devolución prevista ${new Date(prestamoPorVehiculo[String(v._id)].fechaPrevista).toLocaleDateString("es-ES")}`}
                          className="ml-1.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200 text-[0.625rem] font-bold px-1.5 py-0.5 align-middle"
                        >
                          Prestado
                        </span>
                      )}
                      {v.tipo !== "cortesia" && v.clienteNombre && cortesiaDelCliente[v.clienteNombre] && (
                        <span
                          title={`El cliente tiene de cortesía ${cortesiaDelCliente[v.clienteNombre].matricula}, devolución prevista ${new Date(cortesiaDelCliente[v.clienteNombre].fechaPrevista).toLocaleDateString("es-ES")}`}
                          className="ml-1.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200 text-[0.625rem] font-bold px-1.5 py-0.5 align-middle"
                        >
                          Cortesía {cortesiaDelCliente[v.clienteNombre].matricula}
                        </span>
                      )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" {...fondoSeguro(() => setModal(false))}>
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
                  <label className="text-sm text-slate-400 block mb-1">Bastidor (VIN)</label>
                  <input className={`${campo} uppercase`} value={form.bastidor} onChange={(e) => setForm({ ...form, bastidor: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Color</label>
                  <input className={campo} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Combustible</label>
                  <input className={campo} list="combustibles-taller" value={form.combustible} onChange={(e) => setForm({ ...form, combustible: e.target.value })} />
                  <datalist id="combustibles-taller">
                    {["Gasolina", "Diésel", "Híbrido", "Híbrido enchufable", "Eléctrico", "GLP", "GNC"].map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Año</label>
                  <input type="number" min="1900" max="2100" className={campo} value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} />
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
  const [documentoAbierto, setDocumentoAbierto] = useState(null);
  const [pestana, setPestana] = useState("ordenes");
  const [avisoCerrado, setAvisoCerrado] = useState(false);

  useEffect(() => {
    setDatos(null);
    setAvisoCerrado(false);
    fetch(`/api/taller/vehiculos/${vehiculo._id}/documentos`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDatos)
      .catch(() => setDatos(null));
  }, [vehiculo._id]);

  // Notas internas escritas dentro de las órdenes de este vehículo: también
  // cuentan para la pestaña de Notas internas (se ven sin abrir la orden).
  const notasDeOrdenes = (datos?.ordenes ?? []).filter((o) => o.notasInternas?.trim());

  const PESTANAS = [
    { clave: "ordenes", nombre: "Órdenes", datos: datos?.ordenes ?? [] },
    { clave: "presupuestos", nombre: "Presupuestos", datos: datos?.presupuestos ?? [] },
    { clave: "albaranes", nombre: "Albaranes", datos: datos?.albaranes ?? [] },
    { clave: "facturas", nombre: "Facturas", datos: datos?.facturas ?? [] },
    { clave: "citas", nombre: "Citas", datos: datos?.citas ?? [] },
    { clave: "valoraciones", nombre: "Valoraciones", datos: datos?.valoraciones ?? [] },
    { clave: "cortesias", nombre: "Cortesías", datos: datos?.cortesias ?? [] },
    { clave: "notas", nombre: "Notas internas", datos: [...(datos?.notasInternas ?? []), ...notasDeOrdenes] },
  ];

  const activa = PESTANAS.find((p) => p.clave === pestana);
  // Avisos activos del vehículo: notas internas marcadas como aviso. Saltan
  // al abrir el historial y quedan visibles mientras no se quiten.
  const avisos = (datos?.notasInternas ?? []).filter((n) => n.aviso);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" {...fondoSeguro(onCerrar)}>
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
            {(vehiculo.anio != null || vehiculo.combustible || vehiculo.color || vehiculo.bastidor) && (
              <p className="mt-0.5 text-xs text-slate-500">
                {[
                  vehiculo.anio,
                  vehiculo.combustible,
                  vehiculo.color,
                  vehiculo.bastidor ? `Bastidor ${vehiculo.bastidor}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <button onClick={onCerrar} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {!datos ? (
          <p className="text-sm text-slate-500 text-center py-8">Cargando…</p>
        ) : (
          <>
            {/* Avisos activos: banner persistente */}
            {avisos.length > 0 && (
              <div className="mb-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5">
                <p className="text-sm font-bold text-rose-800">
                  {avisos.length === 1 ? "Aviso activo en este vehículo" : `${avisos.length} avisos activos en este vehículo`}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {avisos.map((a) => (
                    <li key={a._id} className="text-sm text-rose-700">— {a.texto}</li>
                  ))}
                </ul>
                <button onClick={() => setPestana("notas")} className="mt-1 text-xs font-semibold text-rose-700 hover:underline">
                  Gestionar en Notas internas
                </button>
              </div>
            )}

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
            {pestana === "notas" ? (
              <div className="space-y-5">
                <NotasInternasTab
                  vehiculoId={vehiculo._id}
                  notas={datos?.notasInternas ?? []}
                  onCambio={(notas) => setDatos((d) => ({ ...(d ?? {}), notasInternas: notas }))}
                />
                {/* Notas internas escritas en las órdenes de este vehículo:
                    se consultan aquí sin tener que abrir la orden una a una. */}
                {notasDeOrdenes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Notas de las órdenes de trabajo
                    </p>
                    <ul className="space-y-2">
                      {notasDeOrdenes.map((o) => (
                        <li key={o._id} className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs text-slate-500">
                                Orden {o.serieNumero ?? o.numero ?? o.numeroOrden ?? "—"}
                                {(o.fechaEntrada ?? o.createdAt) &&
                                  ` · ${new Date(o.fechaEntrada ?? o.createdAt).toLocaleDateString("es-ES")}`}
                                {o.estado ? ` · ${String(o.estado).replace(/_/g, " ")}` : ""}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{o.notasInternas}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setDocumentoAbierto({ doc: o, tipo: "ordenes" })}
                              className="btn-ghost text-xs px-3 py-1.5 shrink-0"
                            >
                              Ver orden
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : activa.datos.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Sin {activa.nombre.toLowerCase()} para este vehículo.
              </p>
            ) : (
              <ul className="space-y-3">
                {activa.datos.map((doc) => (
                  <DocumentoItem
                    key={doc._id}
                    doc={doc}
                    tipo={pestana}
                    onFoto={setFotoGrande}
                    onAbrir={() => setDocumentoAbierto({ doc, tipo: pestana })}
                  />
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
            {...fondoSeguro(() => setFotoGrande(null))}
          >
            <img src={urlApiConSesion(fotoGrande)} alt="Foto ampliada" className="max-w-full max-h-full rounded-xl" />
          </div>
        )}

        {documentoAbierto && (
          <VisualizadorDocumento
            doc={documentoAbierto.doc}
            tipo={documentoAbierto.tipo}
            onCerrar={() => setDocumentoAbierto(null)}
            onFoto={setFotoGrande}
          />
        )}

        {/* Aviso que salta al abrir el historial si el vehículo tiene notas
            internas marcadas como aviso. */}
        {datos && avisos.length > 0 && !avisoCerrado && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" {...fondoSeguro(() => setAvisoCerrado(true))}>
            <div
              className="w-full max-w-md rounded-2xl border-2 border-rose-400 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-rose-200 bg-rose-50 px-5 py-3">
                <p className="text-sm font-bold uppercase tracking-wide text-rose-700">
                  Aviso de este vehículo
                </p>
              </div>
              <div className="space-y-3 p-5">
                <p className="text-sm text-slate-600">
                  <span className="font-bold text-slate-800">{vehiculo.matricula}</span>
                  {vehiculo.clienteNombre ? ` · ${vehiculo.clienteNombre}` : ""} tiene
                  {avisos.length === 1 ? " un aviso activo:" : ` ${avisos.length} avisos activos:`}
                </p>
                <ul className="space-y-2">
                  {avisos.map((a) => (
                    <li key={a._id} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                      {a.texto}
                      <p className="mt-0.5 text-[0.6875rem] text-rose-500">
                        {a.fecha ? new Date(a.fecha).toLocaleDateString("es-ES") : ""}
                        {a.autor ? ` · ${a.autor}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setAvisoCerrado(true)} className="btn-primary w-full">
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Pestaña de notas internas del vehículo: alta, edición, borrado y
// conversión en aviso (salta al abrir el historial y al crear una cita).
function NotasInternasTab({ vehiculoId, notas, onCambio }) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState(false);
  const [editando, setEditando] = useState(null); // { _id, texto, aviso }
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function llamar(metodo, ruta, cuerpo) {
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch(`/api/taller/vehiculos/${vehiculoId}/notas-internas${ruta}`, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al guardar");
      onCambio(Array.isArray(datos) ? datos : []);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setEnviando(false);
    }
  }

  async function anadir(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    if (await llamar("POST", "", { texto, aviso })) {
      setTexto("");
      setAviso(false);
    }
  }

  async function guardarEdicion() {
    if (!editando?.texto.trim()) return;
    if (await llamar("PUT", `/${editando._id}`, { texto: editando.texto, aviso: editando.aviso })) {
      setEditando(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={anadir} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-2">
          Nueva nota interna (no sale en impresos)
        </label>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder="P. ej.: cliente moroso con la última factura, pieza pedida y pendiente de recibir, incidencia con el turbo…"
          className="input w-full"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={aviso}
              onChange={(e) => setAviso(e.target.checked)}
              className="mt-0.5 accent-rose-600"
            />
            <span>
              Convertir en aviso
              <span className="block text-xs text-slate-500">
                Saltará al abrir el historial y al crear una cita con este vehículo.
              </span>
            </span>
          </label>
          <button type="submit" disabled={enviando || !texto.trim()} className="btn-primary">
            Añadir nota
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </form>

      {notas.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">
          Sin notas internas para este vehículo.
        </p>
      ) : (
        <ul className="space-y-2">
          {notas.map((n) => (
            <li
              key={n._id}
              className={`rounded-xl border p-4 ${n.aviso ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}
            >
              {editando?._id === n._id ? (
                <div className="space-y-2">
                  <textarea
                    value={editando.texto}
                    onChange={(e) => setEditando({ ...editando, texto: e.target.value })}
                    rows={3}
                    className="input w-full"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editando.aviso}
                        onChange={(e) => setEditando({ ...editando, aviso: e.target.checked })}
                        className="accent-rose-600"
                      />
                      Es un aviso
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditando(null)} className="btn-ghost">Cancelar</button>
                      <button type="button" onClick={guardarEdicion} disabled={enviando} className="btn-primary">Guardar</button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className={`text-sm whitespace-pre-wrap ${n.aviso ? "text-rose-800" : "text-slate-700"}`}>{n.texto}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[0.6875rem] text-slate-500">
                      {n.fecha ? new Date(n.fecha).toLocaleDateString("es-ES") : ""}
                      {n.autor ? ` · ${n.autor}` : ""}
                      {n.aviso && <span className="ml-2 font-bold text-rose-600">AVISO ACTIVO</span>}
                    </p>
                    <div className="flex gap-3 text-xs">
                      <button type="button" onClick={() => setEditando({ _id: n._id, texto: n.texto, aviso: Boolean(n.aviso) })} className="text-accent hover:underline">
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => llamar("PUT", `/${n._id}`, { aviso: !n.aviso })}
                        className={n.aviso ? "text-slate-500 hover:underline" : "text-rose-600 hover:underline"}
                      >
                        {n.aviso ? "Quitar aviso" : "Hacer aviso"}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.confirm("¿Borrar esta nota?") && llamar("DELETE", `/${n._id}`)}
                        className="text-rose-400 hover:underline"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentoItem({ doc, tipo, onFoto, onAbrir }) {
  const fecha = doc.fecha ?? doc.createdAt;
  const numero = doc.numero ?? doc.numeroOrden ?? doc.numOrden ?? "—";
  const cliente = doc.clienteNombre ?? doc.cliente?.nombre ?? "";
  const total = doc.total ?? 0;
  const estado = doc.estado ?? "";

  // Órdenes de trabajo: fotos de la recepción y de la entrega, datos
  // completos y tareas pendientes (propuesta 15/10 — historial completo).
  const esOrden = tipo === "ordenes";
  const esCortesia = tipo === "cortesias";
  const fotosRecepcion = esOrden ? doc.recepcionDigital?.fotos ?? [] : [];
  const fotosEntrega = esOrden ? doc.entrega?.fotos ?? [] : [];
  const fotosSueltas = !esOrden ? doc.fotos ?? [] : [];
  const notasPendientes = esOrden ? doc.entrega?.notas ?? "" : "";
  const compania = esOrden ? doc.aseguradora?.nombre ?? "" : doc.compania ?? "";
  const danios = esOrden ? doc.recepcionDigital?.danos ?? "" : "";
  // Cortesías: el préstamo guarda la matrícula del coche de cortesía en
  // "matricula" y (si se apuntó) el coche en reparación en
  // "vehiculoReparacionMatricula". Mostramos qué cortesía se prestó y las
  // fechas del préstamo, venga el historial del coche de cortesía o del
  // coche del cliente que la recibió.
  const cortesiaTexto = esCortesia
    ? [
        doc.vehiculo?.matricula ?? doc.matricula,
        [doc.vehiculo?.marca, doc.vehiculo?.modelo].filter(Boolean).join(" ") || undefined,
      ].filter(Boolean).join(" · ")
    : "";
  const cortesiaPeriodo = esCortesia
    ? [
        doc.fechaSalida ? `salida ${new Date(doc.fechaSalida).toLocaleDateString("es-ES")}` : null,
        doc.fechaDevolucion ? `devolución ${new Date(doc.fechaDevolucion).toLocaleDateString("es-ES")}` : null,
      ].filter(Boolean).join(" — ")
    : "";

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
    con_compromiso: "bg-emerald-100 text-emerald-700",
    sin_compromiso: "bg-amber-100 text-amber-700",
    facturado: "bg-emerald-100 text-emerald-700",
    cancelada: "bg-rose-100 text-rose-700",
    activo: "bg-emerald-100 text-emerald-700",
    devuelto: "bg-slate-100 text-slate-600",
  };

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
      {esCortesia && cortesiaTexto && (
        <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
          <span className="font-semibold">Cortesía prestada:</span> {cortesiaTexto}
          {cortesiaPeriodo && <span className="text-amber-600"> · {cortesiaPeriodo}</span>}
        </p>
      )}
      {doc.motivo && <p className="text-sm text-slate-600 mt-1">{doc.motivo}</p>}
      {doc.notas && (
        <p
          className="mt-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-800"
          title={doc.notas}
        >
          <span className="font-semibold">Nota:</span>{" "}
          {doc.notas.length > 140 ? `${doc.notas.slice(0, 140)}…` : doc.notas}
        </p>
      )}
      {esOrden && doc.notasInternas && (
        <p
          className="mt-1.5 rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-xs text-slate-700"
          title={doc.notasInternas}
        >
          <span className="font-semibold">Nota interna:</span>{" "}
          {doc.notasInternas.length > 140 ? `${doc.notasInternas.slice(0, 140)}…` : doc.notasInternas}
        </p>
      )}
      {doc.trabajos?.length > 0 && (
        <p className="text-xs text-slate-400 mt-1">{doc.trabajos.join(", ")}</p>
      )}
      {esOrden && (doc.km != null || compania || doc.numeroSiniestro || danios) && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] text-slate-500">
          {doc.km != null && <span className="num">{doc.km.toLocaleString("es-ES")} km</span>}
          {compania && <span>{compania}</span>}
          {doc.numeroSiniestro && <span>Siniestro {doc.numeroSiniestro}</span>}
          {danios && <span title={danios}>Daños: {danios.length > 60 ? `${danios.slice(0, 60)}…` : danios}</span>}
        </p>
      )}
      {notasPendientes && (
        <p
          className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800"
          title={notasPendientes}
        >
          <span className="font-semibold">Pendiente:</span>{" "}
          {notasPendientes.length > 140 ? `${notasPendientes.slice(0, 140)}…` : notasPendientes}
        </p>
      )}
      {(fotosRecepcion.length > 0 || fotosEntrega.length > 0) && (
        <div className="mt-2.5 space-y-2">
          {fotosRecepcion.length > 0 && (
            <div>
              <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Recepción ({fotosRecepcion.length})
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {fotosRecepcion.map((f) => (
                  <button key={f} type="button" onClick={(e) => { e.stopPropagation(); onFoto(f); }} className="group">
                    <img
                      src={urlApiConSesion(f)}
                      alt="Foto recepción"
                      className="w-full h-16 object-cover rounded-lg border border-slate-200 group-hover:opacity-80 transition-opacity"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          {fotosEntrega.length > 0 && (
            <div>
              <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Entrega ({fotosEntrega.length})
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {fotosEntrega.map((f) => (
                  <button key={f} type="button" onClick={(e) => { e.stopPropagation(); onFoto(f); }} className="group">
                    <img
                      src={urlApiConSesion(f)}
                      alt="Foto entrega"
                      className="w-full h-16 object-cover rounded-lg border border-slate-200 group-hover:opacity-80 transition-opacity"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {fotosSueltas.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2.5">
          {fotosSueltas.map((f) => (
            <button key={f} type="button" onClick={(e) => { e.stopPropagation(); onFoto(f); }} className="group">
              <img
                src={urlApiConSesion(f)}
                alt="Foto"
                className="w-full h-16 object-cover rounded-lg border border-slate-200 group-hover:opacity-80 transition-opacity"
              />
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className="block w-full text-left rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md hover:border-accent/30 transition-all"
      >
        {contenido}
      </button>
    </li>
  );
}

// Visor de documento del historial: muestra el documento COMPLETO (todos sus
// datos, líneas, fotos y firmas), no un resumen.
function VisualizadorDocumento({ doc, tipo, onCerrar, onFoto }) {
  const eur = (v) =>
    v != null && v !== "" ? new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v) : null;
  const fCorta = (v) => (v ? new Date(v).toLocaleDateString("es-ES") : null);
  const fHora = (v) => (v ? new Date(v).toLocaleString("es-ES") : null);

  const titulos = {
    ordenes: "Orden de trabajo",
    presupuestos: "Presupuesto",
    albaranes: "Albarán",
    facturas: "Factura",
    citas: "Cita",
    valoraciones: "Valoración",
    cortesias: "Vehículo de cortesía",
  };
  const numero = doc.serieNumero ?? doc.numero ?? doc.numeroOrden ?? "Sin número";
  const fecha = doc.fechaExpedicion ?? doc.fecha ?? doc.createdAt;
  const cliente = doc.clienteNombre ?? doc.cliente?.nombre;

  // Datos propios de cada tipo de documento.
  const campos = [];
  const push = (etiqueta, valor) => {
    if (valor !== null && valor !== undefined && valor !== "") campos.push([etiqueta, String(valor)]);
  };

  if (tipo === "ordenes") {
    push("Matrícula", doc.matricula);
    push("Estado", String(doc.estado ?? "").replace(/_/g, " "));
    push("KM", doc.km != null ? doc.km.toLocaleString("es-ES") : null);
    push("Fecha entrada", fCorta(doc.fechaEntrada));
    push("Entrega prevista", fCorta(doc.fechaEntregaPrevista));
    push("Compañía", doc.aseguradora?.nombre);
    push("Nº siniestro", doc.numeroSiniestro);
    push("Franquicia", doc.franquicia ? eur(doc.franquicia) : null);
    push("Facturar a", doc.facturarA);
    push("Presupuesto", doc.presupuestoNumero || (doc.presupuestosNumeros ?? []).join(", "));
    push("Factura", doc.numeroFactura);
    push("Trabajos", (doc.trabajos ?? []).join(", "));
  } else if (tipo === "presupuestos") {
    push("Estado", String(doc.estado ?? "").replace(/_/g, " "));
    push("Validez", doc.validezDias ? `${doc.validezDias} días` : null);
    push("Válido hasta", doc.fecha && doc.validezDias
      ? fCorta(new Date(new Date(doc.fecha).getTime() + doc.validezDias * 86400000))
      : null);
  } else if (tipo === "albaranes") {
    push("Estado", String(doc.estado ?? "").replace(/_/g, " "));
  } else if (tipo === "facturas") {
    const cobrado = (doc.cobros ?? []).reduce((s, c) => s + (c.importe ?? 0), 0);
    let estadoCobro = "pendiente";
    if (doc.estado === "anulada") estadoCobro = "anulada";
    else if ((doc.total ?? 0) <= 0) estadoCobro = "cobrada";
    else if (cobrado <= 0) estadoCobro = "pendiente";
    else if (cobrado + 0.005 < (doc.total ?? 0)) estadoCobro = `parcial (${eur(cobrado)} de ${eur(doc.total)})`;
    else estadoCobro = "cobrada";
    push("Estado", String(doc.estado ?? "").replace(/_/g, " "));
    push("Cobro", estadoCobro);
    push("Vencimiento", fCorta(doc.vencimiento));
    push("Método de pago", doc.metodoPago);
    push("Matrícula", doc.matricula);
    push("Orden", doc.taller?.orden);
    push("Compañía", doc.taller?.aseguradora);
    push("Siniestro", doc.taller?.siniestro);
  } else if (tipo === "citas") {
    push("Fecha", fCorta(doc.fecha));
    push("Hora", doc.hora);
    push("Duración", doc.duracion ? `${doc.duracion} min` : null);
    push("Tipo", doc.tipo === "peritaje" ? "Peritaje" : "Recepción / entrega");
    push("Estado", String(doc.estado ?? "").replace(/_/g, " "));
    push("Entrega prevista", fCorta(doc.entregaPrevista));
    push("Teléfono", doc.telefono);
    push("Aseguradora", doc.aseguradoraNombre);
    push("Nº siniestro", doc.numeroSiniestro);
    push("Franquicia", doc.franquicia ? eur(doc.franquicia) : null);
    push("Cortesía reservada", doc.cortesiaMatricula);
  } else if (tipo === "valoraciones") {
    push("Estado", String(doc.estado ?? "").replace(/_/g, " "));
    push("Aseguradora", doc.aseguradora?.nombre);
    push("Total valoración", eur(doc.total));
  } else if (tipo === "cortesias") {
    push("Cortesía prestada", [doc.vehiculo?.matricula ?? doc.matricula, [doc.vehiculo?.marca, doc.vehiculo?.modelo].filter(Boolean).join(" ")].filter(Boolean).join(" · "));
    push("Coche en taller", doc.vehiculoReparacionMatricula);
    push("Orden", doc.numeroOrden);
    push("Estado", String(doc.estado ?? "").replace(/_/g, " "));
    push("Salida", fHora(doc.fechaSalida));
    push("Devolución", fHora(doc.fechaDevolucion) ?? (doc.fechaPrevista ? `${fCorta(doc.fechaPrevista)} (prevista)` : null));
    push("KM salida", doc.kmSalida != null ? doc.kmSalida.toLocaleString("es-ES") : null);
  }

  // Líneas comerciales (presupuestos, albaranes, facturas y órdenes): detalle
  // completo con cantidades, precios, descuentos e importes.
  const conLineasComerciales = ["ordenes", "presupuestos", "albaranes", "facturas"].includes(tipo);
  const lineas = conLineasComerciales ? doc.lineas ?? [] : [];
  const importeLinea = (l) =>
    Number(l.cantidad || 0) * Number(l.precioUnitario || 0) * (1 - (l.descuento || 0) / 100);

  const fotosRecepcion = tipo === "ordenes" ? doc.recepcionDigital?.fotos ?? [] : [];
  const fotosEntrega = tipo === "ordenes" ? doc.entrega?.fotos ?? [] : [];
  const fotosSueltas = tipo !== "ordenes" ? doc.fotos ?? [] : [];
  const firmaRecepcion = tipo === "ordenes" ? doc.recepcionDigital?.firma : null;
  const firmaAlbaran = tipo === "albaranes" ? doc.firmaEntrega : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" {...fondoSeguro(onCerrar)}>
      <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{titulos[tipo]}</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{numero}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {fecha ? new Date(fecha).toLocaleDateString("es-ES") : ""}
              {cliente ? ` · ${cliente}` : ""}
            </p>
          </div>
          <button type="button" onClick={onCerrar} className="rounded-lg px-3 py-1 text-2xl text-slate-500 hover:bg-slate-100 hover:text-slate-900">×</button>
        </div>

        <div className="space-y-5 p-6">
          {campos.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {campos.map(([etiqueta, valor]) => (
                <DatoDocumento key={etiqueta} etiqueta={etiqueta} valor={valor} />
              ))}
            </div>
          )}

          {(doc.motivo || doc.descripcion || doc.observaciones) && (
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Descripción</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {doc.motivo || doc.descripcion || doc.observaciones}
              </p>
            </div>
          )}

          {doc.notas && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">Notas</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-sky-800">{doc.notas}</p>
            </div>
          )}

          {/* Orden: notas internas (no salen en impresos) */}
          {tipo === "ordenes" && doc.notasInternas && (
            <div className="rounded-xl border border-slate-300 bg-slate-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Notas internas de la orden</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{doc.notasInternas}</p>
            </div>
          )}

          {/* Orden: datos de la entrega */}
          {tipo === "ordenes" && doc.entrega && (doc.entrega.fecha || doc.entrega.fechaEntrega || doc.entrega.clienteAvisado || doc.entrega.notas) && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Entrega</p>
              <div className="grid gap-2 sm:grid-cols-2 text-sm text-emerald-900">
                {doc.entrega.fecha && <p><span className="font-semibold">Trabajo terminado:</span> {fHora(doc.entrega.fecha)}</p>}
                {doc.entrega.fechaEntrega && <p><span className="font-semibold">Entregado al cliente:</span> {fHora(doc.entrega.fechaEntrega)}</p>}
                {doc.entrega.clienteAvisado && (
                  <p><span className="font-semibold">Cliente avisado:</span> {fHora(doc.entrega.avisoFecha) ?? "sí"}
                    {doc.entrega.avisoMedio ? ` (${doc.entrega.avisoMedio.replace(/_/g, " ")})` : ""}</p>
                )}
              </div>
              {doc.entrega.notas && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Tareas pendientes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-amber-800">{doc.entrega.notas}</p>
                </div>
              )}
            </div>
          )}

          {/* Órdenes: horas invertidas por operario */}
          {tipo === "ordenes" && doc.tiempos?.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Horas invertidas</div>
              <div className="divide-y divide-slate-100">
                {doc.tiempos.map((t, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 px-4 py-2.5">
                    <div>
                      <p className="text-sm text-slate-700">{t.operarioNombre || "Operario"}</p>
                      <p className="text-xs text-slate-500">
                        {fCorta(t.fecha)}{t.nota ? ` · ${t.nota}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-900">{t.horas} h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Órdenes: materiales cargados de albaranes de compra */}
          {tipo === "ordenes" && doc.albaranesCompra?.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Materiales (albaranes de compra)</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {doc.albaranesCompra.map((m, i) => (
                  <li key={i}>
                    {m.numero || "Albarán"}{m.fecha ? ` · ${fCorta(m.fecha)}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Líneas comerciales completas */}
          {lineas.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Detalle</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2">Descripción</th>
                      <th className="px-2 py-2 text-right">Cant.</th>
                      <th className="px-2 py-2 text-right">Precio</th>
                      <th className="px-2 py-2 text-right">Dto %</th>
                      <th className="px-2 py-2 text-right">IVA %</th>
                      <th className="px-4 py-2 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineas.map((l, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-slate-700">
                          {l.descripcion}
                          {l.detalle && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500">{l.detalle}</p>}
                          {l.grupo && <p className="mt-0.5 text-[0.6875rem] text-slate-400">{l.grupo}</p>}
                        </td>
                        <td className="px-2 py-2.5 text-right text-slate-600 tabular-nums">{l.cantidad ?? 1}</td>
                        <td className="px-2 py-2.5 text-right text-slate-600 tabular-nums">{eur(l.precioUnitario)}</td>
                        <td className="px-2 py-2.5 text-right text-slate-600 tabular-nums">{l.descuento ? l.descuento : ""}</td>
                        <td className="px-2 py-2.5 text-right text-slate-600 tabular-nums">{l.iva ?? ""}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900 tabular-nums">{eur(importeLinea(l))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(doc.baseImponible != null || doc.total != null) && (
                <div className="space-y-1 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  {doc.baseImponible != null && (
                    <div className="flex justify-between text-slate-600">
                      <span>Base imponible</span>
                      <span className="tabular-nums">{eur(doc.baseImponible)}</span>
                    </div>
                  )}
                  {doc.cuotaIva != null && (
                    <div className="flex justify-between text-slate-600">
                      <span>IVA</span>
                      <span className="tabular-nums">{eur(doc.cuotaIva)}</span>
                    </div>
                  )}
                  {doc.total != null && (
                    <div className="flex justify-between text-base font-bold text-slate-900">
                      <span>Total</span>
                      <span className="tabular-nums">{eur(doc.total)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Citas: reparaciones a realizar (hoja de entrada) */}
          {tipo === "citas" && doc.lineas?.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Reparaciones a realizar</div>
              <div className="divide-y divide-slate-100">
                {doc.lineas.map((l, i) => (
                  <div key={i} className="px-4 py-2.5">
                    <p className="text-sm text-slate-700">{l.descripcion}</p>
                    {(l.manoObra || l.materiales) && (
                      <p className="text-xs text-slate-500">
                        {l.manoObra ? `Mano de obra: ${l.manoObra}` : ""}
                        {l.manoObra && l.materiales ? " · " : ""}
                        {l.materiales ? `Materiales: ${l.materiales}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Citas: documentos adjuntos */}
          {tipo === "citas" && doc.adjuntos?.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Adjuntos</p>
              <ul className="mt-2 space-y-1 text-sm">
                {doc.adjuntos.map((a, i) => (
                  <li key={i}>
                    <a href={urlApiConSesion(a.url)} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      {a.nombre || "Documento"}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Valoraciones: líneas con tipo e importe */}
          {tipo === "valoraciones" && doc.lineas?.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Líneas de la valoración</div>
              <div className="divide-y divide-slate-100">
                {doc.lineas.map((l, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 px-4 py-2.5">
                    <div>
                      <p className="text-sm text-slate-700">{l.descripcion}</p>
                      {l.tipo && l.tipo !== "otro" && <p className="text-xs capitalize text-slate-500">{l.tipo}</p>}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">{eur(l.importe)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Facturas: vencimientos a plazos y cobros registrados */}
          {tipo === "facturas" && doc.plazos?.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vencimientos a plazos</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {doc.plazos.map((p, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{fCorta(p.fecha)}</span>
                    <span className="tabular-nums">{eur(p.importe)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tipo === "facturas" && doc.cobros?.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Cobros registrados</div>
              <div className="divide-y divide-slate-100">
                {doc.cobros.map((c, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 px-4 py-2.5">
                    <div>
                      <p className="text-sm capitalize text-slate-700">{c.metodo}</p>
                      <p className="text-xs text-slate-500">{fCorta(c.fecha)}{c.notas ? ` · ${c.notas}` : ""}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-emerald-700 tabular-nums">{eur(c.importe)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fotos y firmas */}
          {fotosRecepcion.length > 0 && (
            <MiniFotos titulo={`Fotos de la recepción (${fotosRecepcion.length})`} fotos={fotosRecepcion} onFoto={onFoto} />
          )}
          {fotosEntrega.length > 0 && (
            <MiniFotos titulo={`Fotos del trabajo terminado (${fotosEntrega.length})`} fotos={fotosEntrega} onFoto={onFoto} />
          )}
          {fotosSueltas.length > 0 && (
            <MiniFotos titulo={`Fotos (${fotosSueltas.length})`} fotos={fotosSueltas} onFoto={onFoto} />
          )}

          {firmaRecepcion?.imagen && (
            <FirmaBox titulo="Firma de la recepción" firma={firmaRecepcion} onFoto={onFoto} />
          )}
          {firmaAlbaran?.imagen && (
            <FirmaBox titulo="Firma de la entrega" firma={firmaAlbaran} onFoto={onFoto} />
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end border-t border-slate-200 bg-white px-6 py-4">
          <button type="button" onClick={onCerrar} className="btn-primary">Cerrar documento</button>
        </div>
      </div>
    </div>
  );
}

function MiniFotos({ titulo, fotos, onFoto }) {
  return (
    <div>
      <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{titulo}</p>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {fotos.map((f) => (
          <button key={f} type="button" onClick={() => onFoto?.(f)} className="group">
            <img
              src={urlApiConSesion(f)}
              alt="Foto"
              className="w-full h-16 object-cover rounded-lg border border-slate-200 group-hover:opacity-80 transition-opacity"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function FirmaBox({ titulo, firma, onFoto }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</p>
      <div className="mt-2 flex items-start gap-4">
        <button type="button" onClick={() => onFoto?.(firma.imagen)} className="shrink-0">
          <img
            src={urlApiConSesion(firma.imagen)}
            alt="Firma"
            className="h-20 rounded-lg border border-slate-200 bg-white"
          />
        </button>
        <div className="text-sm text-slate-600">
          {firma.nombre && <p className="font-semibold text-slate-800">{firma.nombre}</p>}
          {firma.dni && <p>DNI: {firma.dni}</p>}
          {firma.fecha && <p className="text-xs text-slate-500">{new Date(firma.fecha).toLocaleString("es-ES")}</p>}
        </div>
      </div>
    </div>
  );
}

function DatoDocumento({ etiqueta, valor }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-slate-800">{valor}</p>
    </div>
  );
}
