import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Badge, euros, Avatar, coincideBusqueda } from "../components/ui.jsx";
import { IconOjo, IconPdf, IconOcr } from "../components/icons.jsx";
import { useCierreProtegido } from "../lib/cierreProtegido.js";

const btnIcono =
  "inline-flex items-center justify-center w-6 h-6 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors";

const TONO_COBRO = { pendiente: "amber", parcial: "cyan", cobrada: "green" };
const METODOS_COBRO = ["transferencia", "efectivo", "tarjeta", "remesa", "otro"];

const fechaInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

// Abre el PDF original pidiéndolo con fetch: un enlace directo no lleva la
// sesión y el servidor responde 401.
async function abrirPdfAutofactura(id) {
  const r = await fetch(`/api/facturas-venta/${id}/pdf`);
  if (!r.ok) {
    let mensaje = `No se pudo obtener el PDF (${r.status})`;
    try {
      const datos = await r.json();
      if (datos?.error) mensaje = datos.error;
    } catch {
      // respuesta sin JSON
    }
    alert(mensaje);
    return;
  }
  const url = URL.createObjectURL(await r.blob());
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Revisión de una autofactura recién subida por OCR (estado borrador): se
// corrigen los datos leídos y, cuando están bien, se valida. Hasta entonces
// no cuenta en informes ni en tesorería.
function RevisarAutofactura({ f, avisos, onCerrar, onGuardar, onValidar, onEliminar }) {
  const [datos, setDatos] = useState({
    numero: f.serieNumero ?? "",
    fecha: fechaInput(f.fechaExpedicion),
    vencimiento: fechaInput(f.vencimiento),
    concepto: f.descripcion ?? "",
    base: f.baseImponible ?? 0,
    iva: f.lineas?.[0]?.iva ?? 21,
    clienteId: f.cliente?._id ?? null,
    clienteNombre: f.cliente?.nombre ?? "",
  });
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const cierre = useCierreProtegido(onCerrar);

  const set = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));
  const base = Number(datos.base) || 0;
  const cuota = Math.round(base * (Number(datos.iva) || 0)) / 100;
  const total = Math.round((base + cuota) * 100) / 100;

  // Buscador de cliente: cambia la contraparte si el OCR se equivocó.
  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/clientes?q=${encodeURIComponent(q)}`);
        if (r.ok) setResultados((await r.json()).slice(0, 8));
      } catch {
        // sin resultados
      }
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda]);

  function elegirCliente(c) {
    setDatos((d) => ({ ...d, clienteId: c._id, clienteNombre: c.nombre }));
    setBusqueda("");
    setResultados([]);
  }

  const cuerpoFactura = () => ({
    cliente: datos.clienteId,
    serieNumero: String(datos.numero ?? "").trim(),
    fechaExpedicion: datos.fecha || undefined,
    vencimiento: datos.vencimiento || undefined,
    descripcion: datos.concepto,
    metodoPago: f.metodoPago ?? "Transferencia",
    lineas: [
      {
        descripcion: datos.concepto || "Autofactura",
        cantidad: 1,
        precioUnitario: base,
        iva: Number(datos.iva) || 21,
      },
    ],
  });

  async function accion({ validar = false } = {}) {
    if (!datos.clienteId) {
      setError("Selecciona una contraparte (cliente) antes de continuar.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      let r = await fetch(`/api/facturas-venta/${f._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpoFactura()),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo guardar la revisión");
      if (validar) {
        r = await fetch(`/api/facturas-venta/${f._id}/validar-autofactura`, { method: "POST" });
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo validar la autofactura");
        await onValidar();
      } else {
        await onGuardar();
      }
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      {...cierre.fondoProps}
    >
      <div
        className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white text-lg font-semibold">Revisar autofactura</h2>
            <p className="text-xs text-slate-500 mt-1">
              Comprueba los datos que ha leído el OCR y corrige lo que no cuadre. Al validar
              recibirá su número de la serie interna AUTO.
            </p>
          </div>
          <button onClick={onCerrar} className="text-slate-500 hover:text-white text-lg leading-none">×</button>
        </div>

        {avisos.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Avisos del OCR</p>
            <ul className="text-sm text-amber-800 list-disc list-inside">
              {avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
            Lectura sin avisos: revisa los datos igualmente antes de validar.
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500">Nº documento original</label>
            <input value={datos.numero} onChange={set("numero")} className="mt-1 w-full input num" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500">Fecha</label>
            <input type="date" value={datos.fecha} onChange={set("fecha")} className="mt-1 w-full input num" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500">Vencimiento</label>
            <input
              type="date"
              value={datos.vencimiento}
              onChange={set("vencimiento")}
              className="mt-1 w-full input num"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500">IVA</label>
            <select value={datos.iva} onChange={set("iva")} className="mt-1 w-full input num">
              {[21, 10, 4, 0].map((p) => (
                <option key={p} value={p}>
                  {p} %
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs uppercase tracking-wider text-slate-500">Concepto</label>
            <input value={datos.concepto} onChange={set("concepto")} className="mt-1 w-full input" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500">Base imponible</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={datos.base}
              onChange={set("base")}
              className="mt-1 w-full input num"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500">Cuota IVA</label>
              <p className="mt-1 w-full input num text-slate-400">{euros(cuota)}</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500">Total</label>
              <p className="mt-1 w-full input num text-white font-medium">{euros(total)}</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <label className="text-xs uppercase tracking-wider text-slate-500">
            Contraparte (cliente{datos.clienteNombre ? `: ${datos.clienteNombre}` : ""})
          </label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={datos.clienteNombre || "Buscar cliente por nombre, NIF o teléfono…"}
            className="mt-1 w-full input"
          />
          {resultados.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 rounded-xl border border-white/10 bg-[#0b1424] divide-y divide-white/5 overflow-hidden shadow-2xl">
              {resultados.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => elegirCliente(c)}
                    className="w-full text-left px-4 py-2 hover:bg-white/5 transition-colors"
                  >
                    <span className="text-sm text-white">{c.nombre}</span>
                    <span className="text-xs text-slate-400 ml-2 num">{c.nif ?? ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/5">
          <button
            type="button"
            onClick={onEliminar}
            disabled={guardando}
            className="text-sm text-rose-400 hover:underline disabled:opacity-50"
          >
            Eliminar borrador
          </button>
          <span className="flex items-center gap-2">
            <button onClick={() => abrirPdfAutofactura(f._id)} className="btn-ghost" disabled={guardando}>
              Ver PDF
            </button>
            <button type="button" onClick={() => accion()} disabled={guardando} className="btn-ghost">
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => accion({ validar: true })}
              disabled={guardando || !(base > 0)}
              className="btn-primary"
            >
              Validar autofactura
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function DetalleAutofactura({ f, onCerrar, onCobro, onQuitarCobro }) {
  const vf = f.verifactu ?? {};
  const fecha = (d) => (d ? new Date(d).toLocaleDateString("es-ES") : "—");
  const pendiente = Math.round(((f.total ?? 0) - (f.cobrado ?? 0)) * 100) / 100;

  // Formulario de cobro (tesorería de la autofactura).
  const [cobro, setCobro] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    importe: pendiente > 0 ? pendiente : "",
    metodo: "transferencia",
    notas: "",
  });
  const [registrando, setRegistrando] = useState(false);

  // Cerrar con Escape: protegido.
  const cierre = useCierreProtegido(onCerrar);

  async function guardarCobro() {
    setRegistrando(true);
    try {
      await onCobro(f, cobro);
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      {...cierre.fondoProps}
    >
      <div
        className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white text-lg font-semibold num">
              Autofactura {f.serieNumero ?? ""}
            </h2>
            <p className="text-xs text-slate-500 mt-1 num">
              Serie interna {f.serie ?? "AUTO"} · nº documento original del proveedor
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge tono="slate">autofactura</Badge>
              {f.estadoCobro && <Badge tono={TONO_COBRO[f.estadoCobro]}>{f.estadoCobro}</Badge>}
              {vf.estadoEnvio === "historica" && <Badge tono="slate">histórica</Badge>}
            </div>
          </div>
          <button onClick={onCerrar} className="text-slate-500 hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Contraparte</p>
            <p className="text-white mt-1">{f.cliente?.nombre ?? "—"}</p>
            <p className="text-slate-500 text-xs num">{f.cliente?.nif ?? ""}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Fecha</p>
            <p className="text-white mt-1 num">{fecha(f.fechaExpedicion)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Vencimiento</p>
            <p className="text-white mt-1 num">{fecha(f.vencimiento)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Cobrado</p>
            <p className="text-white mt-1 num">{euros(f.cobrado ?? 0)} <span className="text-slate-500">/ {euros(f.total)}</span></p>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Líneas</p>
          <table className="tabla text-sm" style={{ width: "100%" }}>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2 text-right">Uds.</th>
                <th className="px-3 py-2 text-right">Precio</th>
                <th className="px-3 py-2 text-right">IVA</th>
                <th className="px-3 py-2 text-right">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(f.lineas ?? []).map((l, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-slate-300">{l.descripcion}</td>
                  <td className="px-3 py-2 text-right text-slate-400 num">{l.cantidad}</td>
                  <td className="px-3 py-2 text-right text-slate-400 num">{euros(l.precioUnitario)}</td>
                  <td className="px-3 py-2 text-right text-slate-400 num">{l.iva}%</td>
                  <td className="px-3 py-2 text-right text-white num">
                    {euros((Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-right text-sm mt-3 space-y-0.5">
            <p className="text-slate-400">Base <span className="text-white num">{euros(f.baseImponible)}</span></p>
            <p className="text-slate-400">IVA <span className="text-white num">{euros(f.cuotaIva)}</span></p>
            <p className="text-white font-semibold text-base">Total <span className="num">{euros(f.total)}</span></p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>
            Facturación por el destinatario (comisión de energía, móvil u otro concepto):
            se registra como venta, pero no fue emitida por FILANEX ni genera registro
            VeriFactu en este programa.
          </p>
          {f.notaImportacion && <p className="mt-2">{f.notaImportacion}</p>}
        </div>

        {(f.cobros ?? []).length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Cobros</p>
            <ul className="text-sm space-y-1">
              {f.cobros.map((c) => (
                <li key={c._id} className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="num" title={c.notas || undefined}>
                    {fecha(c.fecha)}{c.metodo ? ` · ${c.metodo}` : ""}{c.notas ? ` · ${c.notas}` : ""}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="num">{euros(c.importe)}</span>
                    {onQuitarCobro && (
                      <button
                        onClick={() => onQuitarCobro(f, c)}
                        title="Quitar este cobro (se registró por error)"
                        className="text-xs text-rose-400 hover:underline"
                      >
                        Quitar
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {f.estado === "emitida" && pendiente > 0 && (
          <div className="rounded-xl border border-white/5 p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-slate-500">Registrar cobro</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-sm text-slate-300">Fecha</label>
                <input
                  type="date"
                  value={cobro.fecha}
                  onChange={(e) => setCobro((c) => ({ ...c, fecha: e.target.value }))}
                  className="mt-1 w-full input"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Importe</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cobro.importe}
                  onChange={(e) => setCobro((c) => ({ ...c, importe: e.target.value }))}
                  className="mt-1 w-full input num"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Método</label>
                <select
                  value={cobro.metodo}
                  onChange={(e) => setCobro((c) => ({ ...c, metodo: e.target.value }))}
                  className="mt-1 w-full input"
                >
                  {METODOS_COBRO.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-300">Notas</label>
                <input
                  value={cobro.notas}
                  onChange={(e) => setCobro((c) => ({ ...c, notas: e.target.value }))}
                  placeholder="Referencia del ingreso…"
                  className="mt-1 w-full input"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={guardarCobro}
                disabled={registrando || !(Number(cobro.importe) > 0)}
                className="btn-primary"
              >
                {registrando ? "Guardando…" : "Registrar cobro"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
          <button onClick={() => abrirPdfAutofactura(f._id)} className="btn-ghost">
            {f.documentoOriginal ? "Ver PDF original" : "Imprimir / PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AutofacturasPage() {
  const [facturas, setFacturas] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [revision, setRevision] = useState(null);
  const [error, setError] = useState(null);
  const [buscar, setBuscar] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const inputFichero = useRef(null);

  async function cargar() {
    try {
      const r = await fetch("/api/facturas-venta?tipoDocumento=autofactura");
      if (!r.ok) throw new Error();
      setFacturas(await r.json());
    } catch {
      setError("No se pudo conectar con la API.");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const filtradas = facturas.filter((f) =>
    coincideBusqueda(
      buscar,
      f.serieNumero,
      f.cliente?.nombre,
      f.cliente?.nif,
      f.descripcion,
      f.fechaExpedicion ? new Date(f.fechaExpedicion).toLocaleDateString("es-ES") : "",
      euros(f.total),
      f.total
    )
  );

  const totalPendiente = facturas.reduce(
    (s, f) => s + Math.max(0, Math.round(((f.total ?? 0) - (f.cobrado ?? 0)) * 100) / 100),
    0
  );

  // Subida del PDF de la autofactura → OCR → borrador de revisión.
  async function subirAutofactura(fichero) {
    if (!fichero) return;
    setSubiendo(true);
    setError(null);
    try {
      const cuerpo = new FormData();
      cuerpo.append("documento", fichero);
      const r = await fetch("/api/facturas-venta/autofacturas/ocr", { method: "POST", body: cuerpo });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(datos.error ?? "No se pudo leer el documento.");
        return;
      }
      setRevision({ f: datos.documento, avisos: datos.avisos ?? [] });
      await cargar();
    } catch {
      setError("No se pudo subir el documento.");
    } finally {
      setSubiendo(false);
      if (inputFichero.current) inputFichero.current.value = "";
    }
  }

  function abrirFicha(f) {
    if (f.estado === "borrador") {
      setRevision({ f, avisos: f.ocr?.datosExtraidos?.avisos ?? [] });
    } else {
      setDetalle(f);
    }
  }

  async function registrarCobro(f, cobro) {
    const r = await fetch(`/api/facturas-venta/${f._id}/cobros`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        importe: Number(cobro.importe),
        fecha: cobro.fecha,
        metodo: cobro.metodo,
        notas: cobro.notas || undefined,
      }),
    });
    if (r.ok) {
      setDetalle(null);
      await cargar();
    } else {
      setError((await r.json()).error);
    }
  }

  async function quitarCobro(f, cobro) {
    if (
      !window.confirm(
        `¿Quitar el cobro de ${euros(cobro.importe)} del ${new Date(cobro.fecha).toLocaleDateString("es-ES")}? La autofactura volverá a salir como pendiente.`
      )
    )
      return;
    const r = await fetch(`/api/facturas-venta/${f._id}/cobros/${cobro._id}`, { method: "DELETE" });
    if (r.ok) {
      const actualizada = await r.json();
      setDetalle((d) => (d?._id === f._id ? { ...d, ...actualizada } : d));
      await cargar();
    } else setError((await r.json()).error);
  }

  async function eliminarRevision(f) {
    if (
      !window.confirm(
        "¿Eliminar este borrador? El documento no quedará registrado y tendrás que volver a subirlo si lo quieres dar de alta."
      )
    )
      return;
    const r = await fetch(`/api/facturas-venta/${f._id}`, { method: "DELETE" });
    if (r.ok) {
      setRevision(null);
      await cargar();
    } else {
      setError((await r.json()).error);
    }
  }

  return (
    <>
      <CabeceraPagina
        titulo="Autofacturas"
        descripcion="Facturación por el destinatario: comisiones de energía, móvil y similares, registradas como ventas con serie interna propia y aparte del resto de facturas."
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputFichero}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => subirAutofactura(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputFichero.current?.click()}
            disabled={subiendo}
            className="btn-primary"
          >
            <IconOcr />
            {subiendo ? "Leyendo documento…" : "Subir autofactura (OCR)"}
          </button>
          <span className="text-xs text-slate-500">
            Sube el PDF que te manda la comercializadora: se lee solo y queda como borrador
            para que lo revises antes de contabilizarlo.
          </span>
        </div>
      </CabeceraPagina>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-sky-500 shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10z" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <p className="text-[0.78125rem] leading-relaxed text-sky-800">
          <span className="font-semibold">Autofacturas:</span> la mayoría de las comisiones de
          energía y de las compañías de móvil se liquidan así (facturación por el destinatario).
          Se contabilizan como ventas en informes e IVA, se numeran con la serie interna{" "}
          <span className="num font-semibold">AUTO</span> y conservan el número del documento
          original. No generan registro VeriFactu.
        </p>
      </div>

      {facturas.length === 0 ? (
        <div className="panel p-8 text-center text-slate-500 text-sm">
          Aún no hay autofacturas registradas. Sube el primer PDF con el botón de arriba.
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar por nº, cliente o descripción…"
              className="input w-64"
            />
            <span className="text-sm text-slate-500 num">
              {filtradas.length} documento{filtradas.length === 1 ? "" : "s"} · pendiente de cobro{" "}
              <span className="text-white font-medium">{euros(totalPendiente)}</span>
            </span>
          </div>
          <div className="panel overflow-x-auto">
            <table className="tabla text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-white/5">
                  <th className="px-3.5 py-3">Nº documento</th>
                  <th className="px-3.5 py-3">Contraparte</th>
                  <th className="px-3.5 py-3">Fecha</th>
                  <th className="px-3.5 py-3 text-right">Base</th>
                  <th className="px-3.5 py-3 text-right">IVA</th>
                  <th className="px-3.5 py-3 text-right">Total</th>
                  <th className="px-3.5 py-3">Cobro</th>
                  <th className="px-3.5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtradas.map((f) => (
                  <tr key={f._id}>
                    <td className="px-3.5 py-3 text-white font-medium whitespace-nowrap num">
                      {f.serieNumero ?? "—"}
                      <span className="block text-[0.625rem] text-slate-400 font-normal mt-0.5">
                        serie interna {f.serie ?? "AUTO"}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-slate-300 max-w-[220px]">
                      <span className="flex items-center gap-1.5">
                        <Avatar nombre={f.cliente?.nombre} />
                        <span className="truncate" title={f.cliente?.nombre}>{f.cliente?.nombre ?? "—"}</span>
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-slate-400 whitespace-nowrap num">
                      {new Date(f.fechaExpedicion).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </td>
                    <td className="px-3.5 py-3 text-right text-slate-400 whitespace-nowrap num">{euros(f.baseImponible)}</td>
                    <td className="px-3.5 py-3 text-right text-slate-400 whitespace-nowrap num">{euros(f.cuotaIva)}</td>
                    <td className="px-3.5 py-3 text-right text-white font-medium whitespace-nowrap num">{euros(f.total)}</td>
                    <td className="px-3.5 py-3">
                      {f.estado === "borrador" ? (
                        <Badge tono="amber">por revisar</Badge>
                      ) : (
                        f.estadoCobro && <Badge tono={TONO_COBRO[f.estadoCobro]}>{f.estadoCobro}</Badge>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-0.5">
                        <button
                          onClick={() => abrirFicha(f)}
                          title={f.estado === "borrador" ? "Revisar datos del OCR" : "Ver detalle"}
                          className={btnIcono}
                        >
                          <IconOjo />
                        </button>
                        <button
                          onClick={() => abrirPdfAutofactura(f._id)}
                          title={f.documentoOriginal ? "Ver PDF original" : "Imprimir / PDF"}
                          className={btnIcono}
                        >
                          <IconPdf />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {detalle && (
        <DetalleAutofactura
          f={detalle}
          onCerrar={() => setDetalle(null)}
          onCobro={registrarCobro}
          onQuitarCobro={quitarCobro}
        />
      )}

      {revision && (
        <RevisarAutofactura
          f={revision.f}
          avisos={revision.avisos}
          onCerrar={() => setRevision(null)}
          onGuardar={async () => {
            await cargar();
          }}
          onValidar={async () => {
            setRevision(null);
            await cargar();
          }}
          onEliminar={() => eliminarRevision(revision.f)}
        />
      )}
    </>
  );
}
