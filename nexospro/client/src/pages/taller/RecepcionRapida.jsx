import { useEffect, useState } from "react";
import { TRABAJOS_TALLER, aFechaInput } from "./datos.js";
import SelectorContacto from "../../components/SelectorContacto.jsx";
import BuscadorEntidad from "../../components/BuscadorEntidad.jsx";
import { coincideBusqueda, euros } from "../../components/ui.jsx";

const campo = "input w-full";
const normalizar = (s) => (s ?? "").toString().trim().toLowerCase();

/**
 * Recepción exprés: alta del vehículo (si no existe) y apertura de la OT
 * en un solo paso. Si el vehículo viene con cita, se busca arriba y la
 * recepción se rellena sola; al crearla, la cita queda realizada.
 */
export default function RecepcionRapida({ onCerrar, onCreada }) {
  const [clientes, setClientes] = useState([]);
  const [citas, setCitas] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [buscaCita, setBuscaCita] = useState("");
  const [citaElegida, setCitaElegida] = useState(null);
  const [form, setForm] = useState({
    matricula: "",
    marca: "",
    modelo: "",
    km: "",
    clienteId: "",
    nombreCliente: "",
    telefono: "",
    motivo: "",
  });
  const [trabajos, setTrabajos] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]); // abiertos del cliente elegido
  const [presupuestoId, setPresupuestoId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => r.json())
      .then(setClientes)
      .catch(() => setClientes([]));
    fetch("/api/taller/citas")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCitas)
      .catch(() => setCitas([]));
    fetch("/api/taller/vehiculos")
      .then((r) => (r.ok ? r.json() : []))
      .then(setVehiculos)
      .catch(() => setVehiculos([]));
  }, []);

  // Al cambiar el cliente se buscan sus presupuestos abiertos (borrador,
  // enviado o aceptado y sin OT vinculada) para incluir uno en la orden.
  useEffect(() => {
    setPresupuestoId("");
    if (!form.clienteId) {
      setPresupuestos([]);
      return;
    }
    let vivo = true;
    fetch(`/api/taller/presupuestos-abiertos?cliente=${form.clienteId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => {
        if (vivo) setPresupuestos(Array.isArray(lista) ? lista : []);
      })
      .catch(() => vivo && setPresupuestos([]));
    return () => {
      vivo = false;
    };
  }, [form.clienteId]);

  // Citas pendientes de recepcionar: las de hoy como acceso directo y el
  // buscador para cualquier otra (por matrícula, cliente, teléfono, motivo…).
  const pendientes = citas.filter((c) => !["realizada", "cancelada"].includes(c.estado));
  const hoy = aFechaInput(new Date());
  const citasHoy = pendientes.filter((c) => aFechaInput(c.fecha) === hoy);
  const citasFiltradas = buscaCita.trim()
    ? pendientes
        .filter((c) =>
          coincideBusqueda(
            buscaCita,
            c.matricula,
            c.clienteNombre,
            c.telefono,
            c.motivo,
            c.hora,
            new Date(c.fecha).toLocaleDateString("es-ES")
          )
        )
        .slice(0, 8)
    : [];

  function actualizar(campoNombre, valor) {
    setForm((f) => ({ ...f, [campoNombre]: valor }));
  }

  // Elegir una cita rellena la recepción con sus datos (y los del vehículo
  // y del cliente de la cartera si ya existen). Si no se identifica cliente,
  // se limpia el anterior para no ofrecer presupuestos de otro.
  function elegirCita(c) {
    setCitaElegida(c);
    setBuscaCita("");
    const veh = vehiculos.find((v) => normalizar(v.matricula) === normalizar(c.matricula));
    const cli =
      clientes.find((x) => String(x._id) === String(veh?.cliente)) ??
      clientes.find((x) => normalizar(x.nombre) === normalizar(c.clienteNombre));
    setForm((f) => ({
      ...f,
      matricula: c.matricula || f.matricula,
      marca: veh?.marca ?? f.marca,
      modelo: veh?.modelo ?? f.modelo,
      km: veh?.km ?? f.km,
      clienteId: cli?._id ?? "",
      nombreCliente: cli?.nombre ?? c.clienteNombre ?? f.nombreCliente,
      telefono: c.telefono || cli?.telefono || f.telefono,
      motivo: c.motivo || f.motivo,
    }));
  }

  function quitarCita() {
    setCitaElegida(null);
  }

  // Al elegir cliente de la cartera se rellenan nombre y teléfono solos.
  function elegirCliente(id) {
    const c = clientes.find((x) => x._id === id);
    setForm((f) => ({
      ...f,
      clienteId: id,
      nombreCliente: c?.nombre ?? f.nombreCliente,
      telefono: c?.telefono ?? f.telefono,
    }));
  }

  function alternarTrabajo(t) {
    setTrabajos((lista) =>
      lista.includes(t) ? lista.filter((x) => x !== t) : [...lista, t]
    );
  }

  async function crear(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch("/api/taller/recepcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula: form.matricula,
          marca: form.marca || undefined,
          modelo: form.modelo || undefined,
          km: form.km ? Number(form.km) : undefined,
          clienteId: form.clienteId || undefined,
          nombreCliente: form.nombreCliente || undefined,
          telefono: form.telefono || undefined,
          trabajos,
          motivo: form.motivo || undefined,
          presupuestoId: presupuestoId || undefined,
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo crear la recepción");
      // La cita que origina la recepción queda realizada automáticamente.
      if (citaElegida) {
        await fetch(`/api/taller/citas/${citaElegida._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: "realizada" }),
        }).catch(() => {});
      }
      onCreada(datos);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-1">Recepción rápida</h2>
        <p className="text-sm text-slate-400 mb-5">
          Alta exprés del vehículo y apertura de la orden de trabajo en un paso.
        </p>

        <form onSubmit={crear} className="space-y-4">
          {/* Entrada por cita: las de hoy como acceso rápido y buscador para el resto */}
          {!citaElegida ? (
            <div className="rounded-xl border border-sky-300 bg-sky-50 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
                ¿Viene con cita?
              </p>
              {citasHoy.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {citasHoy.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => elegirCita(c)}
                      className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm text-sky-800 hover:bg-sky-100 transition"
                    >
                      <span className="font-semibold">{c.hora}</span>
                      {c.matricula && <span className="font-bold"> · {c.matricula}</span>}
                      {c.clienteNombre && <span className="text-sky-600"> · {c.clienteNombre}</span>}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  type="search"
                  className={campo}
                  value={buscaCita}
                  onChange={(e) => setBuscaCita(e.target.value)}
                  placeholder="Buscar otra cita por matrícula, cliente, teléfono, motivo…"
                />
                {citasFiltradas.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {citasFiltradas.map((c) => (
                      <li key={c._id}>
                        <button
                          type="button"
                          onClick={() => elegirCita(c)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition"
                        >
                          <span className="text-slate-500">
                            {new Date(c.fecha).toLocaleDateString("es-ES")} {c.hora}
                          </span>
                          {c.matricula && <span className="font-bold text-slate-800"> · {c.matricula}</span>}
                          {c.clienteNombre && <span className="text-slate-600"> · {c.clienteNombre}</span>}
                          {c.motivo && <span className="block text-xs text-slate-400 truncate">{c.motivo}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {buscaCita.trim() && citasFiltradas.length === 0 && (
                  <p className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">
                    Sin citas pendientes que coincidan.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-sky-300 bg-sky-50 px-3 py-2">
              <p className="text-sm text-sky-800">
                Cita del {new Date(citaElegida.fecha).toLocaleDateString("es-ES")} {citaElegida.hora}
                {citaElegida.matricula && <span className="font-bold"> · {citaElegida.matricula}</span>}
                {citaElegida.clienteNombre && <span> · {citaElegida.clienteNombre}</span>}
                <span className="text-sky-600"> — se marcará realizada al crear la recepción</span>
              </p>
              <button type="button" onClick={quitarCita} className="text-sky-700 hover:text-sky-900 text-sm ml-3">
                × Quitar
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="text-sm text-slate-400 block mb-1">Matrícula *</label>
              <BuscadorEntidad
                opciones={vehiculos
                  .filter((v) => v.tipo !== "cortesia")
                  .map((v) => ({
                    _id: v._id,
                    nombre: v.matricula,
                    secundario: [v.clienteNombre, v.marca, v.modelo].filter(Boolean).join(" · ") || undefined,
                  }))}
                valorTexto={form.matricula}
                onTexto={(t) => actualizar("matricula", t.toUpperCase())}
                onElegir={(op) => {
                  if (!op) return;
                  const v = vehiculos.find((x) => String(x._id) === String(op._id));
                  const cli = clientes.find(
                    (c) => String(c._id) === String(v?.cliente) || normalizar(c.nombre) === normalizar(v?.clienteNombre)
                  );
                  setForm((f) => ({
                    ...f,
                    matricula: op.nombre,
                    marca: v?.marca ?? f.marca,
                    modelo: v?.modelo ?? f.modelo,
                    km: v?.km ?? f.km,
                    // El cliente manda el vehículo: si no lo trae, se limpia
                    // para no ofrecer presupuestos de otro cliente.
                    clienteId: cli?._id ?? "",
                    nombreCliente: cli?.nombre ?? v?.clienteNombre ?? f.nombreCliente,
                    telefono: cli?.telefono ?? f.telefono,
                  }));
                }}
                placeholder="Buscar por matrícula o escribir nueva…"
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Marca</label>
              <input className={campo} value={form.marca} onChange={(e) => actualizar("marca", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Modelo</label>
              <input className={campo} value={form.modelo} onChange={(e) => actualizar("modelo", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Cliente existente</label>
              <SelectorContacto
                tipo="cliente"
                contactos={clientes}
                valor={form.clienteId}
                onChange={elegirCliente}
                onCreado={(c) => setClientes((cs) => [...cs, c])}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Nombre cliente</label>
              <input
                className={campo}
                value={form.nombreCliente}
                onChange={(e) => actualizar("nombreCliente", e.target.value)}
                disabled={!!form.clienteId}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Teléfono</label>
              <input className={campo} value={form.telefono} onChange={(e) => actualizar("telefono", e.target.value)} />
            </div>
          </div>

          {/* Presupuesto abierto del cliente: se incluye en la orden y sus
              líneas se cargan solas; el presupuesto queda aceptado. */}
          {form.clienteId && presupuestos.length > 0 && (
            <div className="rounded-xl border border-violet-300 bg-violet-50 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                Este cliente tiene {presupuestos.length === 1 ? "un presupuesto abierto" : `${presupuestos.length} presupuestos abiertos`}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPresupuestoId("")}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    !presupuestoId
                      ? "border-violet-500 bg-violet-600 text-white font-semibold"
                      : "border-violet-300 bg-white text-violet-800 hover:bg-violet-100"
                  }`}
                >
                  Sin presupuesto
                </button>
                {presupuestos.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => setPresupuestoId(p._id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      presupuestoId === p._id
                        ? "border-violet-500 bg-violet-600 text-white font-semibold"
                        : "border-violet-300 bg-white text-violet-800 hover:bg-violet-100"
                    }`}
                  >
                    <span className="font-bold">{p.serieNumero}</span>
                    <span> · {new Date(p.fecha).toLocaleDateString("es-ES")}</span>
                    <span className="num"> · {euros(p.total)}</span>
                  </button>
                ))}
              </div>
              {presupuestoId && (
                <p className="text-xs text-violet-600">
                  Se vinculará a la orden y sus líneas se cargarán en ella; el presupuesto quedará aceptado.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-sm text-slate-400 block mb-1">KM</label>
              <input
                type="number"
                className={campo}
                value={form.km}
                onChange={(e) => actualizar("km", e.target.value)}
                min="0"
              />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="text-sm text-slate-400 block mb-1">Tipo de trabajo</label>
              <div className="flex gap-2">
                {TRABAJOS_TALLER.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => alternarTrabajo(t)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                      trabajos.includes(t)
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-white/10 text-slate-400 hover:border-white/25"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1">Motivo / trabajos solicitados</label>
            <textarea
              className={`${campo} resize-none`}
              rows={2}
              value={form.motivo}
              onChange={(e) => actualizar("motivo", e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCerrar} className="btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primary disabled:opacity-50">
              {guardando ? "Creando…" : "Crear recepción"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
