import { useEffect, useState } from "react";
import EditorLineas, { lineaVacia } from "./EditorLineas.jsx";
import { enterComoTab } from "../utils/enter-tab.js";
import { euros } from "./ui.jsx";
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
  // Fecha del documento: editable tanto al crear como al editar (p. ej. un
  // albarán entregado ayer se asienta con su fecha real).
  const [fecha, setFecha] = useState(
    inicial?.fecha
      ? new Date(inicial.fecha).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // Totales en vivo (base neta de descuentos + IVA), como en la vista del alta.
  const totales = lineas.reduce(
    (acc, l) => {
      const bruto = (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0);
      const base = bruto * (1 - (Number(l.descuento) || 0) / 100);
      acc.base += base;
      acc.iva += (base * (Number(l.iva) || 0)) / 100;
      return acc;
    },
    { base: 0, iva: 0 }
  );
  const totalDocumento = totales.base + totales.iva;

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
          fecha,
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
        className="modal-panel w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={enterComoTab}
      >
        {/* Cabecera fija */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b border-white/5 shrink-0">
          <h2 className="text-lg font-bold text-white">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-white text-xl leading-none px-1"
            title="Cerrar (Escape)"
          >
            ×
          </button>
        </div>

        {/* Cuerpo con scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
              Datos del documento
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-3 items-end">
              <div>
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
                <label className="text-sm text-slate-300">Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="mt-1 w-full input"
                />
              </div>
            </div>
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
            <EditorLineas lineas={lineas} setLineas={setLineas} conDescuento />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* Pie fijo: totales siempre visibles + acciones */}
        <div className="shrink-0 border-t border-white/10 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-4 text-sm">
            <span className="text-slate-400">
              Base <span className="num text-slate-200">{euros(totales.base)}</span>
            </span>
            <span className="text-slate-400">
              IVA <span className="num text-slate-200">{euros(totales.iva)}</span>
            </span>
            <span className="text-base font-bold text-white">
              Total <span className="num text-accent">{euros(totalDocumento)}</span>
            </span>
          </div>
          <div className="flex gap-2">
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
