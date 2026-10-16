import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import { IconEditar, IconBorrar, IconOjo } from "../../components/icons.jsx";
import { cargarClientesLigeros } from "../../lib/clientesLigeros.js";

const VACIO = {
  tipo: "cambio",
  suministroId: "",
  comercializadoraDestinoId: "",
  nuevoTitularId: "",
  fechaPrevista: "",
  cambios: { telefono: "", email: "", calle: "", cp: "", ciudad: "", provincia: "", tarifa: "", consumoAnual: "", fechaFin: "" },
  notas: "",
};

const TIPOS = {
  alta: { label: "Alta", tono: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30" },
  cambio: { label: "Cambio comer.", tono: "bg-sky-400/10 text-sky-300 border-sky-400/30" },
  titular: { label: "Cambio titular", tono: "bg-violet-400/10 text-violet-300 border-violet-400/30" },
  renovacion: { label: "Renovación", tono: "bg-orange-400/10 text-orange-300 border-orange-400/30" },
  baja: { label: "Baja", tono: "bg-rose-400/10 text-rose-300 border-rose-400/30" },
};
const ESTADOS = {
  documentacion: { label: "Documentación", tono: "bg-amber-400/10 text-amber-300 border-amber-400/30" },
  enviado: { label: "Enviado", tono: "bg-sky-400/10 text-sky-300 border-sky-400/30" },
  en_tramite: { label: "En trámite", tono: "bg-violet-400/10 text-violet-300 border-violet-400/30" },
  activado: { label: "Activado", tono: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30" },
  rechazado: { label: "Rechazado", tono: "bg-rose-400/10 text-rose-300 border-rose-400/30" },
  cancelado: { label: "Cancelado", tono: "bg-slate-400/10 text-slate-400 border-slate-400/30" },
};

function Badge({ tono, children }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tono}`}>
      {children}
    </span>
  );
}

function fmtFecha(f) {
  return f ? new Date(f).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default function EnergiaTramitesPage() {
  const [lista, setLista] = useState(null);
  const [suministros, setSuministros] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [comercializadoras, setComercializadoras] = useState([]);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [detalle, setDetalle] = useState(null);
  const [nota, setNota] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const filtrada = (lista ?? []).filter((t) => {
    if (filtroTipo !== "todos" && t.tipo !== filtroTipo) return false;
    if (filtroEstado !== "todos" && t.estado !== filtroEstado) return false;
    return coincideBusqueda(
      q,
      t.cups,
      t.clienteNombre ?? t.cliente?.nombre,
      t.comercializadoraDestinoNombre ?? t.comercializadoraDestino?.nombre,
      t.comercializadoraOrigen,
      t.nuevoTitularNombre ?? t.nuevoTitular?.nombre,
      t.notas
    );
  });

  async function cargar() {
    try {
      const r = await fetch("/api/energia/tramites");
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
    fetch("/api/energia/suministros")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSuministros(Array.isArray(d) ? d : []))
      .catch(() => setSuministros([]));
    cargarClientesLigeros().then((d) => setClientes(Array.isArray(d) ? d : []));
    fetch("/api/energia/comercializadoras")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setComercializadoras(Array.isArray(d) ? d : []))
      .catch(() => setComercializadoras([]));
  }, []);

  // Abrir el alta de trámite desde la lista de suministros (?nuevo=<id>).
  useEffect(() => {
    const id = searchParams.get("nuevo");
    if (id && suministros.length > 0) {
      setEditando(null);
      setForm({ ...VACIO, suministroId: id });
      setModal(true);
      navigate("/energia/tramites", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, suministros]);

  function abrirNuevo() {
    setEditando(null);
    setForm(VACIO);
    setModal(true);
  }

  function abrirEdicion(t) {
    setEditando(t);
    setForm({
      tipo: t.tipo,
      suministroId: t.suministro?._id ?? t.suministro ?? "",
      comercializadoraDestinoId: t.comercializadoraDestino?._id ?? "",
      nuevoTitularId: t.nuevoTitular?._id ?? "",
      fechaPrevista: t.fechaPrevista ? new Date(t.fechaPrevista).toISOString().slice(0, 10) : "",
      cambios: {
        telefono: t.cambios?.telefono ?? "",
        email: t.cambios?.email ?? "",
        calle: t.cambios?.calle ?? "",
        cp: t.cambios?.cp ?? "",
        ciudad: t.cambios?.ciudad ?? "",
        provincia: t.cambios?.provincia ?? "",
        tarifa: t.cambios?.tarifa ?? "",
        consumoAnual: t.cambios?.consumoAnual ?? "",
        fechaFin: t.cambios?.fechaFin ? new Date(t.cambios.fechaFin).toISOString().slice(0, 10) : "",
      },
      notas: t.notas ?? "",
    });
    setModal(true);
  }

  async function guardar(e) {
    e.preventDefault();
    const cuerpo = {
      tipo: form.tipo,
      comercializadoraDestino:
        form.tipo === "baja" ? null : form.comercializadoraDestinoId || null,
      nuevoTitular: form.tipo === "titular" ? form.nuevoTitularId || null : null,
      fechaPrevista: form.fechaPrevista || null,
      // Renovación: los datos rellenados se aplican al activar el trámite.
      cambios:
        form.tipo === "renovacion"
          ? {
              telefono: form.cambios.telefono || undefined,
              email: form.cambios.email || undefined,
              calle: form.cambios.calle || undefined,
              cp: form.cambios.cp || undefined,
              ciudad: form.cambios.ciudad || undefined,
              provincia: form.cambios.provincia || undefined,
              tarifa: form.cambios.tarifa || undefined,
              consumoAnual: form.cambios.consumoAnual || undefined,
              fechaFin: form.cambios.fechaFin || undefined,
            }
          : undefined,
      notas: form.notas,
    };
    if (!editando) cuerpo.suministro = form.suministroId;
    const r = await fetch(`/api/energia/tramites${editando ? `/${editando._id}` : ""}`, {
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

  async function cambiarEstado(t, estado) {
    if (estado === "activado") {
      const efectos = {
        alta: `Se marcará el suministro como activo con ${t.comercializadoraDestinoNombre ?? "la comercializadora elegida"}.`,
        cambio: `La comercializadora del suministro pasará a ser ${t.comercializadoraDestinoNombre ?? "la elegida"}.`,
        titular: `El titular del suministro pasará a ser ${t.nuevoTitularNombre ?? "el elegido"}.`,
        renovacion:
          "La fecha de alta del suministro pasará a ser la de activación (el aviso de renovación volverá a saltar al año siguiente) y se aplicarán los datos cambiados.",
        baja: "El suministro quedará marcado como baja.",
      };
      if (!window.confirm(`¿Activar este trámite? ${efectos[t.tipo]}`)) return;
    }
    const r = await fetch(`/api/energia/tramites/${t._id}/estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, nota: nota || undefined }),
    });
    const datos = await r.json();
    if (r.ok) {
      setNota("");
      setDetalle(datos);
      cargar();
    } else alert(datos.error || "No se pudo cambiar el estado");
  }

  async function borrar(t) {
    if (!window.confirm(`¿Borrar el trámite de ${TIPOS[t.tipo].label.toLowerCase()} del CUPS ${t.cups}?`)) return;
    const r = await fetch(`/api/energia/tramites/${t._id}`, { method: "DELETE" });
    if (r.ok) {
      setDetalle(null);
      cargar();
    } else alert((await r.json()).error || "No se pudo borrar");
  }

  const poner = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const suministroElegido = suministros.find((s) => s._id === form.suministroId);
  const esFinal = (t) => ["activado", "rechazado", "cancelado"].includes(t.estado);

  return (
    <CabeceraPagina titulo="Trámites" descripcion="Altas, cambios de comercializadora, cambios de titular y bajas de suministros.">
      {error && <div className="panel px-4 py-3 text-sm text-rose-400 mb-3">{error}</div>}

      {lista === null ? (
        <div className="panel px-4 py-10 text-center text-slate-500">Cargando…</div>
      ) : lista.length === 0 ? (
        <div className="panel px-6 py-12 text-center space-y-4">
          <p className="text-slate-300 font-medium">Aún no hay trámites abiertos.</p>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            Cuando un cliente acepta el estudio, abre aquí el trámite: <b>alta</b> de un suministro nuevo,
            <b> cambio de comercializadora</b>, <b>cambio de titular</b> o <b>baja</b>. Cada trámite lleva su
            circuito (documentación → enviado → en trámite) y al activarlo actualiza el suministro solo.
          </p>
          <button onClick={abrirNuevo} className="btn-primary inline-block mt-2">Nuevo trámite</button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por CUPS, cliente, comercializadora…" />
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="input w-auto">
              <option value="todos">Tipo: todos</option>
              {Object.entries(TIPOS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="input w-auto">
              <option value="todos">Estado: todos</option>
              {Object.entries(ESTADOS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button onClick={abrirNuevo} className="btn-primary whitespace-nowrap ms-auto">Nuevo trámite</button>
          </div>

          <div className="panel overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>CUPS / Cliente</th>
                  <th>Origen → Destino</th>
                  <th>Estado</th>
                  <th>Fechas</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-500 py-6">
                      Ningún trámite coincide con esos filtros.
                    </td>
                  </tr>
                )}
                {filtrada.map((t) => (
                  <tr key={t._id}>
                    <td><Badge tono={TIPOS[t.tipo].tono}>{TIPOS[t.tipo].label}</Badge></td>
                    <td>
                      <p className="num text-[0.8rem] text-slate-200 whitespace-nowrap">{t.cups}</p>
                      <p className="text-xs text-slate-500 whitespace-nowrap">{t.clienteNombre ?? t.cliente?.nombre ?? "—"}</p>
                    </td>
                    <td className="text-slate-300 text-sm">
                      {t.tipo === "titular" ? (
                        <>
                          {t.clienteNombre ?? t.cliente?.nombre ?? "—"} → <b>{t.nuevoTitularNombre ?? t.nuevoTitular?.nombre ?? "—"}</b>
                        </>
                      ) : t.tipo === "baja" ? (
                        <span className="text-slate-400">Baja del suministro</span>
                      ) : t.tipo === "renovacion" ? (
                        <>
                          {t.comercializadoraOrigen || "—"} →{" "}
                          <b>{t.comercializadoraDestinoNombre ?? t.comercializadoraDestino?.nombre ?? "misma compañía"}</b>
                        </>
                      ) : (
                        <>
                          {t.comercializadoraOrigen || "—"} → <b>{t.comercializadoraDestinoNombre ?? t.comercializadoraDestino?.nombre ?? "—"}</b>
                        </>
                      )}
                    </td>
                    <td><Badge tono={ESTADOS[t.estado].tono}>{ESTADOS[t.estado].label}</Badge></td>
                    <td className="text-xs text-slate-400 num whitespace-nowrap">
                      <p>Solicitud: {fmtFecha(t.fechaSolicitud ?? t.createdAt)}</p>
                      {t.fechaPrevista && <p>Prevista: {fmtFecha(t.fechaPrevista)}</p>}
                      {t.fechaActivacion && <p className="text-emerald-400">Activado: {fmtFecha(t.fechaActivacion)}</p>}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button onClick={() => { setDetalle(t); setNota(""); }} className="p-1.5 text-slate-400 hover:text-sky-400" title="Ver detalle">
                        <IconOjo />
                      </button>
                      {!esFinal(t) && (
                        <button onClick={() => abrirEdicion(t)} className="p-1.5 text-slate-400 hover:text-sky-400" title="Editar">
                          <IconEditar />
                        </button>
                      )}
                      {t.estado !== "activado" && (
                        <button onClick={() => borrar(t)} className="p-1.5 text-slate-400 hover:text-rose-400" title="Borrar">
                          <IconBorrar />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- Modal alta / edición --- */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <form
            className="panel max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <h2 className="text-lg font-bold text-white">{editando ? "Editar trámite" : "Nuevo trámite"}</h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm text-slate-400">
                Tipo de trámite *
                <select value={form.tipo} onChange={poner("tipo")} className="input" disabled={!!editando}>
                  <option value="alta">Alta de suministro</option>
                  <option value="cambio">Cambio de comercializadora</option>
                  <option value="titular">Cambio de titular</option>
                  <option value="renovacion">Renovación (misma compañía)</option>
                  <option value="baja">Baja</option>
                </select>
              </label>
              <label className="text-sm text-slate-400">
                Suministro (CUPS) *
                <select value={form.suministroId} onChange={poner("suministroId")} className="input" disabled={!!editando} required>
                  <option value="">— Selecciona —</option>
                  {suministros.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.cups} — {s.clienteNombre ?? s.cliente?.nombre ?? "sin cliente"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {suministroElegido && !editando && (
              <div className="rounded-xl border border-slate-600/40 p-3 text-xs text-slate-400">
                <p><span className="text-slate-500">Tipo:</span> {suministroElegido.tipo.toUpperCase()} · <span className="text-slate-500">Comercializadora actual:</span> {suministroElegido.comercializadoraNombre ?? "sin asignar"}</p>
              </div>
            )}

            {form.tipo !== "baja" && form.tipo !== "titular" && (
              <label className="text-sm text-slate-400 block">
                Comercializadora de destino {form.tipo === "renovacion" ? "" : "*"}
                <select
                  value={form.comercializadoraDestinoId}
                  onChange={poner("comercializadoraDestinoId")}
                  className="input"
                  required={form.tipo !== "renovacion"}
                >
                  {form.tipo === "renovacion" && <option value="">— Mantener la actual —</option>}
                  {form.tipo !== "renovacion" && <option value="">— Selecciona —</option>}
                  {comercializadoras.map((c) => (
                    <option key={c._id} value={c._id}>{c.nombre}</option>
                  ))}
                </select>
                {form.tipo === "renovacion" && (
                  <span className="text-xs text-slate-500">
                    Solo si la renovación es con otra compañía; con la misma, déjalo en «Mantener la actual».
                  </span>
                )}
              </label>
            )}

            {form.tipo === "renovacion" && (
              <div className="rounded-xl border border-slate-600/40 p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium text-slate-300">Datos a actualizar con la renovación</p>
                  <p className="text-xs text-slate-500">
                    Rellena solo lo que cambie: teléfono y correo van a la ficha del cliente; el resto, al suministro.
                    Al activar el trámite, la fecha de alta pasa a ser la de activación y el aviso de renovación
                    volverá a saltar al año siguiente.
                  </p>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className="text-sm text-slate-400">
                    Teléfono del cliente
                    <input
                      value={form.cambios.telefono}
                      onChange={(e) => setForm((f) => ({ ...f, cambios: { ...f.cambios, telefono: e.target.value } }))}
                      className="input"
                    />
                  </label>
                  <label className="text-sm text-slate-400">
                    Correo del cliente
                    <input
                      value={form.cambios.email}
                      onChange={(e) => setForm((f) => ({ ...f, cambios: { ...f.cambios, email: e.target.value } }))}
                      className="input"
                    />
                  </label>
                  <label className="text-sm text-slate-400">
                    Nueva tarifa
                    <input
                      value={form.cambios.tarifa}
                      onChange={(e) => setForm((f) => ({ ...f, cambios: { ...f.cambios, tarifa: e.target.value } }))}
                      className="input"
                      placeholder="2.0TD, 3.0TD…"
                    />
                  </label>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className="text-sm text-slate-400">
                    Consumo anual (kWh)
                    <input
                      value={form.cambios.consumoAnual}
                      onChange={(e) => setForm((f) => ({ ...f, cambios: { ...f.cambios, consumoAnual: e.target.value } }))}
                      className="input num"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="text-sm text-slate-400">
                    Nuevo fin de contrato
                    <input
                      type="date"
                      value={form.cambios.fechaFin}
                      onChange={(e) => setForm((f) => ({ ...f, cambios: { ...f.cambios, fechaFin: e.target.value } }))}
                      className="input"
                    />
                  </label>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="text-sm text-slate-400">
                    Dirección del suministro (calle)
                    <input
                      value={form.cambios.calle}
                      onChange={(e) => setForm((f) => ({ ...f, cambios: { ...f.cambios, calle: e.target.value } }))}
                      className="input"
                    />
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-sm text-slate-400">
                      CP
                      <input
                        value={form.cambios.cp}
                        onChange={(e) => setForm((f) => ({ ...f, cambios: { ...f.cambios, cp: e.target.value } }))}
                        className="input"
                      />
                    </label>
                    <label className="text-sm text-slate-400">
                      Ciudad
                      <input
                        value={form.cambios.ciudad}
                        onChange={(e) => setForm((f) => ({ ...f, cambios: { ...f.cambios, ciudad: e.target.value } }))}
                        className="input"
                      />
                    </label>
                    <label className="text-sm text-slate-400">
                      Provincia
                      <input
                        value={form.cambios.provincia}
                        onChange={(e) => setForm((f) => ({ ...f, cambios: { ...f.cambios, provincia: e.target.value } }))}
                        className="input"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {form.tipo === "titular" && (
              <label className="text-sm text-slate-400 block">
                Nuevo titular *
                <select value={form.nuevoTitularId} onChange={poner("nuevoTitularId")} className="input" required>
                  <option value="">— Selecciona —</option>
                  {clientes.map((c) => (
                    <option key={c._id} value={c._id}>{c.nombre}</option>
                  ))}
                </select>
                <span className="text-xs text-slate-500">El cliente de la cartera que pasa a ser titular del suministro.</span>
              </label>
            )}

            <label className="text-sm text-slate-400 block sm:w-1/2">
              Fecha prevista de activación
              <input type="date" value={form.fechaPrevista} onChange={poner("fechaPrevista")} className="input" />
            </label>

            <label className="text-sm text-slate-400 block">
              Notas
              <textarea value={form.notas} onChange={poner("notas")} className="input" rows={2} placeholder="Documentación pendiente, condiciones pactadas…" />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
              <button type="submit" className="btn-primary">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* --- Modal detalle + circuito --- */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetalle(null)}>
          <div className="panel max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {TIPOS[detalle.tipo].label} · {detalle.cups}
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  {detalle.clienteNombre ?? detalle.cliente?.nombre ?? "—"}
                  {detalle.tipo === "titular" && (
                    <> → <b className="text-slate-200">{detalle.nuevoTitularNombre ?? detalle.nuevoTitular?.nombre}</b></>
                  )}
                </p>
              </div>
              <Badge tono={ESTADOS[detalle.estado].tono}>{ESTADOS[detalle.estado].label}</Badge>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-slate-600/40 p-3 space-y-1">
                {detalle.tipo !== "titular" && detalle.tipo !== "baja" && (
                  <p><span className="text-slate-500">Destino:</span> {detalle.comercializadoraDestinoNombre ?? detalle.comercializadoraDestino?.nombre ?? "—"}</p>
                )}
                {detalle.comercializadoraOrigen && detalle.tipo === "cambio" && (
                  <p><span className="text-slate-500">Origen:</span> {detalle.comercializadoraOrigen}</p>
                )}
                <p><span className="text-slate-500">Solicitud:</span> {fmtFecha(detalle.fechaSolicitud ?? detalle.createdAt)}</p>
                {detalle.fechaEnvio && <p><span className="text-slate-500">Enviado:</span> {fmtFecha(detalle.fechaEnvio)}</p>}
                {detalle.fechaPrevista && <p><span className="text-slate-500">Prevista:</span> {fmtFecha(detalle.fechaPrevista)}</p>}
                {detalle.fechaActivacion && <p className="text-emerald-400"><span className="text-slate-500">Activado:</span> {fmtFecha(detalle.fechaActivacion)}</p>}
              </div>
              {detalle.notas && (
                <div className="rounded-xl border border-slate-600/40 p-3">
                  <p className="text-slate-500 mb-1">Notas</p>
                  <p className="text-slate-300 whitespace-pre-line">{detalle.notas}</p>
                </div>
              )}
            </div>

            {/* Renovación: datos que se aplican al activar */}
            {detalle.tipo === "renovacion" && detalle.cambios && Object.keys(detalle.cambios).length > 0 && (
              <div className="rounded-xl border border-orange-400/30 bg-orange-400/5 p-3 text-sm space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-300 mb-1">
                  Datos a actualizar al activar
                </p>
                {detalle.cambios.telefono && <p><span className="text-slate-500">Teléfono:</span> {detalle.cambios.telefono}</p>}
                {detalle.cambios.email && <p><span className="text-slate-500">Correo:</span> {detalle.cambios.email}</p>}
                {detalle.cambios.tarifa && <p><span className="text-slate-500">Nueva tarifa:</span> {detalle.cambios.tarifa}</p>}
                {detalle.cambios.consumoAnual != null && (
                  <p><span className="text-slate-500">Consumo anual:</span> {Number(detalle.cambios.consumoAnual).toLocaleString("es-ES")} kWh</p>
                )}
                {detalle.cambios.fechaFin && <p><span className="text-slate-500">Nuevo fin de contrato:</span> {fmtFecha(detalle.cambios.fechaFin)}</p>}
                {detalle.cambios.calle && (
                  <p>
                    <span className="text-slate-500">Dirección:</span>{" "}
                    {[detalle.cambios.calle, detalle.cambios.cp, detalle.cambios.ciudad, detalle.cambios.provincia].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Historial del circuito */}
            <div className="rounded-xl border border-slate-600/40 p-4">
              <p className="text-sm font-semibold text-slate-300 mb-2">Historial</p>
              <ol className="space-y-2">
                {(detalle.historia ?? []).slice().reverse().map((h, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="num text-xs text-slate-500 w-24 pt-0.5 shrink-0">
                      {new Date(h.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                    </span>
                    <span className="flex-1">
                      <Badge tono={ESTADOS[h.estado]?.tono ?? "bg-slate-400/10 text-slate-400 border-slate-400/30"}>
                        {ESTADOS[h.estado]?.label ?? h.estado}
                      </Badge>
                      {h.nota && <span className="text-slate-400 ml-2">{h.nota}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Acciones del circuito */}
            {!esFinal(detalle) && (
              <div className="space-y-3">
                <label className="text-sm text-slate-400 block">
                  Nota para el siguiente cambio de estado (opcional)
                  <input value={nota} onChange={(e) => setNota(e.target.value)} className="input" placeholder="P. ej. «firmado por el cliente» o «falta el justificante»" />
                </label>
                <div className="flex flex-wrap gap-2">
                  {detalle.estado === "documentacion" && (
                    <button onClick={() => cambiarEstado(detalle, "enviado")} className="btn-ghost">Marcar enviado</button>
                  )}
                  {detalle.estado === "enviado" && (
                    <button onClick={() => cambiarEstado(detalle, "en_tramite")} className="btn-ghost">En trámite</button>
                  )}
                  <button onClick={() => cambiarEstado(detalle, "activado")} className="btn-primary">Activar</button>
                  <button onClick={() => cambiarEstado(detalle, "rechazado")} className="btn-ghost text-rose-300 border-rose-400/30 hover:border-rose-400/60">Rechazar</button>
                  <button onClick={() => cambiarEstado(detalle, "cancelado")} className="btn-ghost">Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </CabeceraPagina>
  );
}
