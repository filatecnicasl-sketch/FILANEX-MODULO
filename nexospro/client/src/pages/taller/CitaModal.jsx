import { useEffect, useState } from "react";
import { ESTADOS_CITA, aFechaInput } from "./datos.js";
import BuscadorEntidad from "../../components/BuscadorEntidad.jsx";
import ModalPrestamoCortesia from "./ModalPrestamoCortesia.jsx";

const campo = "input w-full";

// Franja habitual de recepción de vehículos. Si se necesita otra hora,
// se elige «Otra hora…» y se escribe a mano.
const HORAS_ENTRADA = ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00"];

/** Modal de alta/edición de cita de taller. */
export default function CitaModal({ cita, fechaInicial, onCerrar, onGuardada }) {
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [form, setForm] = useState({
    fecha: cita ? aFechaInput(cita.fecha) : fechaInicial,
    hora: cita?.hora ?? "09:00",
    duracion: cita?.duracion ?? 60,
    clienteNombre: cita?.clienteNombre ?? "",
    telefono: cita?.telefono ?? "",
    matricula: cita?.matricula ?? "",
    motivo: cita?.motivo ?? "",
    presupuesto: cita?.presupuesto ?? true,
    estado: cita?.estado ?? "pendiente",
    notas: cita?.notas ?? "",
  });
  // Hora fuera de la franja habitual (al editar) o elección libre.
  const [horaLibre, setHoraLibre] = useState(() => Boolean(cita && !HORAS_ENTRADA.includes(cita.hora)));
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

  function elegirHora(v) {
    if (v === "__otra") setHoraLibre(true);
    else actualizar("hora", v);
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`/api/taller/citas${cita ? `/${cita._id}` : ""}`, {
        method: cita ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          duracion: Number(form.duracion) || 60,
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
      <div className="modal-panel w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">
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
              <label className="text-sm text-slate-400 block mb-1">Hora *</label>
              {horaLibre ? (
                <>
                  <input
                    type="time"
                    className={campo}
                    value={form.hora}
                    onChange={(e) => actualizar("hora", e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setHoraLibre(false)}
                    className="text-[0.6875rem] text-accent hover:underline mt-1"
                  >
                    ← Franja habitual (07:00–10:00)
                  </button>
                </>
              ) : (
                <select
                  className={campo}
                  value={HORAS_ENTRADA.includes(form.hora) ? form.hora : "09:00"}
                  onChange={(e) => elegirHora(e.target.value)}
                >
                  {HORAS_ENTRADA.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                  <option value="__otra">Otra hora…</option>
                </select>
              )}
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
              <label className="text-sm text-slate-400 block mb-1">Cliente</label>
              <BuscadorEntidad
                opciones={clientes}
                valorTexto={form.clienteNombre}
                onTexto={(t) => actualizar("clienteNombre", t)}
                onElegir={elegirCliente}
                placeholder="Buscar en la cartera o escribir…"
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
