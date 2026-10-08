import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda, euros } from "../components/ui.jsx";
import { IconBorrar, IconCheck } from "../components/icons.jsx";

const fmtFecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

function ModalConciliar({ movimiento, facturas, onConciliar, onCerrar }) {
  const [elegida, setElegida] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function guardar() {
    if (!elegida) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`/api/tesoreria/extractos/${movimiento._id}/conciliar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "factura_compra", id: elegida, notas }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo conciliar");
      onConciliar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-1">Conciliar movimiento</h2>
        <p className="text-sm text-slate-400 mb-4">
          {fmtFecha(movimiento.fecha)} · {movimiento.concepto} · <span className="text-white font-semibold">{euros(Math.abs(movimiento.importe))}</span>
        </p>

        {!facturas ? (
          <p className="text-sm text-slate-500 py-6 text-center">Buscando facturas…</p>
        ) : facturas.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No hay facturas de compra pendientes que cuadren con este importe.</p>
        ) : (
          <div className="space-y-2">
            {facturas.map((f) => (
              <label
                key={f._id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                  elegida === f._id ? "border-accent/40 bg-accent/10" : "border-white/10 hover:bg-white/[0.03]"
                }`}
              >
                <input
                  type="radio"
                  name="factura"
                  checked={elegida === f._id}
                  onChange={() => setElegida(f._id)}
                  className="accent-cyan-400 w-4 h-4"
                />
                <span className="flex-1">
                  <span className="text-white font-medium">{f.numeroFacturaProveedor || "s/n"}</span>
                  <span className="block text-sm text-slate-300 truncate" title={f.proveedor?.nombre}>{f.proveedor?.nombre || "—"}</span>
                  <span className="block text-xs text-slate-500">Pendiente: {euros(f.pendiente)}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4">
          <label className="text-sm text-slate-400 block mb-1">Notas</label>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} className="input w-full" />
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCerrar} className="btn-ghost">Cancelar</button>
          <button onClick={guardar} disabled={guardando || !elegida || !facturas?.length} className="btn-primary">
            {guardando ? "Guardando…" : "Conciliar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TesoreriaExtractosPage() {
  const [lista, setLista] = useState(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("pendientes");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [conciliando, setConciliando] = useState(null);
  const [coincidencias, setCoincidencias] = useState(null);
  const inputRef = useRef(null);

  async function cargar() {
    try {
      const conc = filtro === "pendientes" ? "0" : filtro === "conciliados" ? "1" : "todos";
      const r = await fetch(`/api/tesoreria/extractos?conciliados=${conc}`);
      const text = await r.text();
      let datos = [];
      try {
        datos = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 200) || `Error ${r.status} del servidor`);
      }
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setLista(Array.isArray(datos) ? datos : []);
    } catch (e) {
      setError(String(e?.message || e));
      setLista([]);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function buscarCoincidencias(mov) {
    setCoincidencias(null);
    try {
      const r = await fetch(
        `/api/tesoreria/extractos/coincidencias?importe=${Math.abs(mov.importe)}&fecha=${new Date(mov.fecha).toISOString().slice(0, 10)}`
      );
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al buscar");
      setCoincidencias(datos.candidatas);
    } catch {
      setCoincidencias([]);
    }
  }

  async function importarArchivo(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setSubiendo(true);
    setError(null);
    setAviso(null);
    try {
      const fd = new FormData();
      fd.append("extracto", f);
      const r = await fetch("/api/tesoreria/extractos/upload", { method: "POST", body: fd });
      const text = await r.text();
      let datos = {};
      try {
        datos = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 200) || `Error ${r.status} del servidor`);
      }
      if (!r.ok) throw new Error(datos.error || "Error al procesar");
      setAviso(`Se importaron ${datos.insertados} movimientos del extracto.`);
      await cargar();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSubiendo(false);
    }
  }

  async function desconciliar(mov) {
    if (!window.confirm("¿Desconciliar este movimiento?")) return;
    const r = await fetch(`/api/tesoreria/extractos/${mov._id}/conciliacion`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo desconciliar");
  }

  async function borrar(mov) {
    if (!window.confirm("¿Borrar este movimiento del extracto?")) return;
    const r = await fetch(`/api/tesoreria/extractos/${mov._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  const filtrada = (lista ?? []).filter((mov) =
    coincideBusqueda(q, fmtFecha(mov.fecha), mov.concepto || "", mov.referencia || "", euros(mov.importe), mov.notas || "")
  );

  return (
    <div>
      <CabeceraPagina
        titulo="Extractos bancarios"
        descripcion="Importa el extracto de tu banco y concilia los cargos con facturas de compra pendientes de pago."
      >
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={importarArchivo} />
        <button onClick={() => inputRef.current?.click()} disabled={subiendo} className="btn-primary">
          {subiendo ? "Importando…" : "Importar extracto"}
        </button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}
      {aviso && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{aviso}</div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por fecha, concepto, importe…" />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="input">
          <option value="pendientes">Pendientes de conciliar</option>
          <option value="conciliados">Conciliados</option>
          <option value="todos">Todos</option>
        </select>
        {q && <button onClick={() => setQ("")} className="btn-ghost text-xs">Limpiar</button>}
        <span className="text-xs text-slate-500 ml-auto">{filtrada.length} de {lista?.length ?? 0}</span>
      </div>

      <div className="panel px-3.5 py-2">
        {!lista ? null : lista.length === 0 ? (
          <EstadoVacio titulo="Sin movimientos importados" descripcion="Sube un extracto bancario en CSV o Excel para empezar a conciliar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Referencia</th>
                  <th className="text-right">Importe</th>
                  <th className="text-right">Saldo</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-8">Ningún movimiento cumple esos filtros.</td>
                  </tr>
                )}
                {filtrada.map((mov) => (
                  <tr key={mov._id} className={mov.conciliadoCon?.tipo ? "opacity-70" : ""}>
                    <td className="text-slate-400 num whitespace-nowrap">{fmtFecha(mov.fecha)}</td>
                    <td className="text-slate-300 max-w-[260px]">
                      <span className="block truncate" title={mov.concepto}>{mov.concepto}</span>
                    </td>
                    <td className="text-slate-500 text-sm num">{mov.referencia || "—"}</td>
                    <td className={`text-right whitespace-nowrap num font-semibold ${mov.importe < 0 ? "text-rose-300" : "text-emerald-300"}`}>
                      {euros(mov.importe)}
                    </td>
                    <td className="text-right text-slate-500 whitespace-nowrap num">{euros(mov.saldo)}</td>
                    <td>
                      {mov.conciliadoCon?.tipo ? (
                        <Badge tono="green">Conciliado</Badge>
                      ) : (
                        <Badge tono="amber">Pendiente</Badge>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {!mov.conciliadoCon?.tipo ? (
                        <button
                          onClick={() => {
                            setConciliando(mov);
                            buscarCoincidencias(mov);
                          }}
                          className="text-xs text-accent hover:underline mr-3"
                        >
                          Conciliar
                        </button>
                      ) : (
                        <button
                          onClick={() => desconciliar(mov)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-emerald-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors align-middle mr-2"
                          title="Desconciliar"
                        >
                          <IconCheck />
                        </button>
                      )}
                      <button
                        onClick={() => borrar(mov)}
                        title="Borrar movimiento"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors align-middle"
                      >
                        <IconBorrar />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {conciliando && (
        <ModalConciliar
          movimiento={conciliando}
          facturas={coincidencias}
          onConciliar={() => {
            setConciliando(null);
            setCoincidencias(null);
            cargar();
          }}
          onCerrar={() => {
            setConciliando(null);
            setCoincidencias(null);
          }}
        />
      )}
    </div>
  );
}
