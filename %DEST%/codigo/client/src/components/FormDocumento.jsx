import { useEffect, useState } from "react";
import EditorLineas, { lineaVacia } from "./EditorLineas.jsx";
import { enterComoTab } from "../utils/enter-tab.js";
import SelectorContacto from "./SelectorContacto.jsx";

// Formulario genérico cliente + líneas (presupuestos, albaranes).
// Con `inicial` (documento existente) edita con PUT en vez de crear con POST.
// Permite crear el cliente desde aquí (+ Nuevo) y lleva dirección de entrega
// opcional (distinta de la fiscal).
export default function FormDocumento({ titulo, clientes: clientesProp, url, onCreado, onCerrar, extra = {}, inicial = null }) {
  const [clientes, setClientes] = useState(clientesProp);
  const [clienteId, setClienteId] = useState(inicial?.cliente?._id ?? inicial?.cliente ?? clientesProp[0]?._id ?? "");
  const [lineas, setLineas] = useState(
    inicial?.lineas?.length
      ? inicial.lineas.map((l) => ({
          descripcion: l.descripcion ?? "",
          cantidad: l.cantidad ?? 1,
          precioUnitario: l.precioUnitario ?? 0,
          iva: l.iva ?? 21,
        }))
      : [lineaVacia()]
  );
  const [otraEntrega, setOtraEntrega] = useState(Boolean(inicial?.direccionEntrega?.calle));
  const [entrega, setEntrega] = useState({
    calle: inicial?.direccionEntrega?.calle ?? "",
    ciudad: inicial?.direccionEntrega?.ciudad ?? "",
    cp: inicial?.direccionEntrega?.cp ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => setClientes(clientesProp), [clientesProp]);

  // Al elegir un cliente con dirección de entrega en su ficha, se propone esa.
  function elegirCliente(id) {
    setClienteId(id);
    const c = clientes.find((x) => x._id === id);
    if (c?.direccionEntrega?.calle) {
      setOtraEntrega(true);
      setEntrega({
        calle: c.direccionEntrega.calle ?? "",
        ciudad: c.direccionEntrega.ciudad ?? "",
        cp: c.direccionEntrega.cp ?? "",
      });
    }
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const lineasOk = lineas.filter((l) => String(l.descripcion ?? "").trim() !== "");
      if (lineasOk.length === 0) throw new Error("Añade al menos una línea con descripción");
      const r = await fetch(inicial?._id ? `${url}/${inicial._id}` : url, {
        method: inicial?._id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: clienteId,
          direccionEntrega: otraEntrega && entrega.calle.trim()
            ? { calle: entrega.calle.trim(), ciudad: entrega.ciudad.trim(), cp: entrega.cp.trim() }
            : undefined,
          lineas: lineasOk.map((l) => ({
            ...l,
            cantidad: Number(l.cantidad) || 0,
            precioUnitario: Number(l.precioUnitario) || 0,
            iva: Number(l.iva) || 0,
          })),
          ...extra,
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al guardar");
      onCreado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="panel border-accent/30 p-5 mb-6 space-y-4" onKeyDown={enterComoTab}>
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">{titulo}</h2>
        <button onClick={onCerrar} className="text-slate-500 hover:text-white text-sm">Cerrar</button>
      </div>
      <div>
        <label className="text-xs uppercase tracking-wider text-slate-500">Cliente</label>
        <SelectorContacto
          tipo="cliente"
          contactos={clientes}
          valor={clienteId}
          onChange={elegirCliente}
          onCreado={(c) => setClientes((cs) => [...cs, c])}
        />
      </div>
      <div>
        <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={otraEntrega}
            onChange={(e) => setOtraEntrega(e.target.checked)}
            className="accent-accent"
          />
          Dirección de entrega distinta de la fiscal
        </label>
        {otraEntrega && (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_100px] gap-2 mt-2">
            <input
              placeholder="Calle y número"
              value={entrega.calle}
              onChange={(e) => setEntrega((d) => ({ ...d, calle: e.target.value }))}
              className="input"
            />
            <input
              placeholder="Ciudad"
              value={entrega.ciudad}
              onChange={(e) => setEntrega((d) => ({ ...d, ciudad: e.target.value }))}
              className="input"
            />
            <input
              placeholder="CP"
              value={entrega.cp}
              onChange={(e) => setEntrega((d) => ({ ...d, cp: e.target.value }))}
              className="input"
            />
          </div>
        )}
      </div>
      <EditorLineas lineas={lineas} setLineas={setLineas} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end pt-2 border-t border-white/5">
        <button
          onClick={guardar}
          disabled={guardando || !clienteId}
          className="btn-primary"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
