import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import FormDocumentoCompra from "../components/FormDocumentoCompra.jsx";
import ModalVerificacionOCR from "../components/ModalVerificacionOCR.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda, euros } from "../components/ui.jsx";
import { IconImprimir, IconBorrar } from "../components/icons.jsx";
import { imprimirDocumento } from "../utils/imprimir.js";

const TONO = { pendiente_revision: "amber", validada: "green", rechazada: "red" };
const NOMBRE = { pendiente_revision: "Pendiente", validada: "Validada", rechazada: "Rechazada" };

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");
const nombreAlbaran = (a) => a.numero ?? a.numeroAlbaran ?? "s/n";

// Modal de conciliación: albaranes del mismo proveedor que pueden
// vincularse a la factura (los ya vinculados vienen marcados).
function ModalConciliar({ factura, onGuardado, onCerrar }) {
  const [albaranes, setAlbaranes] = useState(null);
  const [elegidos, setElegidos] = useState(() => (factura.albaranes ?? []).map((a) => a._id));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/albaranes-compra")
      .then((r) => r.json())
      .then((lista) => {
        const provId = factura.proveedor?._id ?? factura.proveedor;
        setAlbaranes(
          lista.filter(
            (a) =>
              String(a.proveedor?._id ?? a.proveedor) === String(provId) &&
              (a.estado !== "facturado" || elegidos.includes(a._id))
          )
        );
      })
      .catch(() => setAlbaranes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function alternar(id) {
    setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`/api/facturas-compra/${factura._id}/conciliar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albaranIds: elegidos }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo conciliar");
      onGuardado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  const totalElegido = (albaranes ?? [])
    .filter((a) => elegidos.includes(a._id))
    .reduce((s, a) => s + (a.total ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-1">Conciliar albaranes</h2>
        <p className="text-sm text-slate-400 mb-4">
          Factura {factura.numeroFacturaProveedor ?? "sin nº"} de {factura.proveedor?.nombre ?? "proveedor sin asignar"}
          {" · Total "}
          <span className="text-white font-semibold">{euros(factura.total)}</span>
        </p>

        {!albaranes ? (
          <p className="text-sm text-slate-500 py-6 text-center">Cargando albaranes…</p>
        ) : albaranes.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            No hay albaranes de este proveedor pendientes de facturar.
          </p>
        ) : (
          <div className="space-y-2">
            {albaranes.map((a) => (
              <label
                key={a._id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                  elegidos.includes(a._id)
                    ? "border-accent/40 bg-accent/10"
                    : "border-white/10 hover:bg-white/[0.03]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={elegidos.includes(a._id)}
                  onChange={() => alternar(a._id)}
                  className="accent-cyan-400 w-4 h-4"
                />
                <span className="flex-1">
                  <span className="text-white font-medium">{nombreAlbaran(a)}</span>
                  {a.numero && a.numeroAlbaran && (
                    <span className="text-slate-500 text-xs ml-2">prov. {a.numeroAlbaran}</span>
                  )}
                  <span className="block text-xs text-slate-500">{fecha(a.fecha)}</span>
                </span>
                <span className="text-slate-300 text-sm whitespace-nowrap">{euros(a.total)}</span>
              </label>
            ))}
          </div>
        )}

        {albaranes?.length > 0 && (
          <p className={`mt-4 text-sm ${Math.abs(totalElegido - factura.total) < 0.01 ? "text-emerald-300" : "text-amber-300"}`}>
            Albaranes elegidos: {euros(totalElegido)}
            {Math.abs(totalElegido - factura.total) >= 0.01 &&
              ` — difiere de la factura en ${euros(Math.abs(factura.total - totalElegido))}`}
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCerrar} className="btn-ghost">Cancelar</button>
          <button onClick={guardar} disabled={guardando || !albaranes} className="btn-primary">
            {guardando ? "Guardando…" : "Guardar conciliación"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ComprasFacturasPage() {
  const [lista, setLista] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [formManual, setFormManual] = useState(false);
  const [conciliando, setConciliando] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [verificando, setVerificando] = useState(null); // { tipo, documento }
  const inputRef = useRef(null);

  // Filtra por todos los campos visibles de la tabla.
  const filtrada = (lista ?? []).filter((f) =>
    coincideBusqueda(
      q,
      f.numeroFacturaProveedor,
      f.proveedor?.nombre,
      f.proveedor?.nif,
      fecha(f.fechaExpedicion),
      f.origen === "ocr" ? "ia" : "manual",
      (f.albaranes ?? []).map((a) => nombreAlbaran(a)).join(" "),
      euros(f.total),
      f.total,
      NOMBRE[f.estado]
    )
  );

  async function cargar() {
    try {
      const r = await fetch("/api/facturas-compra");
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setLista(datos);
    } catch (e) {
      setError(e.message);
      setLista([]);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function importarPdf(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setSubiendo(true);
    setError(null);
    setAviso(null);
    try {
      const fd = new FormData();
      fd.append("documento", f);
      const r = await fetch("/api/facturas-compra/ocr", { method: "POST", body: fd });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al procesar el documento");
      // Al terminar la importación se abre la verificación del documento.
      setVerificando(datos);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function validar(f) {
    const r = await fetch(`/api/facturas-compra/${f._id}/validar`, { method: "POST" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo validar");
  }

  async function borrar(f) {
    if (!window.confirm(`¿Borrar la factura ${f.numeroFacturaProveedor ?? ""}? Los albaranes conciliados quedarán liberados.`)) return;
    const r = await fetch(`/api/facturas-compra/${f._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  return (
    <>
      <CabeceraPagina
        titulo="Facturas de compra"
        descripcion="Facturas recibidas de proveedores: por IA, a mano o desde albaranes. Concilialas con sus albaranes."
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={importarPdf}
        />
        <button onClick={() => window.print()} className="btn-ghost">
          Imprimir
        </button>
        <button onClick={() => inputRef.current?.click()} disabled={subiendo} className="btn-ghost">
          {subiendo ? "Procesando…" : "Importar PDF (IA)"}
        </button>
        <button onClick={() => setFormManual(true)} className="btn-primary">
          Nueva manual
        </button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}
      {aviso && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{aviso}</div>
      )}

      {lista?.length > 0 && (
        <div className="mb-3">
          <InputBusqueda value={q} onChange={setQ} />
        </div>
      )}

      <div className="panel px-3.5 py-2">
        {!lista ? null : lista.length === 0 ? (
          <EstadoVacio
            titulo="Sin facturas de compra"
            descripcion="Importa el PDF de una factura con IA, dala de alta a mano o convierte albaranes: aquí quedará el histórico."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nº proveedor</th>
                  <th>Proveedor</th>
                  <th>Fecha</th>
                  <th>Origen</th>
                  <th>Conciliación</th>
                  <th className="text-right">Total</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((f) => {
                  const sumaAlbaranes = (f.albaranes ?? []).reduce((s, a) => s + (a.total ?? 0), 0);
                  const conciliacion =
                    (f.albaranes ?? []).length === 0
                      ? null
                      : Math.abs(sumaAlbaranes - (f.total ?? 0)) < 0.01
                        ? { nombre: "Coincide", tono: "green" }
                        : { nombre: "Revisar", tono: "amber" };
                  return (
                  <tr key={f._id}>
                    <td className="font-bold text-white whitespace-nowrap num">
                      {f.numeroFacturaProveedor ?? "—"}
                    </td>
                    <td className="text-slate-300 max-w-[190px]">
                      <span className="block truncate" title={f.proveedor?.nombre}>{f.proveedor?.nombre ?? "—"}</span>
                    </td>
                    <td className="text-slate-400 num">{fecha(f.fechaExpedicion)}</td>
                    <td>
                      <Badge tono={f.origen === "ocr" ? "cyan" : "slate"}>
                        {f.origen === "ocr" ? "IA" : "Manual"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap">
                      {conciliacion ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Badge tono={conciliacion.tono}>{conciliacion.nombre}</Badge>
                          <span className="text-[0.6875rem] text-slate-500 num">
                            {f.albaranes.map((a) => nombreAlbaran(a)).join(", ")}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="text-right text-slate-300 whitespace-nowrap num">{euros(f.total)}</td>
                    <td>
                      <Badge tono={TONO[f.estado]}>{NOMBRE[f.estado] ?? f.estado}</Badge>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          imprimirDocumento({
                            tipo: "Factura de compra",
                            numero: f.numero ?? f.numeroProveedor,
                            fecha: f.fecha,
                            contraparte: f.proveedor,
                            quienContraparte: "Proveedor",
                            lineas: f.lineas,
                            notas: f.notas,
                          })
                        }
                        title="Imprimir"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle mr-2"
                      >
                        <IconImprimir />
                      </button>
                      {f.ocr?.ficheroUrl && (
                        <a
                          href={f.ocr.ficheroUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-accent hover:underline mr-3"
                        >
                          PDF
                        </a>
                      )}
                      {f.estado !== "rechazada" && (
                        <button
                          onClick={() => setConciliando(f)}
                          className="text-xs text-amber-300 hover:underline mr-3"
                        >
                          Conciliar
                        </button>
                      )}
                      {f.estado === "pendiente_revision" && (
                        <button
                          onClick={() => validar(f)}
                          className="text-xs text-emerald-300 hover:underline mr-3"
                        >
                          Validar
                        </button>
                      )}
                      {f.estado !== "validada" && (
                        <button
                          onClick={() => borrar(f)}
                          title="Borrar factura"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors align-middle"
                        >
                          <IconBorrar />
                        </button>
                      )}
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

      {formManual && (
        <FormDocumentoCompra
          titulo="Nueva factura de compra (manual)"
          url="/api/facturas-compra"
          conNumeroProveedor
          etiquetaNumero="Nº factura del proveedor"
          campoNumero="numeroFacturaProveedor"
          onGuardado={() => { setFormManual(false); cargar(); }}
          onCerrar={() => setFormManual(false)}
        />
      )}
      {conciliando && (
        <ModalConciliar
          factura={conciliando}
          onGuardado={() => { setConciliando(null); cargar(); }}
          onCerrar={() => setConciliando(null)}
        />
      )}
      {verificando && (
        <ModalVerificacionOCR
          resultado={verificando}
          onAceptado={(msg) => {
            setVerificando(null);
            setAviso(msg);
            cargar();
          }}
          onCerrar={() => {
            setVerificando(null);
            cargar();
          }}
        />
      )}
    </>
  );
}
