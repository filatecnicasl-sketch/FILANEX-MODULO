import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import ModalPrestamoCortesia from "./ModalPrestamoCortesia.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import { IconImprimir } from "../../components/icons.jsx";
import { imprimirFicha } from "../../utils/imprimir.js";

const campo = "input w-full";
const fmtFecha = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "—");

export default function TallerCortesiaPage() {
  const [prestamos, setPrestamos] = useState(null);
  const [error, setError] = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [devolviendo, setDevolviendo] = useState(null);
  const [q, setQ] = useState("");

  const estadoPrestamo = (p) =>
    p.estado === "devuelto" ? { nombre: "Devuelto", tono: "slate" }
      : p.vencido ? { nombre: "Vencido", tono: "red" }
      : { nombre: "Activo", tono: "cyan" };

  // Filtra por todos los campos visibles de la tabla.
  const filtrada = (prestamos ?? []).filter((p) =>
    coincideBusqueda(
      q,
      p.matricula,
      p.clienteNombre,
      p.numeroOrden,
      estadoPrestamo(p).nombre,
      fmtFecha(p.fechaSalida),
      fmtFecha(p.fechaPrevista),
      fmtFecha(p.fechaDevolucion)
    )
  );

  async function cargar() {
    try {
      const r = await fetch("/api/taller/cortesia");
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setPrestamos(datos);
    } catch (e) {
      setError(e.message);
      setPrestamos([]);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function borrar(p) {
    if (!window.confirm(`¿Borrar el préstamo de ${p.matricula}?`)) return;
    const r = await fetch(`/api/taller/cortesia/${p._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert("No se pudo borrar");
  }

  return (
    <>
      <CabeceraPagina titulo="Vehículos de cortesía" descripcion="Préstamos a clientes mientras su coche está en el taller.">
        <button onClick={() => setModalNuevo(true)} className="btn-primary">
          Nuevo préstamo
        </button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {prestamos?.length > 0 && (
        <div className="mb-3">
          <InputBusqueda value={q} onChange={setQ} />
        </div>
      )}

      <div className="panel px-3.5 py-2">
        {!prestamos ? null : prestamos.length === 0 ? (
          <EstadoVacio
            titulo="Sin préstamos"
            descripcion="Cuando dejes un coche de cortesía a un cliente, regístralo aquí para controlar su devolución."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Vehículo</th>
                  <th>Cliente</th>
                  <th>Salida</th>
                  <th>Devolución prevista</th>
                  <th>Devuelto</th>
                  <th className="text-right">KM</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((p) => {
                  const est = estadoPrestamo(p);
                  return (
                    <tr key={p._id}>
                      <td className="font-bold text-white whitespace-nowrap num">{p.matricula}</td>
                      <td className="text-slate-300">
                        {p.clienteNombre}
                        {p.numeroOrden && <span className="text-xs text-slate-500 num"> · {p.numeroOrden}</span>}
                      </td>
                      <td className="text-slate-300 whitespace-nowrap num">{fmtFecha(p.fechaSalida)}</td>
                      <td className={`whitespace-nowrap num ${p.vencido ? "text-red-300 font-semibold" : "text-slate-300"}`}>
                        {fmtFecha(p.fechaPrevista)}
                      </td>
                      <td className="text-slate-300 whitespace-nowrap num">{fmtFecha(p.fechaDevolucion)}</td>
                      <td className="text-right text-slate-300 whitespace-nowrap num">
                        {p.kmSalida != null ? p.kmSalida.toLocaleString("es-ES") : "—"}
                        {p.kmEntrada != null ? ` → ${p.kmEntrada.toLocaleString("es-ES")}` : ""}
                      </td>
                      <td><Badge tono={est.tono}>{est.nombre}</Badge></td>
                      <td className="text-right whitespace-nowrap">
                        <button
                          onClick={() =>
                            imprimirFicha({
                              titulo: "Préstamo de cortesía",
                              subtitulo: p.matricula,
                              campos: [
                                ["Vehículo de cortesía", p.matricula],
                                ["Cliente", p.clienteNombre],
                                ["Orden relacionada", p.numeroOrden],
                                ["Fecha de salida", fmtFecha(p.fechaSalida)],
                                ["Devolución prevista", fmtFecha(p.fechaPrevista)],
                                ["Devuelto el", fmtFecha(p.fechaDevolucion)],
                                ["KM salida", p.kmSalida != null ? p.kmSalida.toLocaleString("es-ES") : undefined],
                                ["KM entrada", p.kmEntrada != null ? p.kmEntrada.toLocaleString("es-ES") : undefined],
                                ["Estado", est.nombre],
                              ],
                            })
                          }
                          title="Imprimir contrato de préstamo"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle mr-2"
                        >
                          <IconImprimir />
                        </button>
                        {p.estado === "activo" && (
                          <button
                            onClick={() => setDevolviendo(p)}
                            className="text-xs text-accent hover:underline mr-3"
                          >
                            Devolver
                          </button>
                        )}
                        <button onClick={() => borrar(p)} className="text-xs text-rose-400 hover:underline">
                          Borrar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-slate-500 py-8">
                      Sin resultados para «{q}».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalNuevo && (
        <ModalPrestamoCortesia
          onCerrar={() => setModalNuevo(false)}
          onCreado={() => {
            setModalNuevo(false);
            cargar();
          }}
        />
      )}

      {devolviendo && (
        <ModalDevolver
          prestamo={devolviendo}
          onCerrar={() => setDevolviendo(null)}
          onHecho={() => {
            setDevolviendo(null);
            cargar();
          }}
        />
      )}
    </>
  );
}


function ModalDevolver({ prestamo, onCerrar, onHecho }) {
  const [kmEntrada, setKmEntrada] = useState("");
  const [notas, setNotas] = useState(prestamo.notas ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function devolver(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`/api/taller/cortesia/${prestamo._id}/devolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kmEntrada: kmEntrada || undefined, notas: notas || undefined }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo registrar la devolución");
      onHecho();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-1">Devolución de {prestamo.matricula}</h2>
        <p className="text-sm text-slate-400 mb-4">
          {prestamo.clienteNombre} · salida {fmtFecha(prestamo.fechaSalida)}
        </p>
        <form onSubmit={devolver} className="space-y-3">
          <div>
            <label className="text-sm text-slate-400 block mb-1">KM de entrada</label>
            <input
              type="number"
              min="0"
              className={campo}
              value={kmEntrada}
              onChange={(e) => setKmEntrada(e.target.value)}
              placeholder={prestamo.kmSalida != null ? `Salió con ${prestamo.kmSalida.toLocaleString("es-ES")}` : ""}
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Notas</label>
            <input className={campo} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary disabled:opacity-50">
              {guardando ? "Registrando…" : "Registrar devolución"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
