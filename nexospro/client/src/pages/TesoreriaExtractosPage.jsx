import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda, euros } from "../components/ui.jsx";
import { IconBorrar, IconCheck } from "../components/icons.jsx";

const formatearFecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

function ModalConciliar({ movimiento, facturas, onConciliar, onCerrar }) {
  const [facturaElegida, setFacturaElegida] = useState("");
  const [notasConciliacion, setNotasConciliacion] = useState("");
  const [guardandoConciliacion, setGuardandoConciliacion] = useState(false);
  const [errorConciliacion, setErrorConciliacion] = useState(null);

  async function guardarConciliacion() {
    if (!facturaElegida) return;
    setGuardandoConciliacion(true);
    setErrorConciliacion(null);
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
      setErrorConciliacion(err.message);
    } finally {
      setGuardandoConciliacion(false);
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
          <p className="text-sm text-slate-500 py-6 text-center">No hay facturas de compra pendientes que cuadren con este importe.</p>
        ) : (
          <div className="space-y-2">
            {facturas.map((facturaCandidata) => (
              <label
                key={facturaCandidata._id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                  facturaElegida === facturaCandidata._id ? "border-accent/40 bg-accent/10" : "border-white/10 hover:bg-white/[0.03]"
                }`}
              >
                <input
                  type="radio"
                  name="factura"
                  checked={facturaElegida === facturaCandidata._id}
                  onChange={() => setFacturaElegida(facturaCandidata._id)}
                  className="accent-cyan-400 w-4 h-4"
                />
                <span className="flex-1">
                  <span className="text-white font-medium">{facturaCandidata.numeroFacturaProveedor || "s/n"}</span>
                  <span className="block text-sm text-slate-300 truncate" title={facturaCandidata.proveedor?.nombre}>
                    {facturaCandidata.proveedor?.nombre || "—"}
                  </span>
                  <span className="block text-xs text-slate-500">Pendiente: {euros(facturaCandidata.pendiente)}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4">
          <label className="text-sm text-slate-400 block mb-1">Notas</label>
          <input value={notasConciliacion} onChange={(e) => setNotasConciliacion(e.target.value)} className="input w-full" />
        </div>

        {errorConciliacion && <p className="mt-3 text-sm text-red-400">{errorConciliacion}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCerrar} className="btn-ghost">Cancelar</button>
          <button onClick={guardarConciliacion} disabled={guardandoConciliacion || !facturaElegida || !facturas?.length} className="btn-primary">
            {guardandoConciliacion ? "Guardando…" : "Conciliar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TesoreriaExtractosPage() {
  const [listaMovimientos, setListaMovimientos] = useState(null);
  const [textoBusqueda, setTextoBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("pendientes");
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [mensajeError, setMensajeError] = useState(null);
  const [mensajeAviso, setMensajeAviso] = useState(null);
  const [movimientoActivo, setMovimientoActivo] = useState(null);
  const [facturasCoincidentes, setFacturasCoincidentes] = useState(null);
  const inputArchivoRef = useRef(null);

  async function cargarMovimientos() {
    try {
      const paramConciliados = filtroEstado === "pendientes" ? "0" : filtroEstado === "conciliados" ? "1" : "todos";
      const respuesta = await fetch(`/api/tesoreria/extractos?conciliados=${paramConciliados}`);
      const texto = await respuesta.text();
      let datos = [];
      try {
        datos = JSON.parse(texto);
      } catch {
        throw new Error(texto.slice(0, 200) || `Error ${respuesta.status} del servidor`);
      }
      if (!respuesta.ok) throw new Error(datos.error || "Error al cargar");
      setListaMovimientos(Array.isArray(datos) ? datos : []);
    } catch (err) {
      setMensajeError(String(err?.message || err));
      setListaMovimientos([]);
    }
  }

  useEffect(() => {
    cargarMovimientos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado]);

  async function buscarFacturasCoincidentes(movimiento) {
    setFacturasCoincidentes(null);
    try {
      const respuesta = await fetch(
        `/api/tesoreria/extractos/coincidencias?importe=${Math.abs(movimiento.importe)}&fecha=${new Date(movimiento.fecha).toISOString().slice(0, 10)}`
      );
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || "Error al buscar");
      setFacturasCoincidentes(datos.candidatas);
    } catch (err) {
      setFacturasCoincidentes([]);
    }
  }

  async function importarArchivo(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    setSubiendoArchivo(true);
    setMensajeError(null);
    setMensajeAviso(null);
    try {
      const formData = new FormData();
      formData.append("extracto", archivo);
      const respuesta = await fetch("/api/tesoreria/extractos/upload", { method: "POST", body: formData });
      const texto = await respuesta.text();
      let datos = {};
      try {
        datos = JSON.parse(texto);
      } catch {
        throw new Error(texto.slice(0, 200) || `Error ${respuesta.status} del servidor`);
      }
      if (!respuesta.ok) throw new Error(datos.error || "Error al procesar");
      setMensajeAviso(`Se importaron ${datos.insertados} movimientos del extracto.`);
      await cargarMovimientos();
    } catch (err) {
      setMensajeError(String(err?.message || err));
    } finally {
      setSubiendoArchivo(false);
    }
  }

  async function desconciliarMovimiento(movimiento) {
    if (!window.confirm("¿Desconciliar este movimiento?")) return;
    const respuesta = await fetch(`/api/tesoreria/extractos/${movimiento._id}/conciliacion`, { method: "DELETE" });
    if (respuesta.ok) cargarMovimientos();
    else alert((await respuesta.json()).error || "No se pudo desconciliar");
  }

  async function borrarMovimiento(movimiento) {
    if (!window.confirm("¿Borrar este movimiento del extracto?")) return;
    const respuesta = await fetch(`/api/tesoreria/extractos/${movimiento._id}`, { method: "DELETE" });
    if (respuesta.ok) cargarMovimientos();
    else alert((await respuesta.json()).error || "No se pudo borrar");
  }

  const movimientosFiltrados = (listaMovimientos ?? []).filter((movimientoItem) =
    coincideBusqueda(
      textoBusqueda,
      formatearFecha(movimientoItem.fecha),
      movimientoItem.concepto || "",
      movimientoItem.referencia || "",
      euros(movimientoItem.importe),
      movimientoItem.notas || ""
    )
  );

  return (
    <div>
      <CabeceraPagina
        titulo="Extractos bancarios"
        descripcion="Importa el extracto de tu banco y concilia los cargos con facturas de compra pendientes de pago."
      >
        <input ref={inputArchivoRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={importarArchivo} />
        <button onClick={() => inputArchivoRef.current?.click()} disabled={subiendoArchivo} className="btn-primary">
          {subiendoArchivo ? "Importando…" : "Importar extracto"}
        </button>
      </CabeceraPagina>

      {mensajeError && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{mensajeError}</div>
      )}
      {mensajeAviso && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{mensajeAviso}</div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <InputBusqueda value={textoBusqueda} onChange={setTextoBusqueda} placeholder="Buscar por fecha, concepto, importe…" />
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="input">
          <option value="pendientes">Pendientes de conciliar</option>
          <option value="conciliados">Conciliados</option>
          <option value="todos">Todos</option>
        </select>
        {textoBusqueda && <button onClick={() => setTextoBusqueda("")} className="btn-ghost text-xs">Limpiar</button>}
        <span className="text-xs text-slate-500 ml-auto">{movimientosFiltrados.length} de {listaMovimientos?.length ?? 0}</span>
      </div>

      <div className="panel px-3.5 py-2">
        {!listaMovimientos ? null : listaMovimientos.length === 0 ? (
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
                {movimientosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-8">Ningún movimiento cumple esos filtros.</td>
                  </tr>
                )}
                {movimientosFiltrados.map((movimientoItem) => (
                  <tr key={movimientoItem._id} className={movimientoItem.conciliadoCon?.tipo ? "opacity-70" : ""}>
                    <td className="text-slate-400 num whitespace-nowrap">{formatearFecha(movimientoItem.fecha)}</td>
                    <td className="text-slate-300 max-w-[260px]">
                      <span className="block truncate" title={movimientoItem.concepto}>{movimientoItem.concepto}</span>
                    </td>
                    <td className="text-slate-500 text-sm num">{movimientoItem.referencia || "—"}</td>
                    <td className={`text-right whitespace-nowrap num font-semibold ${movimientoItem.importe < 0 ? "text-rose-300" : "text-emerald-300"}`}>
                      {euros(movimientoItem.importe)}
                    </td>
                    <td className="text-right text-slate-500 whitespace-nowrap num">{euros(movimientoItem.saldo)}</td>
                    <td>
                      {movimientoItem.conciliadoCon?.tipo ? (
                        <Badge tono="green">Conciliado</Badge>
                      ) : (
                        <Badge tono="amber">Pendiente</Badge>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {!movimientoItem.conciliadoCon?.tipo ? (
                        <button
                          onClick={() => {
                            setMovimientoActivo(movimientoItem);
                            buscarFacturasCoincidentes(movimientoItem);
                          }}
                          className="text-xs text-accent hover:underline mr-3"
                        >
                          Conciliar
                        </button>
                      ) : (
                        <button
                          onClick={() => desconciliarMovimiento(movimientoItem)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-emerald-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors align-middle mr-2"
                          title="Desconciliar"
                        >
                          <IconCheck />
                        </button>
                      )}
                      <button
                        onClick={() => borrarMovimiento(movimientoItem)}
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

      {movimientoActivo && (
        <ModalConciliar
          movimiento={movimientoActivo}
          facturas={facturasCoincidentes}
          onConciliar={() => {
            setMovimientoActivo(null);
            setFacturasCoincidentes(null);
            cargarMovimientos();
          }}
          onCerrar={() => {
            setMovimientoActivo(null);
            setFacturasCoincidentes(null);
          }}
        />
      )}
    </div>
  );
}
