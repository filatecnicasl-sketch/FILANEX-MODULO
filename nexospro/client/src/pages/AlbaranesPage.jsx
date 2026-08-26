import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import FormDocumento from "../components/FormDocumento.jsx";
import { Badge, InputBusqueda, coincideBusqueda, euros } from "../components/ui.jsx";
import { IconImprimir, IconPdf, IconFirma, IconEditar, IconBorrar } from "../components/icons.jsx";
import { imprimirDocumento } from "../utils/imprimir.js";
import { descargarPdf, imprimirDocumentoRapido } from "../utils/pdf.js";

// Totales de un albarán a partir de sus líneas (con el descuento % aplicado).
function totalesDe(a) {
  const neto = (l) =>
    (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0) * (1 - (Number(l.descuento) || 0) / 100);
  const base = (a.lineas ?? []).reduce((s, l) => s + neto(l), 0);
  const iva = (a.lineas ?? []).reduce((s, l) => s + neto(l) * ((Number(l.iva) || 0) / 100), 0);
  return { base, iva, total: base + iva };
}

// Valida DNI/NIE español (la API lo vuelve a comprobar).
function dniValido(v) {
  const dni = String(v ?? "").toUpperCase().replace(/[\s.-]/g, "");
  const m = dni.match(/^([XYZ])?(\d{7,8})([A-Z])$/);
  if (!m) return false;
  const num = (m[1] ? String("XYZ".indexOf(m[1])) : "") + m[2];
  return "TRWAGMYFPDXBNJZSQVHLCKE"[Number(num) % 23] === m[3];
}

// Pantalla de firma de entrega: pensada para el móvil/tableta del repartidor.
// El cliente firma con el dedo y se acredita con su DNI; no hace falta papel.
function ModalFirma({ albaran, onCerrar, onFirmado }) {
  const lienzo = useRef(null);
  const dibujando = useRef(false);
  const vacio = useRef(true);
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const c = lienzo.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function punto(e) {
    const r = lienzo.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function empezar(e) {
    dibujando.current = true;
    const ctx = lienzo.current.getContext("2d");
    const p = punto(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    lienzo.current.setPointerCapture(e.pointerId);
  }
  function mover(e) {
    if (!dibujando.current) return;
    const ctx = lienzo.current.getContext("2d");
    const p = punto(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    vacio.current = false;
  }
  function terminar() {
    dibujando.current = false;
  }
  function limpiar() {
    const c = lienzo.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    vacio.current = true;
  }

  async function confirmar() {
    setError(null);
    if (!nombre.trim()) return setError("Indica el nombre y apellidos de quien recoge.");
    if (!dniValido(dni)) return setError("El DNI/NIE no es válido.");
    if (vacio.current) return setError("Falta la firma.");
    setEnviando(true);
    try {
      const r = await fetch(`/api/albaranes-venta/${albaran._id}/firma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          dni,
          imagen: lienzo.current.toDataURL("image/png"),
        }),
      });
      const json = await r.json();
      if (!r.ok) {
        setError(json.error || "No se pudo guardar la firma");
        setEnviando(false);
        return;
      }
      onFirmado();
    } catch {
      setError("No se pudo conectar con la API.");
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClick={onCerrar}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Firma de entrega · Albarán {albaran.serieNumero}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {albaran.cliente?.nombre} — la persona que recoge el material firma y se identifica con su DNI.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Nombre y apellidos
            </label>
            <input className="input w-full" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              DNI / NIE
            </label>
            <input className="input w-full num" value={dni} onChange={(e) => setDni(e.target.value)} placeholder="12345678Z" />
          </div>
        </div>

        <div>
          <label className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Firma
          </label>
          <canvas
            ref={lienzo}
            className="w-full h-44 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 touch-none cursor-crosshair"
            onPointerDown={empezar}
            onPointerMove={mover}
            onPointerUp={terminar}
            onPointerLeave={terminar}
          />
        </div>

        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={limpiar} className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Limpiar firma
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onCerrar} className="btn-ghost">
              Cancelar
            </button>
            <button type="button" onClick={confirmar} disabled={enviando} className="btn-primary disabled:opacity-50">
              {enviando ? "Guardando…" : "Confirmar entrega"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlbaranesPage() {
  const [albaranes, setAlbaranes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null); // albarán que se edita
  const [firmando, setFirmando] = useState(null); // albarán que se está firmando
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [params, setParams] = useSearchParams();

  // Abre directamente un albarán cuando llega ?abrir=<id> (p. ej. desde el historial del vehículo).
  useEffect(() => {
    const id = params.get("abrir");
    if (!id || albaranes.length === 0) return;
    const a = albaranes.find((x) => x._id === id);
    if (a) {
      setEditando(a);
      params.delete("abrir");
      setParams(params, { replace: true });
    }
  }, [albaranes, params, setParams]);

  // Filtra por todos los campos visibles de la tabla.
  const filtrada = albaranes.filter((a) => {
    const t = totalesDe(a);
    return coincideBusqueda(
      q,
      a.serieNumero,
      a.cliente?.nombre,
      a.cliente?.nif,
      a.fecha ? new Date(a.fecha).toLocaleDateString("es-ES") : "",
      euros(t.base),
      euros(t.iva),
      euros(t.total),
      t.total,
      a.estado,
      a.firmaEntrega?.fecha ? "firmado" : ""
    );
  });

  async function cargar() {
    try {
      const [ra, rc] = await Promise.all([
        fetch("/api/albaranes-venta"),
        fetch("/api/clientes"),
      ]);
      setAlbaranes(await ra.json());
      setClientes(await rc.json());
      setSeleccion([]);
    } catch {
      setError("No se pudo conectar con la API.");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function toggle(id) {
    setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function facturarSeleccionados() {
    setError(null);
    const r = await fetch("/api/albaranes-venta/facturar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: seleccion }),
    });
    if (r.ok) await cargar();
    else setError((await r.json()).error);
  }

  // Convierte un albarán suelto en factura BORRADOR (se valida en Ventas → Facturas).
  async function facturarUno(a) {
    setError(null);
    const r = await fetch("/api/albaranes-venta/facturar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [a._id] }),
    });
    if (r.ok) await cargar();
    else setError((await r.json()).error);
  }

  async function borrar(a) {
    if (!window.confirm(`¿Borrar el albarán ${a.serieNumero}?`)) return;
    setError(null);
    const r = await fetch(`/api/albaranes-venta/${a._id}`, { method: "DELETE" });
    if (r.ok) await cargar();
    else setError((await r.json()).error);
  }

  const pendientes = albaranes.filter((a) => a.estado === "pendiente");

  return (
    <>
      <CabeceraPagina
        titulo="Albaranes de venta"
        descripcion="Trabajos entregados pendientes de facturar. Selecciona varios del mismo cliente para facturarlos juntos."
      >
        <div className="space-x-2">
          <button onClick={() => window.print()} className="btn-ghost">
            Imprimir
          </button>
          {seleccion.length > 0 && (
            <button
              onClick={facturarSeleccionados}
              className="btn-primary"
            >
              Facturar {seleccion.length} seleccionado(s)
            </button>
          )}
          <button
            onClick={() => setMostrarForm(true)}
            className="btn-ghost"
          >
            Nuevo albarán
          </button>
        </div>
      </CabeceraPagina>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {mostrarForm && (
        <FormDocumento
          titulo="Nuevo albarán"
          clientes={clientes}
          url="/api/albaranes-venta"
          onCreado={() => { setMostrarForm(false); cargar(); }}
          onCerrar={() => setMostrarForm(false)}
        />
      )}

      {editando && (
        <FormDocumento
          titulo={`Editar albarán ${editando.serieNumero}`}
          clientes={clientes}
          url="/api/albaranes-venta"
          inicial={editando}
          onCreado={() => { setEditando(null); cargar(); }}
          onCerrar={() => setEditando(null)}
        />
      )}

      {albaranes.length === 0 ? (
        <div className="panel p-8 text-center text-slate-500 text-sm">
          Sin albaranes todavía.
        </div>
      ) : (
        <>
          <div className="mb-3">
            <InputBusqueda value={q} onChange={setQ} />
          </div>
        <div className="panel overflow-x-auto">
          <table className="tabla text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th className="px-3.5 py-3 w-8"></th>
                <th className="px-3.5 py-3">Nº</th>
                <th className="px-3.5 py-3">Cliente</th>
                <th className="px-3.5 py-3">Fecha</th>
                <th className="px-3.5 py-3 text-right">Líneas</th>
                <th className="px-3.5 py-3 text-right">Base</th>
                <th className="px-3.5 py-3 text-right">IVA</th>
                <th className="px-3.5 py-3 text-right">Total</th>
                <th className="px-3.5 py-3">Estado</th>
                <th className="px-3.5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtrada.map((a) => (
                <tr key={a._id}>
                  <td className="px-3.5 py-3">
                    {a.estado === "pendiente" && (
                      <input
                        type="checkbox"
                        checked={seleccion.includes(a._id)}
                        onChange={() => toggle(a._id)}
                        className="accent-cyan-400"
                      />
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-white font-medium">{a.serieNumero}</td>
                  <td className="px-3.5 py-3 text-slate-300">{a.cliente?.nombre ?? "—"}</td>
                  <td className="px-3.5 py-3 text-slate-400 whitespace-nowrap">
                    {new Date(a.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  </td>
                  <td className="px-3.5 py-3 text-right text-slate-400 num">{a.lineas?.length ?? 0}</td>
                  <td className="px-3.5 py-3 text-right text-slate-400 whitespace-nowrap num">{euros(totalesDe(a).base)}</td>
                  <td className="px-3.5 py-3 text-right text-slate-400 whitespace-nowrap num">{euros(totalesDe(a).iva)}</td>
                  <td className="px-3.5 py-3 text-right text-white font-medium whitespace-nowrap num">{euros(totalesDe(a).total)}</td>
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge tono={a.estado === "pendiente" ? "amber" : "green"}>{a.estado}</Badge>
                      {a.firmaEntrega?.fecha && (
                        <span
                          title={`Recogido por ${a.firmaEntrega.nombre} (${a.firmaEntrega.dni}) el ${new Date(a.firmaEntrega.fecha).toLocaleString("es-ES")}`}
                        >
                          <Badge tono="emerald">firmado</Badge>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-right whitespace-nowrap">
                    {a.estado === "pendiente" && (
                      <>
                        <button
                          onClick={() => facturarUno(a)}
                          title="Convertir en factura borrador (se valida en Ventas → Facturas)"
                          className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-lg hover:bg-accent/20 align-middle mr-1"
                        >
                          → Factura
                        </button>
                        <button
                          onClick={() => setEditando(a)}
                          title="Editar albarán"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle mr-1"
                        >
                          <IconEditar />
                        </button>
                        <button
                          onClick={() => borrar(a)}
                          title="Borrar albarán"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors align-middle mr-1"
                        >
                          <IconBorrar />
                        </button>
                      </>
                    )}
                    {!a.firmaEntrega?.fecha && (
                      <button
                        onClick={() => setFirmando(a)}
                        title="Firmar entrega (móvil/tableta)"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle mr-1"
                      >
                        <IconFirma />
                      </button>
                    )}
                    {a.firmaEntrega?.imagen && (
                      <a
                        href={a.firmaEntrega.imagen}
                        target="_blank"
                        rel="noreferrer"
                        title={`Ver firma de ${a.firmaEntrega.nombre}`}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle mr-1"
                      >
                        <IconFirma />
                      </a>
                    )}
                    <button
                      onClick={() => imprimirDocumentoRapido("albaran-venta", a._id)}
                      title="Imprimir"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle"
                    >
                      <IconImprimir />
                    </button>
                    <button
                      onClick={() => descargarPdf("albaran-venta", a._id, a.serieNumero)}
                      title="Descargar PDF"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle"
                    >
                      <IconPdf />
                    </button>
                  </td>
                </tr>
              ))}
              {filtrada.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3.5 py-8 text-center text-slate-500">
                    Sin resultados para «{q}».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {pendientes.length > 0 && (
            <p className="px-3.5 py-3 text-xs text-slate-500 border-t border-white/5">
              {pendientes.length} pendiente(s) de facturar.
            </p>
          )}
        </div>
        </>
      )}

      {firmando && (
        <ModalFirma
          albaran={firmando}
          onCerrar={() => setFirmando(null)}
          onFirmado={() => { setFirmando(null); cargar(); }}
        />
      )}
    </>
  );
}
