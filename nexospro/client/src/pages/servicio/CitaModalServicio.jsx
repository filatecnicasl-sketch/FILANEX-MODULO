import { useEffect, useState } from "react";
import { ESTADOS_CITA, aFechaInput } from "./datos.js";
import BuscadorEntidad from "../../components/BuscadorEntidad.jsx";

const campo = "input w-full";

// Franja habitual de recepción de aparatos. Si se necesita otra hora,
// se elige «Otra hora…» y se escribe a mano.
const HORAS_ENTRADA = ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00"];

// Descripción corta del aparato (la misma que genera el servidor).
function describirAparato(a) {
  const partes = [a?.marca, a?.modelo].filter(Boolean).join(" ");
  const sn = a?.numeroSerie ? `S/N ${a.numeroSerie}` : a?.codigo;
  return [partes, sn].filter(Boolean).join(" · ");
}

// Dirección fiscal del cliente en una línea ("Calle, CP, Ciudad, Provincia").
const dirTexto = (d) => [d?.calle, d?.cp, d?.ciudad, d?.provincia].filter(Boolean).join(", ");

/** Modal de alta/edición de cita del servicio técnico (SAT). */
export default function CitaModalServicio({ cita, fechaInicial, onCerrar, onGuardada }) {
  const [clientes, setClientes] = useState([]);
  const [aparatos, setAparatos] = useState([]);
  const [form, setForm] = useState({
    fecha: cita ? aFechaInput(cita.fecha) : fechaInicial,
    hora: cita?.hora ?? "09:00",
    duracion: cita?.duracion ?? 60,
    cliente: cita?.cliente?._id ?? cita?.cliente ?? "",
    clienteNombre: cita?.clienteNombre ?? "",
    telefono: cita?.telefono ?? "",
    aparato: cita?.aparato?._id ?? cita?.aparato ?? "",
    aparatoDescripcion: cita?.aparatoDescripcion ?? "",
    // La cita no guarda el lugar: se deduce de si tiene dirección.
    lugar: cita?.direccion ? "domicilio" : "tienda",
    direccion: cita?.direccion ?? "",
    motivo: cita?.motivo ?? "",
    presupuesto: cita?.presupuesto ?? true,
    estado: cita?.estado ?? "pendiente",
    notas: cita?.notas ?? "",
  });
  // Hora fuera de la franja habitual (al editar) o elección libre.
  const [horaLibre, setHoraLibre] = useState(() => Boolean(cita && !HORAS_ENTRADA.includes(cita.hora)));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .catch(() => setClientes([]));
    fetch("/api/servicio/aparatos")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAparatos)
      .catch(() => setAparatos([]));
  }, []);

  function actualizar(nombre, valor) {
    setForm((f) => ({ ...f, [nombre]: valor }));
  }

  // Elegir de la cartera rellena nombre y teléfono; si la cita es a
  // domicilio también precarga la dirección del cliente. Vale texto libre.
  function elegirCliente(op) {
    if (!op) return;
    setForm((f) => ({
      ...f,
      cliente: String(op._id),
      clienteNombre: op.nombre,
      telefono: op.telefono ?? f.telefono,
      direccion: f.lugar === "domicilio" ? dirTexto(op.direccion) || f.direccion : f.direccion,
    }));
  }

  // Si se retoca el nombre a mano tras elegirlo, se desvincula el cliente.
  function textoCliente(t) {
    setForm((f) => ({ ...f, clienteNombre: t, cliente: f.clienteNombre === t ? f.cliente : "" }));
  }

  // Selector de aparato dado de alta: "marca modelo · S/N …" con código y
  // cliente debajo; también vale texto libre si no está dado de alta.
  const opcionesAparatos = aparatos.map((a) => ({
    _id: a._id,
    nombre: describirAparato(a),
    secundario: [a.codigo, a.clienteNombre].filter(Boolean).join(" · ") || undefined,
  }));

  // Al elegir un aparato se guardan su id y su descripción, y se rellenan
  // cliente y teléfono si estaban vacíos.
  function elegirAparato(op) {
    if (!op) return;
    const a = aparatos.find((x) => String(x._id) === String(op._id));
    const cli = clientes.find((c) => String(c._id) === String(a?.cliente) || c.nombre === a?.clienteNombre);
    setForm((f) => ({
      ...f,
      aparato: String(op._id),
      aparatoDescripcion: op.nombre,
      cliente: f.cliente || (a?.cliente ? String(a.cliente) : f.cliente),
      clienteNombre: f.clienteNombre || a?.clienteNombre || f.clienteNombre,
      telefono: f.telefono || cli?.telefono || f.telefono,
      direccion: f.lugar === "domicilio" ? f.direccion || dirTexto(cli?.direccion) : f.direccion,
    }));
  }

  // Texto libre de aparato: si se edita a mano lo elegido, se desvincula.
  function textoAparato(t) {
    setForm((f) => ({ ...f, aparatoDescripcion: t, aparato: f.aparatoDescripcion === t ? f.aparato : "" }));
  }

  // Lugar del servicio: al pasar a domicilio se precarga la dirección del
  // cliente elegido (editable después).
  function elegirLugar(v) {
    setForm((f) => {
      if (v !== "domicilio") return { ...f, lugar: v };
      const cli = clientes.find((c) => String(c._id) === String(f.cliente));
      return { ...f, lugar: v, direccion: f.direccion || dirTexto(cli?.direccion) };
    });
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
      const r = await fetch(`/api/servicio/citas${cita ? `/${cita._id}` : ""}`, {
        method: cita ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          duracion: Number(form.duracion) || 60,
          cliente: form.cliente || null,
          aparato: form.aparato || null,
          aparatoDescripcion: form.aparatoDescripcion || undefined,
          direccion: form.lugar === "domicilio" ? form.direccion : "",
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
    const r = await fetch(`/api/servicio/citas/${cita._id}`, { method: "DELETE" });
    if (r.ok) onGuardada();
    else alert("No se pudo borrar");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
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
                onTexto={textoCliente}
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
              <label className="text-sm text-slate-400 block mb-1">Aparato</label>
              <BuscadorEntidad
                opciones={opcionesAparatos}
                valorTexto={form.aparatoDescripcion}
                onTexto={textoAparato}
                onElegir={elegirAparato}
                placeholder="Buscar por marca, modelo o S/N…"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Lugar</label>
              <div className="flex rounded-lg overflow-hidden border border-white/10 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => elegirLugar("tienda")}
                  className={`flex-1 px-3 py-2.5 transition-colors ${
                    form.lugar === "tienda" ? "bg-accent/15 text-accent" : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  En tienda
                </button>
                <button
                  type="button"
                  onClick={() => elegirLugar("domicilio")}
                  className={`flex-1 px-3 py-2.5 transition-colors ${
                    form.lugar === "domicilio" ? "bg-accent/15 text-accent" : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  A domicilio
                </button>
              </div>
            </div>
            {form.lugar === "domicilio" && (
              <div>
                <label className="text-sm text-slate-400 block mb-1">Dirección de la intervención</label>
                <input
                  className={campo}
                  value={form.direccion}
                  onChange={(e) => actualizar("direccion", e.target.value)}
                  placeholder="Calle, CP, ciudad…"
                />
              </div>
            )}
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Motivo</label>
            <input
              className={campo}
              value={form.motivo}
              onChange={(e) => actualizar("motivo", e.target.value)}
              placeholder="No enciende, pantalla rota, limpieza de virus…"
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
