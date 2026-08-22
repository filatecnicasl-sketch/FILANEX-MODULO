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

  // Cerrar con Escape, como el resto de ventanas del programa.
  useEffect(() => {
    const alPulsar = (e) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCerrar}
    >
      <div
        className="modal-panel w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={enterComoTab}
      >
        <h2 className="text-lg font-bold text-white mb-4">{titulo}</h2>

        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
              Datos del documento
            </p>
            <label className="text-sm text-slate-300">Cliente</label>
            <SelectorContacto
              tipo="cliente"
              contactos={clientes}
              valor={clienteId}
              onChange={elegirCliente}
              onCreado={(c) => setClientes((cs) => [...cs, c])}
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
              Dirección de entrega
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={otraEntrega}
                onChange={(e) => setOtraEntrega(e.target.checked)}
                className="accent-accent"
              />
              Distinta de la fiscal
            </label>
            {otraEntrega && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_120px] gap-3 mt-3">
                <div>
                  <label className="text-sm text-slate-300">Calle y número</label>
                  <input
                    value={entrega.calle}
                    onChange={(e) => setEntrega((d) => ({ ...d, calle: e.target.value }))}
                    className="mt-1 w-full input"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">Ciudad</label>
                  <input
                    value={entrega.ciudad}
                    onChange={(e) => setEntrega((d) => ({ ...d, ciudad: e.target.value }))}
                    className="mt-1 w-full input"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">Código postal</label>
                  <input
                    value={entrega.cp}
                    onChange={(e) => setEntrega((d) => ({ ...d, cp: e.target.value }))}
                    className="mt-1 w-full input"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <EditorLineas lineas={lineas} setLineas={setLineas} />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
            <button type="button" onClick={onCerrar} className="btn-ghost">
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || !clienteId}
              className="btn-primary"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
