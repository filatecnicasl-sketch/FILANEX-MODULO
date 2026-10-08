import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { EstadoVacio, InputBusqueda, coincideBusqueda, euros } from "../components/ui.jsx";
import FilaMovimiento from "./tesoreria/FilaMovimiento.jsx";
import ModalConciliar from "./tesoreria/ModalConciliar.jsx";

const fmtFecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

export default function TesoreriaExtractosPage() {
  const [lista, setLista] = useState(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("pendientes");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [activo, setActivo] = useState(null);
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
        throw new Error(text.slice(0, 200) || `Error ${r.status}`);
      }
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setLista(Array.isArray(datos) ? datos : []);
    } catch (err) {
      setError(String(err?.message || err));
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
    } catch (err) {
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
        throw new Error(text.slice(0, 200) || `Error ${r.status}`);
      }
      if (!r.ok) throw new Error(datos.error || "Error al procesar");
      setAviso(`Se importaron ${datos.insertados} movimientos.`);
      await cargar();
    } catch (err) {
      setError(String(err?.message || err));
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
    if (!window.confirm("¿Borrar este movimiento?")) return;
    const r = await fetch(`/api/tesoreria/extractos/${mov._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  const filtrada = (lista ?? []).filter((mov) =>
    coincideBusqueda(q, fmtFecha(mov.fecha), mov.concepto || "", mov.referencia || "", euros(mov.importe), mov.notas || "")
  );

  return (
    <div>
      <CabeceraPagina
        titulo="Extractos bancarios"
        descripcion="Importa el extracto de tu banco y concilia los cargos con facturas de compra."
      >
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={importarArchivo} />
        <button onClick={() => inputRef.current?.click()} disabled={subiendo} className="btn-primary">
          {subiendo ? "Importando…" : "Importar extracto"}
        </button>
      </CabeceraPagina>

      {error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
      {aviso && <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{aviso}</div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por fecha, concepto, importe…" />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="input">
          <option value="pendientes">Pendientes</option>
          <option value="conciliados">Conciliados</option>
          <option value="todos">Todos</option>
        </select>
        {q && <button onClick={() => setQ("")} className="btn-ghost text-xs">Limpiar</button>}
        <span className="text-xs text-slate-500 ml-auto">{filtrada.length} de {lista?.length ?? 0}</span>
      </div>

      <div className="panel px-3.5 py-2">
        {!lista ? null : lista.length === 0 ? (
          <EstadoVacio titulo="Sin movimientos" descripcion="Sube un extracto bancario para empezar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Ref.</th>
                  <th className="text-right">Importe</th>
                  <th className="text-right">Saldo</th>
                  <th>Estado</th>
                  <th className="text-right">Acc.</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-slate-500 py-8">Sin resultados.</td></tr>
                )}
                {filtrada.map((mov) => (
                  <FilaMovimiento
                    key={mov._id}
                    movimiento={mov}
                    onConciliar={(m) => {
                      setActivo(m);
                      buscarCoincidencias(m);
                    }}
                    onDesconciliar={desconciliar}
                    onBorrar={borrar}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activo && (
        <ModalConciliar
          movimiento={activo}
          facturas={coincidencias}
          onConciliar={() => {
            setActivo(null);
            setCoincidencias(null);
            cargar();
          }}
          onCerrar={() => {
            setActivo(null);
            setCoincidencias(null);
          }}
        />
      )}
    </div>
  );
}
