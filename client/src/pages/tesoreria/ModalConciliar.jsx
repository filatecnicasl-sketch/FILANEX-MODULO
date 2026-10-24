import { useState } from "react";
import { euros } from "../../components/ui.jsx";
import { fondoSeguro } from "../../lib/cierreProtegido.js";

const formatearFecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

const ETIQUETAS_TIPO = {
  factura_compra: "Facturas de compra",
  gasto: "Gastos (tickets)",
  factura_venta: "Facturas de venta",
  remesa: "Remesas SEPA",
};

const TONO_TIPO = {
  factura_compra: "text-cyan-300",
  gasto: "text-amber-300",
  factura_venta: "text-emerald-300",
  remesa: "text-violet-300",
};

export default function ModalConciliar({ movimiento, candidatas, onConciliar, onCerrar }) {
  // Selección: tipo + ids (las facturas de compra admiten varias a la vez,
  // para los cargos que agrupan varias facturas del mismo proveedor).
  const [tipoElegido, setTipoElegido] = useState(null);
  const [idsElegidos, setIdsElegidos] = useState([]);
  const [notasConciliacion, setNotasConciliacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const grupos = {};
  for (const c of candidatas ?? []) {
    (grupos[c.tipo] ??= []).push(c);
  }
  const hayCandidatas = Object.keys(grupos).length > 0;

  const importeMovimiento = Math.abs(movimiento.importe ?? 0);
  const multipleCompra = tipoElegido === "factura_compra" && idsElegidos.length > 1;
  const sumaSeleccion =
    tipoElegido === "factura_compra"
      ? idsElegidos.reduce((t, id) => {
          const c = (grupos.factura_compra ?? []).find((x) => x._id === id);
          return t + Math.min(c?.pendiente ?? c?.total ?? 0, c?.total ?? 0);
        }, 0)
      : 0;
  const cuadraSeleccion = Math.abs(sumaSeleccion - importeMovimiento) < 0.01;

  function alternarCompra(id) {
    setTipoElegido("factura_compra");
    setIdsElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function elegirUnica(tipo, id) {
    setTipoElegido(tipo);
    setIdsElegidos([id]);
  }

  async function guardar(tipoForzado) {
    const tipo = tipoForzado ?? tipoElegido;
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/tesoreria/extractos/${movimiento._id}/conciliar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          id: tipo === "factura_compra" ? idsElegidos[0] : undefined,
          ids: tipo === "factura_compra" ? idsElegidos : undefined,
          notas: notasConciliacion,
        }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || "No se pudo conciliar");
      onConciliar();
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" {...fondoSeguro(onCerrar)}>
      <div className="modal-panel w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-1">Conciliar movimiento</h2>
        <p className="text-sm text-slate-400 mb-4">
          {formatearFecha(movimiento.fecha)} · {movimiento.concepto} ·{" "}
          <span className="text-white font-semibold">{euros(importeMovimiento)}</span>
        </p>

        {!candidatas ? (
          <p className="text-sm text-slate-500 py-6 text-center">Buscando coincidencias…</p>
        ) : !hayCandidatas ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            No hay facturas, gastos ni remesas que cuadren con este importe.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(ETIQUETAS_TIPO)
              .filter(([tipo]) => grupos[tipo]?.length)
              .map(([tipo, etiqueta]) => (
                <div key={tipo}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${TONO_TIPO[tipo]}`}>
                    {etiqueta}
                    {tipo === "factura_compra" && (
                      <span className="ml-2 normal-case text-slate-500 font-normal">
                        (puedes marcar varias si el cargo las paga juntas)
                      </span>
                    )}
                  </p>
                  <div className="space-y-2">
                    {grupos[tipo].map((c) => {
                      const marcada = tipoElegido === tipo && idsElegidos.includes(c._id);
                      return (
                        <label
                          key={c._id}
                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                            marcada ? "border-accent/40 bg-accent/10" : "border-white/10 hover:bg-white/[0.03]"
                          }`}
                        >
                          <input
                            type={tipo === "factura_compra" ? "checkbox" : "radio"}
                            name="candidata"
                            checked={marcada}
                            onChange={() =>
                              tipo === "factura_compra" ? alternarCompra(c._id) : elegirUnica(tipo, c._id)
                            }
                            className="accent-cyan-400 w-4 h-4"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="text-white font-medium">
                              {c.etiqueta}
                              {c.vinculada && (
                                <span className="ml-2 text-[10px] font-semibold uppercase rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 align-middle">
                                  ya vinculada
                                </span>
                              )}
                            </span>
                            <span className="block text-sm text-slate-300 truncate" title={c.subtitulo}>
                              {c.subtitulo}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {formatearFecha(c.fecha)} · Total: {euros(c.total)}
                              {c.diferencia > 0.01 && <span className="text-amber-400 ml-1">(dif. {euros(c.diferencia)})</span>}
                              {tipo === "factura_compra" && (c.pendiente > 0 ? ` · pendiente: ${euros(c.pendiente)}` : " · pagada")}
                              {tipo === "factura_venta" && (c.pendiente > 0 ? ` · pendiente: ${euros(c.pendiente)}` : " · cobrada")}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}

        {multipleCompra && (
          <p className={`mt-3 text-sm ${cuadraSeleccion ? "text-emerald-400" : "text-amber-400"}`}>
            {idsElegidos.length} facturas marcadas · suma: {euros(sumaSeleccion)}
            {cuadraSeleccion ? " ✓ cuadra con el cargo" : ` (el cargo es ${euros(importeMovimiento)})`}
          </p>
        )}

        <div className="mt-4">
          <label className="text-sm text-slate-400 block mb-1">Notas</label>
          <input value={notasConciliacion} onChange={(e) => setNotasConciliacion(e.target.value)} className="input w-full" />
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={() => guardar("manual")}
            disabled={guardando}
            className="btn-ghost"
            title="Cualquier apunte sin documento (traslado entre cuentas, error a anotar…)"
          >
            Sin factura
          </button>
          <button
            onClick={() => guardar("movimiento_tesoreria")}
            disabled={guardando}
            className="btn-ghost"
            title="Liquidación de remesa, reintegro de cajero, ingreso en efectivo…"
          >
            Tesorería
          </button>
          <button onClick={onCerrar} className="btn-ghost">Cancelar</button>
          <button
            onClick={() => guardar()}
            disabled={guardando || !tipoElegido || !idsElegidos.length}
            className="btn-primary"
          >
            {guardando
              ? "Guardando…"
              : multipleCompra
                ? `Conciliar ${idsElegidos.length} facturas`
                : "Conciliar"}
          </button>
        </div>
      </div>
    </div>
  );
}
