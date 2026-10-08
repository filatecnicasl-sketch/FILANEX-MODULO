import { useState } from "react";
import { euros } from "../../components/ui.jsx";

const formatearFecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

export default function ModalConciliar({ movimiento, facturas, onConciliar, onCerrar }) {
  const [facturaElegida, setFacturaElegida] = useState("");
  const [notasConciliacion, setNotasConciliacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function guardar() {
    if (!facturaElegida) return;
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/tesoreria/extractos/${movimiento._id}/conciliar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "factura_compra", id: facturaElegida, notas: notasConciliacion }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || "No se pudo conciliar");
      onConciliar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-1">Conciliar movimiento</h2>
        <p className="text-sm text-slate-400 mb-4">
          {formatearFecha(movimiento.fecha)} · {movimiento.concepto} · <span className="text-white font-semibold">{euros(Math.abs(movimiento.importe))}</span>
        </p>

        {!facturas ? (
          <p className="text-sm text-slate-500 py-6 text-center">Buscando facturas…</p>
        ) : facturas.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No hay facturas validadas que cuadren con este importe.</p>
        ) : (
          <div className="space-y-2">
            {facturas.map((factura) => {
              const estaPagada = (factura.pendiente ?? 1) <= 0;
              return (
                <label
                  key={factura._id}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                    facturaElegida === factura._id ? "border-accent/40 bg-accent/10" : "border-white/10 hover:bg-white/[0.03]"
                  }`}
                >
                  <input
                    type="radio"
                    name="factura"
                    checked={facturaElegida === factura._id}
                    onChange={() => setFacturaElegida(factura._id)}
                    className="accent-cyan-400 w-4 h-4"
                  />
                  <span className="flex-1">
                    <span className="text-white font-medium">{factura.numeroFacturaProveedor || "s/n"}</span>
                    <span className="block text-sm text-slate-300 truncate" title={factura.proveedor?.nombre}>
                      {factura.proveedor?.nombre || "—"}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Total: {euros(factura.importeReferencia ?? factura.total)}
                      {factura.diferencia != null && factura.diferencia > 0.01 && (
                        <span className="text-amber-400 ml-1">(dif. {euros(factura.diferencia)})</span>
                      )}
                      {estaPagada ? " · pagada" : ` · pendiente: ${euros(factura.pendiente)}`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          <label className="text-sm text-slate-400 block mb-1">Notas</label>
          <input value={notasConciliacion} onChange={(e) => setNotasConciliacion(e.target.value)} className="input w-full" />
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCerrar} className="btn-ghost">Cancelar</button>
          <button onClick={guardar} disabled={guardando || !facturaElegida || !facturas?.length} className="btn-primary">
            {guardando ? "Guardando…" : "Conciliar"}
          </button>
        </div>
      </div>
    </div>
  );
}
