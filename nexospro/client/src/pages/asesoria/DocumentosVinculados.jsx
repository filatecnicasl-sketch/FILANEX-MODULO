import { useEffect, useMemo, useState } from "react";
import { euros } from "../../components/ui.jsx";

const TIPOS = [
  { clave: "todos", nombre: "Todos" },
  { clave: "ventas", nombre: "Ventas" },
  { clave: "compras", nombre: "Compras" },
  { clave: "tickets", nombre: "Tickets" },
];

const NOMBRE_TIPO = { emitida: "Venta", recibida: "Compra", gasto: "Ticket" };

function fechaCorta(f) {
  return f ? new Date(f).toLocaleDateString("es-ES") : "—";
}

// Trimestre actual por defecto, que es como trabaja la asesoría.
function trimestreActual() {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), Math.floor(hoy.getMonth() / 3) * 3, 1);
  const fin = new Date(hoy.getFullYear(), Math.floor(hoy.getMonth() / 3) * 3 + 3, 0);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { desde: iso(inicio), hasta: iso(fin) };
}

// Visor de los documentos que una empresa vinculada comparte con la
// asesoría: lectura en vivo de su FILANEX e importación a la contabilidad.
export default function DocumentosVinculados({ vinculo, onCerrar }) {
  const [tipo, setTipo] = useState("todos");
  const [fechas, setFechas] = useState(trimestreActual);
  const [docs, setDocs] = useState(null);
  const [seleccion, setSeleccion] = useState(new Set());
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function cargar() {
    setError(null);
    setAviso(null);
    try {
      const params = new URLSearchParams({ tipo, desde: fechas.desde, hasta: fechas.hasta });
      const r = await fetch(`/api/asesoria/vinculados/${vinculo.id}/documentos?${params}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Error al cargar");
      setDocs(json);
      setSeleccion(new Set());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, fechas]);

  const pendientes = useMemo(() => (docs ?? []).filter((d) => !d.importado), [docs]);

  function alternar(d) {
    const clave = `${d.coleccion}:${d.documentoId}`;
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });
  }

  async function importar(soloSeleccion) {
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      const cuerpo = soloSeleccion
        ? {
            documentos: (docs ?? [])
              .filter((d) => seleccion.has(`${d.coleccion}:${d.documentoId}`))
              .map(({ coleccion, documentoId }) => ({ coleccion, documentoId })),
          }
        : { desde: fechas.desde, hasta: fechas.hasta };
      const r = await fetch(`/api/asesoria/vinculados/${vinculo.id}/importar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Error al importar");
      setAviso(
        `Importados ${json.importados}` +
          (json.duplicados ? ` · ${json.duplicados} ya estaban` : "") +
          (json.errores ? ` · ${json.errores} con error` : "")
      );
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  const totales = useMemo(() => {
    const t = { base: 0, cuotaIva: 0, total: 0 };
    for (const d of docs ?? []) {
      t.base += d.base;
      t.cuotaIva += d.cuotaIva;
      t.total += d.total;
    }
    return t;
  }, [docs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="modal-panel w-full max-w-5xl max-h-[92vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Documentos FILANEX · {vinculo.empresa?.nombre}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lectura en vivo del programa del cliente. Al importar pasan a tu contabilidad (Documentos).
            </p>
          </div>
          <button className="btn-ghost text-xs" onClick={onCerrar}>Cerrar</button>
        </div>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex gap-1 rounded-xl border border-white/10 p-1">
            {TIPOS.map((t) => (
              <button
                key={t.clave}
                onClick={() => setTipo(t.clave)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  tipo === t.clave ? "bg-sky-500/20 text-sky-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.nombre}
              </button>
            ))}
          </div>
          <div>
            <label className="label">Desde</label>
            <input type="date" className="input" value={fechas.desde}
              onChange={(e) => setFechas((f) => ({ ...f, desde: e.target.value }))} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" className="input" value={fechas.hasta}
              onChange={(e) => setFechas((f) => ({ ...f, hasta: e.target.value }))} />
          </div>
          <div className="flex gap-2 ml-auto">
            <button className="btn-ghost text-xs" disabled={!seleccion.size || ocupado} onClick={() => importar(true)}>
              Importar selección ({seleccion.size})
            </button>
            <button className="btn-primary text-xs" disabled={!pendientes.length || ocupado} onClick={() => importar(false)}>
              {ocupado ? "Importando…" : `Importar todo (${pendientes.length} nuevos)`}
            </button>
          </div>
        </div>

        {aviso && <p className="text-sm text-emerald-400 mb-3">{aviso}</p>}
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        {docs && docs.length === 0 && (
          <p className="text-sm text-slate-500 py-8 text-center">No hay documentos en este periodo.</p>
        )}

        {docs && docs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-white/10">
                  <th className="py-2 pr-2"></th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Número</th>
                  <th className="py-2 pr-3">Tercero</th>
                  <th className="py-2 pr-3 text-right">Base</th>
                  <th className="py-2 pr-3 text-right">IVA</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const clave = `${d.coleccion}:${d.documentoId}`;
                  return (
                    <tr key={clave} className="border-b border-white/5">
                      <td className="py-2 pr-2">
                        {d.importado ? (
                          <span className="text-[0.65rem] font-semibold text-emerald-400">Importado</span>
                        ) : (
                          <input type="checkbox" checked={seleccion.has(clave)} onChange={() => alternar(d)} />
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">{fechaCorta(d.fecha)}</td>
                      <td className="py-2 pr-3 text-slate-400">{NOMBRE_TIPO[d.tipo] ?? d.tipo}</td>
                      <td className="py-2 pr-3 text-slate-300">{d.numero || "—"}</td>
                      <td className="py-2 pr-3 text-slate-300 max-w-[220px] truncate">{d.tercero}</td>
                      <td className="py-2 pr-3 text-right text-slate-300">{euros(d.base)}</td>
                      <td className="py-2 pr-3 text-right text-slate-300">{euros(d.cuotaIva)}</td>
                      <td className="py-2 text-right text-white font-medium">{euros(d.total)}</td>
                    </tr>
                  );
                })}
                <tr className="text-white font-semibold">
                  <td colSpan={5} className="py-2.5 text-xs text-slate-500">TOTALES</td>
                  <td className="py-2.5 text-right">{euros(totales.base)}</td>
                  <td className="py-2.5 text-right">{euros(totales.cuotaIva)}</td>
                  <td className="py-2.5 text-right">{euros(totales.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
