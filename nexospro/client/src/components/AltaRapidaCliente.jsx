import { useState } from "react";

// Alta de cliente desde una cita o evento, con casilla "Nuevo".
// El alta solo se hace marcando la casilla, y exige un dato identificativo
// (CIF/NIF) para no crear fichas vacías o duplicadas. El resto de la ficha
// (dirección, IBAN…) se completa después desde Clientes.
export default function AltaRapidaCliente({ nombreInicial = "", telefonoInicial = "", onCreado }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [nif, setNif] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function alternar() {
    setNombre(nombreInicial);
    setTelefono(telefonoInicial);
    setNif("");
    setError(null);
    setAbierto((a) => !a);
  }

  async function crear() {
    if (!nombre.trim()) {
      setError("Escribe el nombre");
      return;
    }
    if (!nif.trim()) {
      setError("Para dar de alta el cliente hay que indicar el CIF/NIF");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch("/api/clientes/rapido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim(), nif: nif.trim(), exigirNif: true }),
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

  return (
    <div className="mt-1">
      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={abierto}
          onChange={alternar}
          className="accent-[#2ec4b6]"
        />
        Cliente nuevo (dar de alta ahora)
      </label>
      {abierto && (
        <div className="mt-2 rounded-lg border border-teal-300 bg-teal-50 p-3 space-y-2">
          <p className="text-xs text-teal-700">
            El CIF/NIF es obligatorio para el alta. El resto de la ficha se completa desde Clientes.
          </p>
          <input
            className="input w-full"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del cliente *"
          />
          <input
            className="input w-full"
            value={nif}
            onChange={(e) => setNif(e.target.value.toUpperCase())}
            placeholder="CIF / NIF *"
          />
          <input
            className="input w-full"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Teléfono"
          />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button type="button" onClick={crear} disabled={guardando} className="btn-primary text-xs px-3 py-1.5">
            {guardando ? "Creando…" : "Dar de alta"}
          </button>
        </div>
      )}
    </div>
  );
}
