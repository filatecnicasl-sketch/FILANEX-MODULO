import { euros } from "../../components/ui.jsx";

const formatearFecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

export default function FilaMovimiento({ movimiento, onConciliar, onDesconciliar, onBorrar }) {
  return (
    <tr className={movimiento.conciliadoCon?.tipo ? "opacity-70" : ""}>
      <td className="text-slate-400 num whitespace-nowrap">{formatearFecha(movimiento.fecha)}</td>
      <td className="text-slate-300 max-w-[260px]">
        <span className="block truncate" title={movimiento.concepto}>{movimiento.concepto}</span>
      </td>
      <td className="text-slate-500 text-sm num">{movimiento.referencia || "—"}</td>
      <td className={`text-right whitespace-nowrap num font-semibold ${movimiento.importe < 0 ? "text-rose-300" : "text-emerald-300"}`}>
        {euros(movimiento.importe)}
      </td>
      <td className="text-right text-slate-500 whitespace-nowrap num">{euros(movimiento.saldo)}</td>
      <td>
        {movimiento.conciliadoCon?.tipo ? (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Conciliado</span>
        ) : (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Pendiente</span>
        )}
      </td>
      <td className="text-right whitespace-nowrap">
        {!movimiento.conciliadoCon?.tipo ? (
          <button onClick={() => onConciliar(movimiento)} className="text-xs text-accent hover:underline mr-3">
            Conciliar
          </button>
        ) : (
          <button
            onClick={() => onDesconciliar(movimiento)}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-emerald-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors align-middle mr-2"
            title="Desconciliar"
          >
            ✓
          </button>
        )}
        <button
          onClick={() => onBorrar(movimiento)}
          title="Borrar movimiento"
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors align-middle"
        >
          🗑
        </button>
      </td>
    </tr>
  );
}
