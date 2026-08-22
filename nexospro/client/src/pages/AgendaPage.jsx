import { useCallback, useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import Calendario, { aFechaInput } from "../components/Calendario.jsx";
import SelectorContacto from "../components/SelectorContacto.jsx";

const campo = "input w-full";

const ESTADOS_EVENTO = [
  { clave: "pendiente", nombre: "Pendiente" },
  { clave: "confirmada", nombre: "Confirmada" },
  { clave: "realizada", nombre: "Realizada" },
  { clave: "cancelada", nombre: "Cancelada" },
];

/** Modal de alta/edición de evento de la agenda general. */
function EventoModal({ evento, fechaInicial, clientes, onClienteCreado, onCerrar, onGuardada }) {
  const [form, setForm] = useState({
    fecha: evento ? aFechaInput(evento.fecha) : fechaInicial,
    hora: evento?.hora ?? "09:00",
    duracion: evento?.duracion ?? 60,
    clienteId: evento?.cliente ?? "",
    clienteNombre: evento?.clienteNombre ?? "",
    telefono: evento?.telefono ?? "",
    motivo: evento?.motivo ?? "",
    estado: evento?.estado ?? "pendiente",
    notas: evento?.notas ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function actualizar(nombre, valor) {
    setForm((f) => ({ ...f, [nombre]: valor }));
  }

  function elegirCliente(id) {
    const c = clientes.find((x) => x._id === id);
    setForm((f) => ({
      ...f,
      clienteId: id,
      clienteNombre: c?.nombre ?? f.clienteNombre,
      telefono: c?.telefono ?? f.telefono,
    }));
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`/api/agenda/eventos${evento ? `/${evento._id}` : ""}`, {
        method: evento ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          duracion: Number(form.duracion) || 60,
          clienteId: form.clienteId || undefined,
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo guardar el evento");
      onGuardada();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!window.confirm("¿Borrar este evento?")) return;
    const r = await fetch(`/api/agenda/eventos/${evento._id}`, { method: "DELETE" });
    if (r.ok) onGuardada();
    else alert("No se pudo borrar");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">
          {evento ? `Evento ${aFechaInput(evento.fecha)} ${evento.hora}` : "Nuevo evento"}
        </h2>
        <form onSubmit={guardar} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Fecha *</label>
              <input
                type="date"
                className={campo}
                value={form.fecha}
                onChange={(e) => actualizar("fecha", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Hora *</label>
              <input
                type="time"
                className={campo}
                value={form.hora}
                onChange={(e) => actualizar("hora", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Duración (min)</label>
              <input
                type="number"
                min="15"
                step="15"
                className={campo}
                value={form.duracion}
                onChange={(e) => actualizar("duracion", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Cliente (de la cartera)</label>
              <SelectorContacto
                tipo="cliente"
                contactos={clientes}
                valor={form.clienteId}
                onChange={elegirCliente}
                onCreado={onClienteCreado}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Estado</label>
              <select
                className={campo}
                value={form.estado}
                onChange={(e) => actualizar("estado", e.target.value)}
              >
                {ESTADOS_EVENTO.map((est) => (
                  <option key={est.clave} value={est.clave}>{est.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Nombre / contacto</label>
              <input
                className={campo}
                value={form.clienteNombre}
                onChange={(e) => actualizar("clienteNombre", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Teléfono</label>
              <input
                className={campo}
                value={form.telefono}
                onChange={(e) => actualizar("telefono", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Asunto</label>
            <input
              className={campo}
              value={form.motivo}
              onChange={(e) => actualizar("motivo", e.target.value)}
              placeholder="Reunión, entrega de documentación, llamada…"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Notas</label>
            <input
              className={campo}
              value={form.notas}
              onChange={(e) => actualizar("notas", e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex justify-between gap-2 pt-2">
            <div>
              {evento && (
                <button type="button" onClick={borrar} className="text-sm text-rose-400 hover:underline">
                  Borrar
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary disabled:opacity-50">
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// Agenda general de FILANEX facturación: disponible siempre, sin módulos.
export default function AgendaPage() {
  const [rango, setRango] = useState(null);
  const [eventos, setEventos] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { evento?, fecha }

  const cargar = useCallback(async () => {
    if (!rango) return;
    try {
      const r = await fetch(`/api/agenda/eventos?desde=${rango.desde}&hasta=${rango.hasta}`);
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar la agenda");
      setEventos(datos);
    } catch (e) {
      setError(e.message);
      setEventos([]);
    }
  }, [rango]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => setClientes(Array.isArray(lista) ? lista : []))
      .catch(() => setClientes([]));
  }, []);

  // Cambio rápido de estado desde la vista de lista.
  async function cambiarEstado(evento, estado) {
    await fetch(`/api/agenda/eventos/${evento._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    cargar();
  }

  return (
    <>
      <CabeceraPagina titulo="Agenda" descripcion="Citas, reuniones y recordatorios de la empresa." />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <Calendario
        citas={eventos ?? []}
        etiquetaNueva="Nuevo evento"
        onRango={(desde, hasta) => setRango({ desde, hasta })}
        onNueva={(fecha) => setModal({ fecha })}
        onAbrir={(evento) => setModal({ evento, fecha: aFechaInput(evento.fecha) })}
        onEstado={cambiarEstado}
      />

      {modal && (
        <EventoModal
          evento={modal.evento ?? null}
          fechaInicial={modal.fecha}
          clientes={clientes}
          onClienteCreado={(c) => setClientes((cs) => [...cs, c])}
          onCerrar={() => setModal(null)}
          onGuardada={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
    </>
  );
}
