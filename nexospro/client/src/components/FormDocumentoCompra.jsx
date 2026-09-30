import { useEffect, useState } from "react";
import EditorLineas, { lineaVacia, totalesDeLineas } from "./EditorLineas.jsx";
import { enterComoTab } from "../utils/enter-tab.js";
import SelectorContacto from "./SelectorContacto.jsx";
import { euros } from "./ui.jsx";

// Formulario genérico de documento de COMPRA: proveedor + fecha + líneas.
// Espejo de FormDocumento (ventas) pero con proveedores.
export default function FormDocumentoCompra({
  titulo,
  url,
  metodo = "POST",
  inicial = null, // { proveedor, fecha, numeroAlbaran, notas, lineas, total }
  conNumeroProveedor = false,
  etiquetaNumero = "Nº albarán del proveedor",
  campoNumero = "numeroAlbaran",
  conTotalReal = false, // solo facturas: permite cuadrar el total del papel
  onGuardado,
  onCerrar,
}) {
  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState(inicial?.proveedor ?? "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? new Date().toISOString().slice(0, 10));
  const [numeroProveedor, setNumeroProveedor] = useState(inicial?.[campoNumero] ?? "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [lineas, setLineas] = useState(
    inicial?.lineas?.length > 0 ? inicial.lineas.map((l) => ({ ...l })) : [lineaVacia()]
  );
  // Total que pone en la factura del proveedor (el papel manda): si difiere
  // unos céntimos del calculado, se guarda como ajuste por redondeo.
  const [totalReal, setTotalReal] = useState(inicial?.total != null ? String(inicial.total) : "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const calculado = totalesDeLineas(lineas);
  const totalRealNum = parseFloat(String(totalReal).replace(",", "."));
  const ajuste =
    conTotalReal && Number.isFinite(totalRealNum)
      ? Math.round((totalRealNum - calculado.total) * 100) / 100
      : 0;

  useEffect(() => {
    fetch("/api/proveedores")
      .then((r) => r.json())
      .then(setProveedores)
      .catch(() => setProveedores([]));
  }, []);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = {
        proveedor: proveedorId,
        fecha,
        notas: notas || undefined,
        lineas: lineas
          .filter((l) => l.descripcion)
          .map((l) => ({
            ...l,
            cantidad: Number(l.cantidad) || 0,
            precioUnitario: Number(l.precioUnitario) || 0,
            descuento: Number(l.descuento) || 0,
            iva: Number(l.iva) || 0,
          })),
      };
      if (conNumeroProveedor) cuerpo[campoNumero] = numeroProveedor || undefined;
      if (conTotalReal && Number.isFinite(totalRealNum)) cuerpo.totalReal = totalRealNum;
      const r = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al guardar");
      onGuardado();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="modal-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-4">{titulo}</h2>
        <form onSubmit={guardar} onKeyDown={enterComoTab} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="text-sm text-slate-400 block mb-1">Proveedor *</label>
              <SelectorContacto
                tipo="proveedor"
                contactos={proveedores}
                valor={proveedorId}
                onChange={setProveedorId}
                onCreado={(p) => setProveedores((ps) => [...ps, p])}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="input w-full"
              />
            </div>
            {conNumeroProveedor && (
              <div>
                <label className="text-sm text-slate-400 block mb-1">{etiquetaNumero}</label>
                <input
                  value={numeroProveedor}
                  onChange={(e) => setNumeroProveedor(e.target.value)}
                  className="input w-full"
                />
              </div>
            )}
          </div>

          <EditorLineas lineas={lineas} setLineas={setLineas} precio="compra" conDescuento />

          {conTotalReal && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-600/40 px-4 py-3">
              <span className="text-sm text-slate-400">
                Total calculado: <strong className="text-slate-200">{euros(calculado.total)}</strong>
              </span>
              <label className="text-sm text-slate-400 flex items-center gap-2">
                Total en la factura del proveedor:
                <input
                  value={totalReal}
                  onChange={(e) => setTotalReal(e.target.value)}
                  placeholder={calculado.total.toFixed(2)}
                  className="input w-28 text-right"
                  inputMode="decimal"
                />
              </label>
              {Math.abs(ajuste) >= 0.005 && (
                <span className="text-xs text-amber-300">
                  Se guardará un ajuste por redondeo de {ajuste > 0 ? "+" : ""}
                  {ajuste.toFixed(2)} €
                </span>
              )}
            </div>
          )}

          <div>
            <label className="text-sm text-slate-400 block mb-1">Notas</label>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="input w-full"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCerrar} className="btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={guardando || !proveedorId} className="btn-primary">
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
