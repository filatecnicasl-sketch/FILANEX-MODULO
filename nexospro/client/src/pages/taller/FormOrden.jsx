import { useEffect, useState } from "react";
import EditorLineas, { lineaVacia } from "../../components/EditorLineas.jsx";
import SelectorContacto from "../../components/SelectorContacto.jsx";
import BuscadorEntidad from "../../components/BuscadorEntidad.jsx";
import { enterComoTab } from "../../utils/enter-tab.js";
import { ESTADOS_OT, TRABAJOS_TALLER, aFechaInput } from "./datos.js";

const campo = "input w-full";

// Horas invertidas en la orden (se registran tras guardarla). Alimentan el
// informe de Taller → Operarios (horas facturadas vs invertidas).
function SeccionTiempos({ ordenId, tiempos, lineas, onCambio }) {
  const [operarios, setOperarios] = useState([]);
  const [form, setForm] = useState({ operarioId: "", horas: "", nota: "" });
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/taller/operarios")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => setOperarios(Array.isArray(lista) ? lista : []))
      .catch(() => setOperarios([]));
  }, []);

  async function anadir(e) {
    e.preventDefault();
    setError(null);
    try {
      const r = await fetch(`/api/taller/ordenes/${ordenId}/tiempos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operarioId: form.operarioId, horas: Number(form.horas), nota: form.nota }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al registrar");
      setForm({ operarioId: "", horas: "", nota: "" });
      onCambio(datos.tiempos ?? []);
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function quitar(tiempoId) {
    const r = await fetch(`/api/taller/ordenes/${ordenId}/tiempos/${tiempoId}`, { method: "DELETE" });
    if (r.ok) onCambio((await r.json()).tiempos ?? []);
  }

  const totalHoras = tiempos.reduce((s, t) => s + (Number(t.horas) || 0), 0);
  const horasMO = lineas
    .filter((l) => l.tipo === "mano_obra")
    .reduce((s, l) => s + (Number(l.cantidad) || 0), 0);

  return (
    <fieldset className="rounded-lg border border-white/10 p-3 space-y-2">
      <legend className="text-[0.6875rem] uppercase tracking-wider text-slate-500 px-1">
        Tiempos de taller
      </legend>

      {tiempos.length > 0 && (
        <ul className="space-y-1">
          {tiempos.map((t) => (
            <li key={t._id} className="flex items-center gap-2 text-xs text-slate-300">
              <span className="num text-slate-500">{new Date(t.fecha).toLocaleDateString("es-ES")}</span>
              <span className="font-semibold">{t.operarioNombre ?? "—"}</span>
              <span className="num font-semibold">{t.horas} h</span>
              {t.nota && <span className="text-slate-500 truncate">· {t.nota}</span>}
              <button
                type="button"
                onClick={() => quitar(t._id)}
                className="ml-auto text-slate-500 hover:text-red-300"
                title="Quitar"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-[1fr_90px_1fr_auto] gap-2 items-end">
        <select
          className={campo}
          value={form.operarioId}
          onChange={(e) => setForm((f) => ({ ...f, operarioId: e.target.value }))}
        >
          <option value="" disabled>— Operario —</option>
          {operarios.filter((op) => op.activo).map((op) => (
            <option key={op._id} value={op._id}>{op.nombre}</option>
          ))}
        </select>
        <input
          type="number" min="0.25" step="0.25" placeholder="Horas"
          className={`${campo} text-right`}
          value={form.horas}
          onChange={(e) => setForm((f) => ({ ...f, horas: e.target.value }))}
        />
        <input
          placeholder="Nota (opcional)"
          className={campo}
          value={form.nota}
          onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
        />
        <button
          type="button"
          onClick={anadir}
          disabled={!form.operarioId || !form.horas}
          className="btn-ghost !py-2 !px-3.5 text-xs whitespace-nowrap disabled:opacity-50"
        >
          + Registrar
        </button>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <p className="text-[0.6875rem] text-slate-500">
        Invertidas: <span className="num font-semibold text-slate-300">{totalHoras} h</span>
        {" · "}M. obra en la orden: <span className="num font-semibold text-slate-300">{horasMO} h</span>
        {operarios.length === 0 && (
          <span className="text-amber-400"> — sin operarios: date de alta en Taller → Operarios</span>
        )}
      </p>
    </fieldset>
  );
}

// Orden de trabajo completa (alta y edición): vehículo, cliente, tipo de
// trabajo, fechas, descripción, líneas (MO/material), compañía aseguradora
// y notas internas. La recepción rápida sigue existiendo para el pase exprés.
export default function FormOrden({ orden, onCerrar, onGuardada }) {
  const editando = Boolean(orden?._id);
  const [vehiculos, setVehiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [aseguradoras, setAseguradoras] = useState([]);
  const [creandoVehiculo, setCreandoVehiculo] = useState(false);
  const [nuevoVehiculo, setNuevoVehiculo] = useState({ matricula: "", marca: "", modelo: "" });
  const [form, setForm] = useState(() => ({
    vehiculoId: orden?.vehiculo?._id ?? orden?.vehiculo ?? "",
    clienteId: orden?.cliente?._id ?? orden?.cliente ?? "",
    telefono: orden?.telefono ?? "",
    trabajos: orden?.trabajos ?? [],
    fechaEntrada: aFechaInput(orden?.fechaEntrada ?? new Date()),
    fechaEntregaPrevista: orden?.fechaEntregaPrevista ? aFechaInput(orden.fechaEntregaPrevista) : "",
    km: orden?.km ?? "",
    estado: orden?.estado ?? "recepcion",
    motivo: orden?.motivo ?? "",
    notasInternas: orden?.notasInternas ?? "",
    aseguradora: orden?.aseguradora?._id ?? orden?.aseguradora ?? "",
    numeroSiniestro: orden?.numeroSiniestro ?? "",
    facturarA: orden?.facturarA ?? "cliente",
    presupuestos: [...new Set([
      ...(orden?.presupuestos ?? []).map((p) => String(p?._id ?? p)),
      orden?.presupuesto ? String(orden.presupuesto?._id ?? orden.presupuesto) : null,
    ].filter(Boolean))],
  }));
  const [presupuestos, setPresupuestos] = useState([]); // abiertos del cliente (vinculables)
  const [lineas, setLineas] = useState(() =>
    orden?.lineas?.length ? orden.lineas.map((l) => ({ ...l })) : [{ ...lineaVacia(), tipo: "mano_obra" }]
  );
  const [tiempos, setTiempos] = useState(() => orden?.tiempos ?? []);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const poner = (c, v) => setForm((f) => ({ ...f, [c]: v }));

  useEffect(() => {
    fetch("/api/taller/vehiculos").then((r) => (r.ok ? r.json() : [])).then(setVehiculos).catch(() => setVehiculos([]));
    fetch("/api/clientes").then((r) => (r.ok ? r.json() : [])).then(setClientes).catch(() => setClientes([]));
    fetch("/api/taller/aseguradoras").then((r) => (r.ok ? r.json() : [])).then(setAseguradoras).catch(() => setAseguradoras([]));
  }, []);

  // Presupuestos abiertos del cliente elegido (se excluye esta orden para
  // poder conservar el que ya tiene vinculado).
  useEffect(() => {
    if (!form.clienteId) {
      setPresupuestos([]);
      return;
    }
    let vivo = true;
    const extra = editando ? `&excluirOrden=${orden._id}` : "";
    fetch(`/api/taller/presupuestos-abiertos?cliente=${form.clienteId}${extra}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => vivo && setPresupuestos(Array.isArray(lista) ? lista : []))
      .catch(() => vivo && setPresupuestos([]));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.clienteId]);

  // Al elegir vehículo: arrastra su cliente si lo tiene. Si el cliente
  // cambia, se descarta el presupuesto elegido (sería de otro cliente).
  function elegirVehiculo(id) {
    const v = vehiculos.find((x) => x._id === id);
    setForm((f) => {
      const siguiente = { ...f, vehiculoId: id };
      if (v?.cliente) siguiente.clienteId = v.cliente;
      if (String(siguiente.clienteId ?? "") !== String(f.clienteId ?? "")) siguiente.presupuestos = [];
      return siguiente;
    });
  }

  function elegirCliente(id) {
    const c = clientes.find((x) => x._id === id);
    setForm((f) => ({ ...f, clienteId: id, telefono: c?.telefono ?? f.telefono, presupuestos: [] }));
  }

  function alternarPresupuesto(p) {
    const id = String(p._id);
    const marcado = form.presupuestos.includes(id);
    if (marcado) {
      setForm((f) => ({ ...f, presupuestos: f.presupuestos.filter((x) => x !== id) }));
      return;
    }
    const nuevas = (p.lineas ?? []).filter((l) => l.descripcion).map((l) => ({ ...l }));
    const actuales = lineas.filter((l) => l.descripcion);
    if (nuevas.length > 0 && actuales.length > 0 &&
        !window.confirm(`La orden ya tiene ${actuales.length} línea(s). ¿Añadir las ${nuevas.length} del presupuesto ${p.serieNumero}?`)) {
      return;
    }
    setForm((f) => ({ ...f, presupuestos: [...f.presupuestos, id] }));
    if (nuevas.length > 0) setLineas([...actuales, ...nuevas]);
  }

  function alternarTrabajo(t) {
    poner("trabajos", form.trabajos.includes(t) ? form.trabajos.filter((x) => x !== t) : [...form.trabajos, t]);
  }

  async function crearVehiculo() {
    const r = await fetch("/api/taller/vehiculos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matricula: nuevoVehiculo.matricula.toUpperCase().trim(),
        marca: nuevoVehiculo.marca.trim() || undefined,
        modelo: nuevoVehiculo.modelo.trim() || undefined,
        cliente: form.clienteId || undefined,
        clienteNombre: clientes.find((c) => c._id === form.clienteId)?.nombre,
      }),
    });
    const datos = await r.json();
    if (!r.ok) throw new Error(datos.error || "No se pudo crear el vehículo");
    setVehiculos((vs) => [...vs, datos].sort((a, b) => a.matricula.localeCompare(b.matricula)));
    setForm((f) => ({ ...f, vehiculoId: datos._id }));
    setCreandoVehiculo(false);
    setNuevoVehiculo({ matricula: "", marca: "", modelo: "" });
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const vehiculo = vehiculos.find((v) => v._id === form.vehiculoId);
      if (!vehiculo) throw new Error("Elige el vehículo");
      const cliente = clientes.find((c) => c._id === form.clienteId);
      const cuerpo = {
        vehiculo: vehiculo._id,
        matricula: vehiculo.matricula,
        cliente: cliente?._id,
        clienteNombre: cliente?.nombre ?? vehiculo.clienteNombre,
        telefono: form.telefono.trim() || undefined,
        trabajos: form.trabajos,
        motivo: form.motivo.trim() || undefined,
        notasInternas: form.notasInternas.trim() || undefined,
        km: form.km === "" ? undefined : Number(form.km),
        estado: form.estado,
        fechaEntrada: form.fechaEntrada || undefined,
        fechaEntregaPrevista: form.fechaEntregaPrevista || undefined,
        lineas: lineas.filter((l) => l.descripcion),
        aseguradora: form.aseguradora || null,
        numeroSiniestro: form.numeroSiniestro.trim() || undefined,
        facturarA: form.aseguradora ? form.facturarA : "cliente",
        presupuesto: form.presupuestos[0] || null,
        presupuestos: form.presupuestos,
      };
      const r = await fetch(editando ? `/api/taller/ordenes/${orden._id}` : "/api/taller/ordenes", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo guardar la orden");
      onGuardada(datos);
    } catch (e2) {
      setError(e2.message);
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="modal-panel w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              {editando ? `Orden ${orden.numero}` : "Nueva orden de trabajo"}
            </h2>
            <p className="text-sm text-slate-400">
              {editando ? `${orden.matricula} · ${orden.clienteNombre ?? "sin cliente"}` : "Todos los datos de la reparación."}
            </p>
          </div>
          <button onClick={onCerrar} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <form onSubmit={guardar} onKeyDown={enterComoTab} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Vehículo *</label>
              {creandoVehiculo ? (
                <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 space-y-2">
                  <input
                    autoFocus
                    placeholder="Matrícula *"
                    value={nuevoVehiculo.matricula}
                    onChange={(e) => setNuevoVehiculo((v) => ({ ...v, matricula: e.target.value.toUpperCase() }))}
                    className={`${campo} uppercase`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="Marca"
                      value={nuevoVehiculo.marca}
                      onChange={(e) => setNuevoVehiculo((v) => ({ ...v, marca: e.target.value }))}
                      className={campo}
                    />
                    <input
                      placeholder="Modelo"
                      value={nuevoVehiculo.modelo}
                      onChange={(e) => setNuevoVehiculo((v) => ({ ...v, modelo: e.target.value }))}
                      className={campo}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => crearVehiculo().catch((e2) => setError(e2.message))}
                      disabled={!nuevoVehiculo.matricula.trim()}
                      className="btn-primary !py-1.5 !px-3.5 text-xs disabled:opacity-50"
                    >
                      Crear y seleccionar
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreandoVehiculo(false)}
                      className="text-xs text-slate-500 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <BuscadorEntidad
                    opciones={vehiculos.map((v) => ({
                      _id: v._id,
                      nombre: `${v.matricula}${[v.marca, v.modelo].filter(Boolean).length ? ` — ${[v.marca, v.modelo].filter(Boolean).join(" ")}` : ""}`,
                      secundario: v.clienteNombre,
                    }))}
                    valorId={form.vehiculoId}
                    onElegir={(op) => elegirVehiculo(op?._id ?? "")}
                    placeholder="Buscar por matrícula…"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setCreandoVehiculo(true)}
                    title="Dar de alta un vehículo nuevo"
                    className="shrink-0 rounded-lg border border-accent/50 text-accent text-xs font-semibold px-3 hover:bg-accent/10 transition-colors"
                  >
                    + Nuevo
                  </button>
                </div>
              )}
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Fecha de entrada</label>
              <input type="date" className={campo} value={form.fechaEntrada} onChange={(e) => poner("fechaEntrada", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Entrega estimada</label>
              <input type="date" className={campo} value={form.fechaEntregaPrevista} onChange={(e) => poner("fechaEntregaPrevista", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">KM</label>
              <input type="number" min="0" className={campo} value={form.km} onChange={(e) => poner("km", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Estado</label>
              <select className={campo} value={form.estado} onChange={(e) => poner("estado", e.target.value)}>
                {ESTADOS_OT.map((e2) => (
                  <option key={e2.clave} value={e2.clave}>{e2.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1">Tipo de trabajo</label>
            <div className="flex gap-2">
              {TRABAJOS_TALLER.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => alternarTrabajo(t)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    form.trabajos.includes(t)
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-white/10 text-slate-400 hover:border-white/25"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1">Descripción del trabajo</label>
            <textarea
              className={`${campo} resize-none`}
              rows={2}
              value={form.motivo}
              onChange={(e) => poner("motivo", e.target.value)}
            />
          </div>

          {(presupuestos.length > 0 || form.presupuestos.length > 0) && (
            <fieldset className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
              <legend className="text-xs uppercase tracking-wider text-violet-300 px-1">Presupuestos vinculados</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {presupuestos.map((p) => (
                  <label key={p._id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-violet-400/20 px-3 py-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.presupuestos.includes(String(p._id))}
                      onChange={() => alternarPresupuesto(p)}
                    />
                    <span>{p.serieNumero} · {new Date(p.fecha).toLocaleDateString("es-ES")} · {p.total?.toFixed(2)} €</span>
                  </label>
                ))}
                {form.presupuestos
                  .filter((id) => !presupuestos.some((p) => String(p._id) === id))
                  .map((id, indice) => (
                    <label key={id} className="flex items-center gap-2 rounded-lg border border-violet-400/20 px-3 py-2 text-sm text-slate-300">
                      <input type="checkbox" checked onChange={() => setForm((f) => ({ ...f, presupuestos: f.presupuestos.filter((x) => x !== id) }))} />
                      <span>{orden?.presupuestosNumeros?.[indice] ?? orden?.presupuestoNumero ?? "Presupuesto vinculado"}</span>
                    </label>
                  ))}
              </div>
              {form.presupuestos.length > 0 && (
                <p className="text-[0.6875rem] text-violet-300/80 mt-1.5">
                  Los presupuestos seleccionados quedan vinculados y aceptados; al facturar la orden se marcan facturados.
                </p>
              )}
            </fieldset>
          )}

          <EditorLineas lineas={lineas} setLineas={setLineas} conTipo conGrupo gruposSugeridos={form.trabajos} />

          <fieldset className="rounded-xl border border-white/10 p-3">
            <legend className="text-xs uppercase tracking-wider text-slate-500 px-1">Compañía aseguradora</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Aseguradora</label>
                <select
                  className={campo}
                  value={form.aseguradora}
                  onChange={(e) => setForm((f) => ({ ...f, aseguradora: e.target.value, facturarA: e.target.value ? f.facturarA : "cliente" }))}
                >
                  <option value="">Particular</option>
                  {aseguradoras.map((a) => (
                    <option key={a._id} value={a._id}>{a.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Nº de siniestro</label>
                <input
                  className={campo}
                  value={form.numeroSiniestro}
                  onChange={(e) => poner("numeroSiniestro", e.target.value)}
                  disabled={!form.aseguradora}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Facturar a</label>
                <select
                  className={campo}
                  value={form.facturarA}
                  onChange={(e) => poner("facturarA", e.target.value)}
                  disabled={!form.aseguradora}
                >
                  <option value="cliente">Cliente</option>
                  <option value="aseguradora">Compañía</option>
                </select>
              </div>
            </div>
          </fieldset>

          {editando && (
            <SeccionTiempos ordenId={orden._id} tiempos={tiempos} lineas={lineas} onCambio={setTiempos} />
          )}

          <div>
            <label className="text-sm text-slate-400 block mb-1">Notas internas</label>
            <textarea
              className={`${campo} resize-none`}
              rows={2}
              value={form.notasInternas}
              onChange={(e) => poner("notasInternas", e.target.value)}
              placeholder="No salen en los impresos"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary disabled:opacity-50">
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar orden"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
