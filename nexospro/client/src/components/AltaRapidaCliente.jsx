import { useState } from "react";

// Alta rápida de cliente desde una cita o evento de agenda.
// Solo pide nombre y teléfono: el resto de la ficha (NIF, dirección, IBAN…)
// se completa después desde Clientes. Así apuntar una cita no obliga a
// rellenar todos los datos fiscales en el momento.
export default function AltaRapidaCliente({ nombreInicial = "", telefonoInicial = "", onCreado }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function abrir() {
    setNombre(nombreInicial);
    setTelefono(telefonoInicial);
    setError(null);
    setAbierto(true);
  }

  async function crear() {
    if (!nombre.trim()) {
      setError("Escribe al menos el nombre");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch("/api/clientes/rapido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim() }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo crear el cliente");
      onCreado?.(datos);
      setAbierto(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="text-xs font-semibold text-teal-300 hover:text-teal-200"
        title="Crear la ficha con solo el nombre y el teléfono; el NIF se completa luego"
      >
        + Alta rápida
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-2">
      <p className="text-xs text-slate-400">
        Ficha mínima: nombre y teléfono. El NIF queda pendiente y se completa desde Clientes.
      </p>
      <input
        className="input w-full"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre del cliente *"
        autoFocus
      />
      <input
        className="input w-full"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="Teléfono"
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={crear} disabled={guardando} className="btn-primary text-xs px-3 py-1.5">
          {guardando ? "Creando…" : "Crear ficha"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="btn-ghost text-xs px-3 py-1.5">
          Cancelar
        </button>
      </div>
    </div>
  );
}
