import { euros } from "../../components/ui.jsx";
import { fondoSeguro } from "../../lib/cierreProtegido.js";

const fmtFecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

const ETIQUETA_TIPO = {
  factura_compra: "Factura de compra",
  gasto: "Gasto",
  factura_venta: "Factura de venta",
  facturas_venta: "Grupo de ventas",
  remesa: "Remesa SEPA",
  movimiento_tesoreria: "Tesorería",
};

export default function ModalResumenConciliacion({ resultados, onCerrar }) {
  const total = (resultados ?? []).reduce((s, r) => s + (r.importe ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" {...fondoSeguro(onCerrar)}>
      <div className="modal-panel w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-1">Conciliación automática</h2>
        <p className="text-sm text-slate-400 mb-4">
          Se han vinculado <span className="text-white font-semibold">{resultados?.length ?? 0}</span> movimientos
          por un total de <span className="text-white font-semibold">{euros(total)}</span>.
        </p>

        {!resultados?.length ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            No se ha encontrado ninguna coincidencia segura. Revisa los movimientos manualmente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th className="text-right">Importe</th>
                  <th>Vinculado a</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => (
                  <tr key={r.movimiento ?? i}>
                    <td className="whitespace-nowrap">{fmtFecha(r.fecha)}</td>
                    <td className="max-w-[260px] truncate" title={r.concepto}>{r.concepto}</td>
                    <td className="text-right whitespace-nowrap">{euros(r.importe)}</td>
                    <td>
                      <span className="text-[10px] font-semibold uppercase rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-1.5 py-0.5 mr-1.5">
                        {ETIQUETA_TIPO[r.tipo] ?? r.tipo}
                      </span>
                      <span className="text-slate-200">{r.descripcion}</span>
                      {r.proveedor && <span className="block text-xs text-slate-500">{r.proveedor}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end mt-5">
          <button onClick={onCerrar} className="btn-primary">Cerrar</button>
        </div>
      </div>
    </div>
  );
}
