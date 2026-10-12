import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { EstadoVacio, InputBusqueda, coincideBusqueda, euros } from "../components/ui.jsx";
import FilaMovimiento from "./tesoreria/FilaMovimiento.jsx";
import ModalConciliar from "./tesoreria/ModalConciliar.jsx";
import ModalResumenConciliacion from "./tesoreria/ModalResumenConciliacion.jsx";

const fmtFecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

export default function TesoreriaExtractosPage() {
  const [lista, setLista] = useState(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("pendientes");
  const [subiendo, setSubiendo] = useState(false);
  const [conciliandoAuto, setConciliandoAuto] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [activo, setActivo] = useState(null);
  const [coincidencias, setCoincidencias] = useState(null);
  const [resumenAuto, setResumenAuto] = useState(null);
  const [registro, setRegistro] = useState(null);
  const inputRef = useRef(null);

  async function cargar() {
    try {
      if (filtro === "registro") {
        const r = await fetch("/api/tesoreria/extractos/registro");
        const text = await r.text();
        let datos = [];
        try {
          datos = JSON.parse(text);
        } catch {
          throw new Error(text.slice(0, 200) || `Error ${r.status}`);
        }
        if (!r.ok) throw new Error(datos.error || "Error al cargar el registro");
        setRegistro(Array.isArray(datos) ? datos : []);
        return;
      }
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
      const params = new URLSearchParams({
        importe: String(Math.abs(mov.importe)),
        fecha: new Date(mov.fecha).toISOString().slice(0, 10),
        concepto: mov.concepto || "",
        signo: mov.importe >= 0 ? "1" : "-1",
      });
      const r = await fetch(`/api/tesoreria/extractos/coincidencias?${params}`);
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al buscar");
      setCoincidencias(datos.candidatas ?? []);
    } catch (err) {
      setCoincidencias([]);
    }
  }

  async function conciliarAutomatico() {
    if (!window.confirm("¿Conciliar automáticamente todos los movimientos pendientes por importe, fecha y referencia?")) return;
    setConciliandoAuto(true);
    setError(null);
    setAviso(null);
    try {
      const r = await fetch("/api/tesoreria/extractos/conciliar-automatico", { method: "POST" });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error en conciliación automática");
      setResumenAuto(datos.resultados ?? []);
      await cargar();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setConciliandoAuto(false);
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
      const dup = datos.duplicados ? ` (${datos.duplicados} duplicados ignorados)` : "";
      setAviso(`Se importaron ${datos.insertados} movimientos.${dup}`);
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

  const ETIQUETA_DOC = {
    factura_compra: "Factura de compra",
    gasto: "Gasto",
    factura_venta: "Factura de venta",
    facturas_venta: "Grupo de ventas",
    remesa: "Remesa SEPA",
    movimiento_tesoreria: "Tesorería",
    manual: "Sin factura",
  };

  const registroFiltrado = (registro ?? []).filter((e) =>
    coincideBusqueda(
      q,
      new Date(e.createdAt ?? e.movimiento?.fecha).toLocaleString("es-ES"),
      e.movimiento?.concepto || "",
      e.documento?.descripcion || "",
      e.usuario || "",
      e.documento?.criterio || "",
      e.notas || ""
    )
  );

  const esRegistro = filtro === "registro";

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
        <InputBusqueda value={q} onChange={setQ} placeholder={esRegistro ? "Buscar por fecha, concepto, usuario…" : "Buscar por fecha, concepto, importe…"} />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="input">
          <option value="pendientes">Pendientes</option>
          <option value="conciliados">Conciliados</option>
          <option value="todos">Todos</option>
          <option value="registro">Registro de conciliaciones</option>
        </select>
        {filtro === "pendientes" && (
          <button
            onClick={conciliarAutomatico}
            disabled={conciliandoAuto || subiendo}
            className="btn-secondary text-sm"
          >
            {conciliandoAuto ? "Conciliando…" : "Conciliar automático"}
          </button>
        )}
        {q && <button onClick={() => setQ("")} className="btn-ghost text-xs">Limpiar</button>}
        <span className="text-xs text-slate-500 ml-auto">
          {esRegistro ? `${registroFiltrado.length} de ${registro?.length ?? 0}` : `${filtrada.length} de ${lista?.length ?? 0}`}
        </span>
      </div>

      {esRegistro ? (
        <div className="panel px-3.5 py-2">
          {!registro ? null : registro.length === 0 ? (
            <EstadoVacio titulo="Sin conciliaciones registradas" descripcion="Cada vez que concilies o desconcilies un movimiento, quedará anotado aquí." />
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Cuándo</th>
                    <th>Acción</th>
                    <th>Movimiento</th>
                    <th className="text-right">Importe</th>
                    <th>Vinculado a</th>
                    <th>Criterio</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {registroFiltrado.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-slate-500 py-8">Sin resultados.</td></tr>
                  )}
                  {registroFiltrado.map((e) => (
                    <tr key={e._id}>
                      <td className="whitespace-nowrap text-slate-400">
                        {new Date(e.createdAt).toLocaleString("es-ES")}
                      </td>
                      <td>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                          e.accion === "desconciliacion"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : e.modo === "automatica"
                              ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>
                          {e.accion === "desconciliacion" ? "Desconciliado" : e.modo === "automatica" ? "Automática" : "Manual"}
                        </span>
                      </td>
                      <td className="max-w-[240px]">
                        <span className="block truncate" title={e.movimiento?.concepto}>{e.movimiento?.concepto}</span>
                        <span className="block text-xs text-slate-500">{fmtFecha(e.movimiento?.fecha)}</span>
                      </td>
                      <td className="text-right whitespace-nowrap">{euros(Math.abs(e.movimiento?.importe ?? 0))}</td>
                      <td className="max-w-[220px]">
                        <span className="text-[10px] font-semibold uppercase rounded-full bg-white/5 text-slate-300 border border-white/10 px-1.5 py-0.5 mr-1.5">
                          {ETIQUETA_DOC[e.documento?.tipo] ?? e.documento?.tipo}
                        </span>
                        <span className="text-slate-200">{e.documento?.descripcion}</span>
                      </td>
                      <td className="max-w-[200px] text-xs text-slate-400">
                        <span className="block truncate" title={e.documento?.criterio}>{e.documento?.criterio}</span>
                      </td>
                      <td className="text-xs text-slate-400">{e.usuario || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
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
      )}

      {activo && (
        <ModalConciliar
          movimiento={activo}
          candidatas={coincidencias}
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

      {resumenAuto && (
        <ModalResumenConciliacion
          resultados={resumenAuto}
          onCerrar={() => setResumenAuto(null)}
        />
      )}
    </div>
  );
}
