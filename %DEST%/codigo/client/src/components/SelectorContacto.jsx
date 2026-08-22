import { useState } from "react";

// Selector de cliente/proveedor con alta rápida completa sin salir del documento
// (nombre, NIF, contacto, dirección y datos bancarios — igual que en la ficha).
// tipo="cliente" (NIF obligatorio) | tipo="proveedor".
const VACIO = {
  nombre: "", nif: "", telefono: "", email: "",
  calle: "", ciudad: "", cp: "",
  iban: "", banco: "", bic: "", notas: "",
};

export default function SelectorContacto({ tipo = "cliente", contactos, valor, onChange, onCreado }) {
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const esCliente = tipo === "cliente";
  const url = esCliente ? "/api/clientes" : "/api/proveedores";
  const etiqueta = esCliente ? "cliente" : "proveedor";

  const poner = (campo, v) => setNuevo((n) => ({ ...n, [campo]: v }));

  async function crear() {
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nuevo.nombre.trim(),
          nif: nuevo.nif.trim() || undefined,
          telefono: nuevo.telefono.trim() || undefined,
          email: nuevo.email.trim() || undefined,
          direccion: {
            calle: nuevo.calle.trim() || undefined,
            ciudad: nuevo.ciudad.trim() || undefined,
            cp: nuevo.cp.trim() || undefined,
          },
          iban: nuevo.iban.trim() || undefined,
          banco: nuevo.banco.trim() || undefined,
          bic: nuevo.bic.trim() || undefined,
          notas: nuevo.notas.trim() || undefined,
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al crear");
      onCreado?.(datos);
      onChange(datos._id);
      setCreando(false);
      setNuevo(VACIO);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (creando) {
    return (
      <div className="mt-1 rounded-lg border border-accent/40 bg-accent/5 p-3.5 space-y-2.5">
        <p className="text-xs font-semibold text-accent uppercase tracking-wider">
          Nuevo {etiqueta}
        </p>
        <input
          autoFocus
          placeholder="Nombre / Razón social *"
          value={nuevo.nombre}
          onChange={(e) => poner("nombre", e.target.value)}
          className="input w-full"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder={esCliente ? "NIF / CIF *" : "NIF / CIF"}
            value={nuevo.nif}
            onChange={(e) => poner("nif", e.target.value)}
            className="input"
          />
          <input
            placeholder="Teléfono"
            value={nuevo.telefono}
            onChange={(e) => poner("telefono", e.target.value)}
            className="input"
          />
        </div>
        <input
          placeholder="Email"
          type="email"
          value={nuevo.email}
          onChange={(e) => poner("email", e.target.value)}
          className="input w-full"
        />
        <input
          placeholder="Dirección"
          value={nuevo.calle}
          onChange={(e) => poner("calle", e.target.value)}
          className="input w-full"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Ciudad"
            value={nuevo.ciudad}
            onChange={(e) => poner("ciudad", e.target.value)}
            className="input"
          />
          <input
            placeholder="Código postal"
            value={nuevo.cp}
            onChange={(e) => poner("cp", e.target.value)}
            className="input"
          />
        </div>
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 pt-1">
          Datos bancarios
        </p>
        <input
          placeholder="IBAN"
          value={nuevo.iban}
          onChange={(e) => poner("iban", e.target.value)}
          className="input w-full num"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Banco"
            value={nuevo.banco}
            onChange={(e) => poner("banco", e.target.value)}
            className="input"
          />
          <input
            placeholder="BIC / SWIFT"
            value={nuevo.bic}
            onChange={(e) => poner("bic", e.target.value)}
            className="input"
          />
        </div>
        <textarea
          placeholder="Notas"
          rows={2}
          value={nuevo.notas}
          onChange={(e) => poner("notas", e.target.value)}
          className="input w-full resize-none"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={crear}
            disabled={guardando || !nuevo.nombre.trim() || (esCliente && !nuevo.nif.trim())}
            className="btn-primary !py-1.5 !px-3.5 text-xs"
          >
            {guardando ? "Guardando…" : "Crear y seleccionar"}
          </button>
          <button
            type="button"
            onClick={() => { setCreando(false); setError(null); }}
            className="text-xs text-slate-500 hover:text-white"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 flex gap-2">
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="input flex-1"
      >
        <option value="">— Selecciona —</option>
        {contactos.map((c) => (
          <option key={c._id} value={c._id}>
            {c.nombre}{c.nif ? ` — ${c.nif}` : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setCreando(true)}
        title={`Crear ${etiqueta} nuevo sin salir del documento`}
        className="shrink-0 rounded-lg border border-accent/50 text-accent text-xs font-semibold px-3 hover:bg-accent/10 transition-colors"
      >
        + Nuevo
      </button>
    </div>
  );
}
