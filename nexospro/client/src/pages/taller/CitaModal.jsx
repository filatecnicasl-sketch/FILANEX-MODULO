import { useEffect, useState } from "react";
import { ESTADOS_CITA, aFechaInput } from "./datos.js";
import BuscadorEntidad from "../../components/BuscadorEntidad.jsx";
import ModalPrestamoCortesia from "./ModalPrestamoCortesia.jsx";
import AltaRapidaCliente from "../../components/AltaRapidaCliente.jsx";

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

export default function CitaModal({ cita, fechaInicial, onCerrar, onGuardada }) {
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [form, setForm] = useState({
    fecha: cita ? aFechaInput(cita.fecha) : fechaInicial,
    hora: cita?.hora ?? "07:00",
    horaFin: cita ? aHora(aMinutos(cita.hora) + (cita.duracion ?? 60)) : "10:00",
    clienteNombre: cita?.clienteNombre ?? "",
    telefono: cita?.telefono ?? "",
    matricula: cita?.matricula ?? "",
    motivo: cita?.motivo ?? "",
    presupuesto: cita?.presupuesto ?? true,
    estado: cita?.estado ?? "pendiente",
    notas: cita?.notas ?? "",
  });
  const [cortesiaAbierta, setCortesiaAbierta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .catch(() => setClientes([]));
    fetch("/api/taller/vehiculos")
      .then((r) => (r.ok ? r.json() : []))
      .then(setVehiculos)
      .catch(() => setVehiculos([]));
  }, []);

  function actualizar(nombre, valor) {
    setForm((f) => ({ ...f, [nombre]: valor }));
  }

  // Elegir de la cartera rellena nombre y teléfono; también vale texto libre.
  function elegirCliente(op) {
    if (!op) return;
    setForm((f) => ({ ...f, clienteNombre: op.nombre, telefono: op.telefono ?? f.telefono }));
  }

  // Búsqueda por matrícula: al elegir un vehículo se rellenan cliente y
  // teléfono si estaban vacíos.
  const opcionesVehiculos = vehiculos.map((v) => ({
    _id: v._id,
    nombre: v.matricula,
    secundario: [v.clienteNombre, v.marca, v.modelo].filter(Boolean).join(" · ") || undefined,
  }));

  function elegirVehiculo(op) {
    if (!op) return;
    const v = vehiculos.find((x) => String(x._id) === String(op._id));
    const cli = clientes.find((c) => String(c._id) === String(v?.cliente) || c.nombre === v?.clienteNombre);
    setForm((f) => ({
      ...f,
      matricula: op.nombre,
      clienteNombre: f.clienteNombre || v?.clienteNombre || f.clienteNombre,
      telefono: f.telefono || cli?.telefono || f.telefono,
    }));
  }

  async function guardar(e) {
    e.preventDefault();
    const duracion = aMinutos(form.horaFin) - aMinutos(form.hora);
    if (duracion <= 0) {
      setError("La hora de fin debe ser posterior a la de inicio");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`/api/taller/citas${cita ? `/${cita._id}` : ""}`, {
        method: cita ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          duracion,
          horaFin: undefined,
          matricula: form.matricula || undefined,
          presupuesto: Boolean(form.presupuesto),
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo guardar la cita");
      onGuardada();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!window.confirm("¿Borrar esta cita?")) return;
    const r = await fetch(`/api/taller/citas/${cita._id}`, { method: "DELETE" });
    if (r.ok) onGuardada();
    else alert("No se pudo borrar");
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4 flex flex-wrap items-center gap-3">
          {cita ? `Cita ${aFechaInput(cita.fecha)} ${cita.hora}` : "Nueva cita"}
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
              <label className="text-sm text-slate-400 block mb-1">Cliente</label>
              <BuscadorEntidad
                opciones={clientes}
                valorTexto={form.clienteNombre}
                onTexto={(t) => actualizar("clienteNombre", t)}
                onElegir={elegirCliente}
                placeholder="Buscar en la cartera o escribir…"
              />
              <div className="mt-1">
                <AltaRapidaCliente
                  nombreInicial={form.clienteNombre}
                  telefonoInicial={form.telefono}
                  onCreado={(c) => {
                    setClientes((l) => [c, ...l]);
                    setForm((f) => ({ ...f, clienteNombre: c.nombre, telefono: c.telefono ?? f.telefono }));
                  }}
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Teléfono</label>
              <input
                className={campo}
                value={form.telefono}
                onChange={(e) => actualizar("telefono", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Matrícula</label>
              <BuscadorEntidad
                opciones={opcionesVehiculos}
                valorTexto={form.matricula}
                onTexto={(t) => actualizar("matricula", t.toUpperCase())}
                onElegir={elegirVehiculo}
                placeholder="Buscar por matrícula…"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Estado</label>
              <select
                className={campo}
                value={form.estado}
                onChange={(e) => actualizar("estado", e.target.value)}
              >
                {ESTADOS_CITA.map((est) => (
                  <option key={est.clave} value={est.clave}>{est.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Motivo</label>
            <input
              className={campo}
              value={form.motivo}
              onChange={(e) => actualizar("motivo", e.target.value)}
              placeholder="Revisión, golpe aleta, ITV…"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.presupuesto}
              onChange={(e) => actualizar("presupuesto", e.target.checked)}
              className="accent-[#2ec4b6]"
            />
            Viene de presupuesto
          </label>
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
            <div className="flex items-center gap-4">
              {cita && (
                <button type="button" onClick={borrar} className="text-sm text-rose-400 hover:underline">
                  Borrar
                </button>
              )}
              <button
                type="button"
                onClick={() => setCortesiaAbierta(true)}
                title="Prestar un coche de cortesía a este cliente"
                className="text-sm text-teal-300 hover:underline"
              >
                Coche de cortesía
              </button>
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

    {cortesiaAbierta && (
      <ModalPrestamoCortesia
        inicial={{
          clienteNombre: form.clienteNombre,
          telefono: form.telefono,
          fechaPrevista: form.fecha,
        }}
        onCerrar={() => setCortesiaAbierta(false)}
        onCreado={() => setCortesiaAbierta(false)}
      />
    )}
    </>
  );
}
