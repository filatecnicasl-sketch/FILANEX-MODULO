import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import ModalPrestamoCortesia from "./ModalPrestamoCortesia.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import { IconImprimir, IconEditar } from "../../components/icons.jsx";
import { imprimirContratoCortesia } from "../../utils/imprimir-cortesia.js";
import { fondoSeguro } from "../../lib/cierreProtegido.js";

const campo = "input w-full";
const fmtFecha = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "—");

export default function TallerCortesiaPage() {
  const [prestamos, setPrestamos] = useState(null);
  const [flota, setFlota] = useState([]);
  const [vista, setVista] = useState("prestamos"); // prestamos | flota
  const [error, setError] = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalFlota, setModalFlota] = useState(false);
  const [editando, setEditando] = useState(null);
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
      p.telefono,
      p.numeroOrden,
      estadoPrestamo(p).nombre,
      fmtFecha(p.fechaSalida),
      fmtFecha(p.fechaPrevista),
      fmtFecha(p.fechaDevolucion)
    )
  );

  // Préstamo activo de cada vehículo de la flota (para ver quién lo tiene).
  const prestamoActivoPorVehiculo = Object.fromEntries(
    (prestamos ?? [])
      .filter((p) => p.estado === "activo")
      .map((p) => [String(p.vehiculo?._id ?? p.vehiculo), p])
  );

  async function cargar() {
    try {
      const [rp, rv] = await Promise.all([
        fetch("/api/taller/cortesia"),
        fetch("/api/taller/vehiculos"),
      ]);
      const datos = await rp.json();
      if (!rp.ok) throw new Error(datos.error || "Error al cargar");
      setPrestamos(datos);
      const vehiculos = rv.ok ? await rv.json() : [];
      setFlota((vehiculos ?? []).filter((v) => v.tipo === "cortesia"));
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

  // Dar de baja un vehículo de la flota de cortesía (propuesta Montiel): si
  // tiene órdenes o préstamos registrados, el servidor lo impide para no
  // perder el historial.
  async function bajaFlota(v) {
    const prestado = prestamoActivoPorVehiculo[String(v._id)];
    if (prestado) {
      alert(`${v.matricula} está prestado a ${prestado.clienteNombre}. Registra su devolución antes de darlo de baja.`);
      return;
    }
    if (!window.confirm(`¿Quitar ${v.matricula} de la flota de cortesía? Se borra el vehículo del programa.`)) return;
    const r = await fetch(`/api/taller/vehiculos/${v._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else {
      const datos = await r.json().catch(() => ({}));
      alert(datos.error || "No se pudo quitar de la flota");
    }
  }

  return (
    <>
      <CabeceraPagina titulo="Vehículos de cortesía" descripcion="Flota de cortesía y préstamos a clientes mientras su coche está en el taller.">
        {vista === "prestamos" ? (
          <button onClick={() => setModalNuevo(true)} className="btn-primary">
            Nuevo préstamo
          </button>
        ) : (
          <button onClick={() => setModalFlota(true)} className="btn-primary">
            Añadir a la flota
          </button>
        )}
      </CabeceraPagina>

      {/* Pestañas: préstamos registrados / gestión de la flota propia */}
      <div className="flex gap-1 mb-4 border-b border-line/60 pb-1">
        <button
          type="button"
          onClick={() => setVista("prestamos")}
          className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
            vista === "prestamos" ? "bg-accent text-white" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }`}
        >
          Préstamos {prestamos ? `(${prestamos.length})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setVista("flota")}
          className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
            vista === "flota" ? "bg-accent text-white" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }`}
        >
          Flota {flota.length ? `(${flota.length})` : ""}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {vista === "flota" ? (
        <div className="panel px-3.5 py-2">
          {flota.length === 0 ? (
            <EstadoVacio
              titulo="Sin vehículos de cortesía"
              descripcion="Añade aquí los coches que tenéis para prestar a los clientes; después registra sus préstamos en la pestaña Préstamos."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Matrícula</th>
                    <th>Marca / modelo</th>
                    <th>Color</th>
                    <th>Situación</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {flota.map((v) => {
                    const prestado = prestamoActivoPorVehiculo[String(v._id)];
                    return (
                      <tr key={v._id}>
                        <td className="font-bold text-white whitespace-nowrap num">{v.matricula}</td>
                        <td className="text-slate-300">{[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}</td>
                        <td className="text-slate-300">{v.color || "—"}</td>
                        <td>
                          {prestado ? (
                            <span className="text-xs text-amber-300" title={`Devolución prevista ${fmtFecha(prestado.fechaPrevista)}`}>
                              Prestado a {prestado.clienteNombre} · hasta {fmtFecha(prestado.fechaPrevista)}
                            </span>
                          ) : (
                            <Badge tono="cyan">Libre</Badge>
                          )}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          {!prestado && (
                            <button onClick={() => bajaFlota(v)} className="text-xs text-rose-400 hover:underline">
                              Quitar de la flota
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
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
                  <th>Teléfono</th>
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
                      <td className="text-slate-300 whitespace-nowrap num">{p.telefono ?? "—"}</td>
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
                          onClick={() => imprimirContratoCortesia(p, { copias: 2 })}
                          title="Imprimir contrato por duplicado (cliente y taller)"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle mr-2"
                        >
                          <IconImprimir />
                        </button>
                        <button
                          onClick={() => setEditando(p)}
                          title="Editar préstamo"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle mr-2"
                        >
                          <IconEditar />
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
                    <td colSpan={9} className="text-center text-slate-500 py-8">
                      Sin resultados para «{q}».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {modalFlota && (
        <ModalFlotaCortesia
          onCerrar={() => setModalFlota(false)}
          onCreado={() => {
            setModalFlota(false);
            cargar();
          }}
        />
      )}

      {modalNuevo && (
        <ModalPrestamoCortesia
          onCerrar={() => setModalNuevo(false)}
          onCreado={() => {
            setModalNuevo(false);
            cargar();
          }}
        />
      )}

      {editando && (
        <ModalPrestamoCortesia
          prestamo={editando}
          onCerrar={() => setEditando(null)}
          onCreado={() => {
            setEditando(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" {...fondoSeguro(onCerrar)}>
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

// Alta de un vehículo a la flota de cortesía (propuesta Montiel): matrícula
// y descripción básicos; se crea con tipo "cortesia" para que aparezca en el
// desplegable de préstamos.
function ModalFlotaCortesia({ onCerrar, onCreado }) {
  const campo = "w-full rounded-xl bg-white/5 border border-line/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50";
  const [form, setForm] = useState({ matricula: "", marca: "", modelo: "", color: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function guardar(e) {
    e.preventDefault();
    if (!form.matricula.trim()) {
      setError("La matrícula es obligatoria");
      return;
    }
    setGuardando(true);
    try {
      const r = await fetch("/api/taller/vehiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, matricula: form.matricula.trim().toUpperCase(), tipo: "cortesia" }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo guardar");
      onCreado();
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCerrar}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={guardar}
        className="w-full max-w-lg rounded-2xl bg-[#0f172a] border border-line/60 p-6 space-y-4"
      >
        <h3 className="text-lg font-bold text-white">Añadir vehículo a la flota</h3>

        <div>
          <label className="text-sm text-slate-400 block mb-1">Matrícula *</label>
          <input
            className={`${campo} num uppercase`}
            value={form.matricula}
            onChange={(e) => setForm({ ...form, matricula: e.target.value })}
            placeholder="1234ABC"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-400 block mb-1">Marca</label>
            <input className={campo} value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Modelo</label>
            <input className={campo} value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-sm text-slate-400 block mb-1">Color</label>
          <input className={campo} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={guardando} className="btn-primary disabled:opacity-50">
            {guardando ? "Guardando…" : "Añadir a la flota"}
          </button>
        </div>
      </form>
    </div>
  );
}
