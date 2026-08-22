import { useEffect, useState } from "react";
import BuscadorEntidad from "../../components/BuscadorEntidad.jsx";
import { aFechaInput } from "./datos.js";

const campo = "input w-full";

// Modal de préstamo de vehículo de cortesía. Se abre desde Taller → Cortesía
// o desde una cita (con `inicial` se precargan cliente, teléfono y fecha).
// El vehículo se busca por matrícula y el cliente se busca en la cartera o
// se escribe a mano (cliente nuevo).
export default function ModalPrestamoCortesia({ inicial, onCerrar, onCreado }) {
  const [cortesia, setCortesia] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [form, setForm] = useState({
    vehiculoId: "",
    clienteNombre: inicial?.clienteNombre ?? "",
    telefono: inicial?.telefono ?? "",
    ordenId: "",
    fechaPrevista: inicial?.fechaPrevista ?? "",
    kmSalida: "",
    notas: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Vehículos de cortesía libres (sin préstamo activo ahora mismo).
    Promise.all([
      fetch("/api/taller/vehiculos").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/taller/cortesia").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([vehiculos, prestamos]) => {
        const ocupados = new Set(prestamos.filter((p) => p.estado === "activo").map((p) => String(p.vehiculo)));
        setCortesia(vehiculos.filter((v) => v.tipo === "cortesia" && !ocupados.has(String(v._id))));
      })
      .catch(() => setCortesia([]));
    fetch("/api/clientes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .catch(() => setClientes([]));
    fetch("/api/taller/ordenes?abiertas=1")
      .then((r) => (r.ok ? r.json() : []))
      .then(setOrdenes)
      .catch(() => setOrdenes([]));
  }, []);

  // Opciones del buscador: matrícula como nombre (se busca por ella) y
  // marca/modelo como dato secundario.
  const opcionesVehiculos = cortesia.map((v) => ({
    _id: v._id,
    nombre: v.matricula,
    secundario: [v.marca, v.modelo].filter(Boolean).join(" ") || undefined,
  }));

  function actualizar(nombre, valor) {
    setForm((f) => ({ ...f, [nombre]: valor }));
  }

  function elegirVehiculo(op) {
    const v = cortesia.find((x) => String(x._id) === String(op?._id));
    setForm((f) => ({ ...f, vehiculoId: op?._id ?? "", kmSalida: v?.km ?? f.kmSalida }));
  }

  function elegirOrden(id) {
    const o = ordenes.find((x) => x._id === id);
    setForm((f) => ({
      ...f,
      ordenId: id,
      clienteNombre: f.clienteNombre || o?.clienteNombre || "",
      telefono: f.telefono || o?.telefono || "",
    }));
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const orden = ordenes.find((o) => o._id === form.ordenId);
      const r = await fetch("/api/taller/cortesia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehiculoId: form.vehiculoId,
          clienteNombre: form.clienteNombre,
          telefono: form.telefono || undefined,
          ordenId: form.ordenId || undefined,
          numeroOrden: orden?.numero,
          fechaPrevista: form.fechaPrevista,
          kmSalida: form.kmSalida || undefined,
          notas: form.notas || undefined,
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo crear el préstamo");
      onCreado();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">Nuevo préstamo de cortesía</h2>
        <form onSubmit={guardar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Vehículo de cortesía *</label>
              <BuscadorEntidad
                opciones={opcionesVehiculos}
                valorId={form.vehiculoId}
                onElegir={elegirVehiculo}
                placeholder="Buscar por matrícula…"
                required
              />
              {cortesia.length === 0 && (
                <p className="text-xs text-amber-300 mt-1">
                  No hay vehículos de cortesía libres. Márcalos como «Cortesía» en Vehículos.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Orden vinculada</label>
              <select className={campo} value={form.ordenId} onChange={(e) => elegirOrden(e.target.value)}>
                <option value="">— Ninguna —</option>
                {ordenes.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.numero} · {o.matricula}{o.clienteNombre ? ` · ${o.clienteNombre}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Cliente *</label>
              <BuscadorEntidad
                opciones={clientes}
                valorTexto={form.clienteNombre}
                onTexto={(t) => actualizar("clienteNombre", t)}
                onElegir={(op) => op && setForm((f) => ({ ...f, clienteNombre: op.nombre, telefono: f.telefono || op.telefono || "" }))}
                placeholder="Buscar en la cartera o escribir…"
                required
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
              <label className="text-sm text-slate-400 block mb-1">Devolución prevista *</label>
              <input
                type="date"
                className={campo}
                value={form.fechaPrevista}
                onChange={(e) => actualizar("fechaPrevista", e.target.value)}
                min={aFechaInput(new Date())}
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">KM salida</label>
              <input
                type="number"
                min="0"
                className={campo}
                value={form.kmSalida}
                onChange={(e) => actualizar("kmSalida", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Notas</label>
            <input
              className={campo}
              value={form.notas}
              onChange={(e) => actualizar("notas", e.target.value)}
              placeholder="Depósito lleno, rayón puerta derecha…"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={guardando || cortesia.length === 0} className="btn-primary disabled:opacity-50">
              {guardando ? "Guardando…" : "Prestar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
