import { useState } from "react";
import { ESTADOS_CITA, aFechaInput } from "./datos.js";

const campo = "input w-full";

/** Modal de alta/edición de cita de taller. */
export default function CitaModal({ cita, fechaInicial, onCerrar, onGuardada }) {
  const [form, setForm] = useState({
    fecha: cita ? aFechaInput(cita.fecha) : fechaInicial,
    hora: cita?.hora ?? "09:00",
    duracion: cita?.duracion ?? 60,
    clienteNombre: cita?.clienteNombre ?? "",
    telefono: cita?.telefono ?? "",
    matricula: cita?.matricula ?? "",
    motivo: cita?.motivo ?? "",
    estado: cita?.estado ?? "pendiente",
    notas: cita?.notas ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function actualizar(nombre, valor) {
    setForm((f) => ({ ...f, [nombre]: valor }));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">
          {cita ? `Cita ${aFechaInput(cita.fecha)} ${cita.hora}` : "Nueva cita"}
        </h2>
        <form onSubmit={guardar} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Cliente</label>
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
            <div>
              <label className="text-sm text-slate-400 block mb-1">Matrícula</label>
              <input
                className={`${campo} uppercase`}
                value={form.matricula}
                onChange={(e) => actualizar("matricula", e.target.value.toUpperCase())}
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
              {cita && (
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
