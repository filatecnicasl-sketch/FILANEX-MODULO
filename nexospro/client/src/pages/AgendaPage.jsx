import { useCallback, useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import Calendario, { aFechaInput } from "../components/Calendario.jsx";
import SelectorContacto from "../components/SelectorContacto.jsx";
import BotonVoz from "../components/BotonVoz.jsx";
import AltaRapidaCliente from "../components/AltaRapidaCliente.jsx";

const campo = "input w-full";

/** Convierte "HH:MM" a minutos desde medianoche. */
function aMinutos(h) {
  const [hh, mm] = String(h ?? "0:0").split(":").map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

/** Convierte minutos desde medianoche a "HH:MM". */
function aHora(minutos) {
  const hh = String(Math.max(0, Math.floor(minutos / 60))).padStart(2, "0");
  const mm = String(Math.max(0, minutos % 60)).padStart(2, "0");
  return `${hh}:${mm}`;
}

function horarioSiguiente() {
  const ahora = new Date();
  let inicio = ahora.getHours() * 60 + ahora.getMinutes();
  inicio = Math.ceil(inicio / 30) * 30;
  if (inicio >= 23 * 60 + 30) inicio = 9 * 60;
  return { hora: aHora(inicio), horaFin: aHora(inicio + 30) };
}

const TIPOS_EVENTO = [
  { clave: "reunion", nombre: "Reunión" },
  { clave: "llamada", nombre: "Llamada" },
  { clave: "tarea", nombre: "Tarea" },
  { clave: "recordatorio", nombre: "Recordatorio" },
  { clave: "otro", nombre: "Otro" },
];

const ESTADOS_EVENTO = [
  { clave: "pendiente", nombre: "Pendiente" },
  { clave: "confirmada", nombre: "Confirmada" },
  { clave: "realizada", nombre: "Realizada" },
  { clave: "cancelada", nombre: "Cancelada" },
];

/** Modal de alta/edición de evento de la agenda general. */
function EventoModal({
  evento,
  fechaInicial,
  clientes,
  minutosAvisoDefecto,
  onClienteCreado,
  onCerrar,
  onGuardada,
}) {
  const horario = horarioSiguiente();
  const [form, setForm] = useState({
    fecha: evento ? aFechaInput(evento.fecha) : fechaInicial,
    hora: evento?.hora ?? horario.hora,
    horaFin: evento?.horaFin ?? horario.horaFin,
    tipo: evento?.tipo ?? "reunion",
    titulo: evento?.titulo ?? "",
    clienteId: evento?.cliente ?? "",
    clienteNombre: evento?.clienteNombre ?? "",
    telefono: evento?.telefono ?? "",
    lugar: evento?.lugar ?? "",
    estado: evento?.estado ?? "pendiente",
    notas: evento?.notas ?? "",
    avisar: evento?.avisar ?? true,
    minutosAviso: evento?.minutosAviso ?? minutosAvisoDefecto,
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
    if (aMinutos(form.horaFin) <= aMinutos(form.hora)) {
      setError("La hora de fin debe ser posterior a la de inicio");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`/api/agenda/eventos${evento ? `/${evento._id}` : ""}`, {
        method: evento ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
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
      <div className="modal-panel w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4 flex flex-wrap items-center gap-3">
          {evento ? `Evento ${aFechaInput(evento.fecha)} ${evento.hora}` : "Nuevo evento"}
          {!evento && (
            <BotonVoz
              onResultado={(campos) => {
                const hora = campos.hora;
                setForm((f) => ({
                  ...f,
                  fecha: campos.fecha ?? f.fecha,
                  hora: hora ?? f.hora,
                  horaFin: hora && campos.duracion
                    ? aHora(aMinutos(hora) + Number(campos.duracion))
                    : campos.duracion
                      ? aHora(aMinutos(f.hora) + Number(campos.duracion))
                      : f.horaFin,
                  clienteNombre: campos.clienteNombre ?? f.clienteNombre,
                  telefono: campos.telefono ?? f.telefono,
                  tipo: campos.tipo ?? f.tipo,
                  titulo: campos.titulo ?? f.titulo,
                  lugar: campos.lugar ?? f.lugar,
                  notas: campos.notas ?? f.notas,
                }));
              }}
            />
          )}
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
              <label className="text-sm text-slate-400 block mb-1">De *</label>
              <input
                type="time"
                className={campo}
                value={form.hora}
                onChange={(e) => actualizar("hora", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">A *</label>
              <input
                type="time"
                className={campo}
                value={form.horaFin}
                onChange={(e) => actualizar("horaFin", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Tipo de evento *</label>
              <select
                className={campo}
                value={form.tipo}
                onChange={(e) => actualizar("tipo", e.target.value)}
              >
                {TIPOS_EVENTO.map((tipo) => (
                  <option key={tipo.clave} value={tipo.clave}>{tipo.nombre}</option>
                ))}
              </select>
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
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Asunto *</label>
            <input
              className={campo}
              value={form.titulo}
              onChange={(e) => actualizar("titulo", e.target.value)}
              placeholder="Reunión con asesoría, llamada pendiente, presentar documentación…"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Cliente o contacto (opcional)</label>
              <SelectorContacto
                tipo="cliente"
                contactos={clientes}
                valor={form.clienteId}
                onChange={elegirCliente}
                onCreado={onClienteCreado}
              />
              <div className="mt-1">
                <AltaRapidaCliente
                  nombreInicial={form.clienteNombre}
                  telefonoInicial={form.telefono}
                  onCreado={(c) => {
                    onClienteCreado?.(c);
                    setForm((f) => ({
                      ...f,
                      clienteId: c._id,
                      clienteNombre: c.nombre,
                      telefono: c.telefono ?? f.telefono,
                    }));
                  }}
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Lugar</label>
              <input
                className={campo}
                value={form.lugar}
                onChange={(e) => actualizar("lugar", e.target.value)}
                placeholder="Oficina, videollamada, dirección…"
              />
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
            <label className="text-sm text-slate-400 block mb-1">Notas</label>
            <textarea
              className={campo}
              value={form.notas}
              onChange={(e) => actualizar("notas", e.target.value)}
              rows={3}
            />
          </div>
          <div className="rounded-xl border border-line px-4 py-3">
            <label className="flex items-center gap-3 text-sm text-white">
              <input
                type="checkbox"
                checked={form.avisar}
                onChange={(e) => actualizar("avisar", e.target.checked)}
              />
              Avisarme antes de este evento
            </label>
            {form.avisar && (
              <label className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                Avisar
                <input
                  type="number"
                  min="1"
                  max="240"
                  className="input !w-20 !py-1 text-right num"
                  value={form.minutosAviso}
                  onChange={(e) => actualizar("minutosAviso", e.target.value)}
                />
                minutos antes
              </label>
            )}
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
  const [minutosAvisoDefecto, setMinutosAvisoDefecto] = useState(15);
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
    Promise.all([
      fetch("/api/clientes").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/notificaciones").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([lista, notificaciones]) => {
        setClientes(Array.isArray(lista) ? lista : []);
        setMinutosAvisoDefecto(Number(notificaciones?.prefs?.minutosAgenda) || 15);
      })
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
      <CabeceraPagina titulo="Agenda" descripcion="Organiza reuniones, llamadas, tareas y recordatorios sin duplicar horarios." />

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
        nombreElementos="eventos"
      />

      {modal && (
        <EventoModal
          evento={modal.evento ?? null}
          fechaInicial={modal.fecha}
          clientes={clientes}
          minutosAvisoDefecto={minutosAvisoDefecto}
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
