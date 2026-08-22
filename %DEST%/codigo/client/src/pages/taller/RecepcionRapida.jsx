import { useEffect, useState } from "react";
import { TRABAJOS_TALLER } from "./datos.js";

const campo = "input w-full";

/**
 * Recepción exprés: alta del vehículo (si no existe) y apertura de la OT
 * en un solo paso. Cliente existente o datos sueltos.
 */
export default function RecepcionRapida({ onCerrar, onCreada }) {
  const [clientes, setClientes] = useState([]);
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
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => r.json())
      .then(setClientes)
      .catch(() => setClientes([]));
  }, []);

  function actualizar(campoNombre, valor) {
    setForm((f) => ({ ...f, [campoNombre]: valor }));
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
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo crear la recepción");
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="text-sm text-slate-400 block mb-1">Matrícula *</label>
              <input
                className={`${campo} uppercase`}
                value={form.matricula}
                onChange={(e) => actualizar("matricula", e.target.value.toUpperCase())}
                placeholder="0000XXX"
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
              <select
                className={campo}
                value={form.clienteId}
                onChange={(e) => actualizar("clienteId", e.target.value)}
              >
                <option value="">— Nuevo / del vehículo —</option>
                {clientes.map((c) => (
                  <option key={c._id} value={c._id}>{c.nombre}</option>
                ))}
              </select>
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
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
