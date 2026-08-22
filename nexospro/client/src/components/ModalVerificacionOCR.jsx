import { useEffect, useState } from "react";
import EditorLineas from "./EditorLineas.jsx";
import SelectorContacto from "./SelectorContacto.jsx";
import { Badge } from "./ui.jsx";
import { enterComoTab } from "../utils/enter-tab.js";

// Verificación al terminar una importación OCR (factura o albarán de compra):
// muestra lo que Gemini ha entendido — proveedor, nº, fecha, líneas y avisos —
// para corregirlo si hiciera falta y aceptar. Si el documento no sirve, se
// puede descartar y no queda rastro en el programa.
export default function ModalVerificacionOCR({ resultado, onAceptado, onCerrar }) {
  const { tipo, documento: doc } = resultado;
  const esFactura = tipo === "factura";
  const extra = doc.ocr?.datosExtraidos ?? {};
  const avisos = extra.avisos ?? [];

  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState(doc.proveedor?._id ?? "");
  const [numero, setNumero] = useState(
    esFactura ? (doc.numeroFacturaProveedor ?? "") : (doc.numeroAlbaran ?? "")
  );
  const [fecha, setFecha] = useState(() => {
    const iso = esFactura ? doc.fechaExpedicion : doc.fecha;
    return iso ? new Date(iso).toISOString().slice(0, 10) : "";
  });
  const [lineas, setLineas] = useState(
    (doc.lineas ?? []).map((l) => ({
      descripcion: l.descripcion ?? "",
      cantidad: l.cantidad ?? 1,
      precioUnitario: l.precioUnitario ?? 0,
      descuento: l.descuento ?? 0,
      iva: l.iva ?? 21,
    }))
  );
  const [ocupado, setOcupado] = useState(null); // "guardar" | "validar" | "descartar"
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/proveedores")
      .then((r) => r.json())
      .then((lista) => setProveedores(Array.isArray(lista) ? lista : []))
      .catch(() => setProveedores([]));
  }, []);

  const urlDoc = esFactura ? `/api/facturas-compra/${doc._id}` : `/api/albaranes-compra/${doc._id}`;

  async function guardarCorrecciones() {
    const cuerpo = {
      fecha,
      lineas: lineas
        .filter((l) => l.descripcion)
        .map((l) => ({
          ...l,
          cantidad: Number(l.cantidad) || 0,
          precioUnitario: Number(l.precioUnitario) || 0,
          descuento: Number(l.descuento) || 0,
          iva: Number(l.iva) || 0,
        })),
    };
    if (proveedorId) cuerpo.proveedor = proveedorId;
    if (esFactura) cuerpo.numeroFacturaProveedor = numero || undefined;
    else cuerpo.numeroAlbaran = numero || undefined;

    const r = await fetch(urlDoc, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const datos = await r.json();
    if (!r.ok) throw new Error(datos.error || "No se pudieron guardar las correcciones");
    return datos;
  }

  async function aceptar(validar) {
    setOcupado(validar ? "validar" : "guardar");
    setError(null);
    try {
      await guardarCorrecciones();
      if (esFactura && validar) {
        const r = await fetch(`${urlDoc}/validar`, { method: "POST" });
        const datos = await r.json();
        if (!r.ok) throw new Error(datos.error || "Guardada, pero no se pudo validar");
        onAceptado("Factura verificada y validada: proveedor y artículos dados de alta si hacía falta.");
      } else {
        onAceptado(
          esFactura
            ? "Factura verificada: sigue pendiente en Revisión OCR por si quieres validarla luego."
            : "Albarán verificado y guardado."
        );
      }
    } catch (e) {
      setError(e.message);
      setOcupado(null);
    }
  }

  async function descartar() {
    if (!window.confirm("¿Descartar el documento importado? Se borrará por completo.")) return;
    setOcupado("descartar");
    setError(null);
    try {
      const r = await fetch(urlDoc, { method: "DELETE" });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo descartar");
      onAceptado("Documento descartado.");
    } catch (e) {
      setError(e.message);
      setOcupado(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="modal-panel w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h2 className="text-lg font-bold text-white flex-1 min-w-52">
            Verifica la {esFactura ? "factura" : "albarán"} importada
          </h2>
          <Badge tono={doc.proveedor ? "cyan" : "amber"}>
            {doc.proveedor ? "Proveedor existente" : "Proveedor nuevo"}
          </Badge>
          {doc.ocr?.confianza != null && (
            <Badge tono={doc.ocr.confianza >= 0.75 ? "green" : "red"}>
              Confianza {Math.round(doc.ocr.confianza * 100)}%
            </Badge>
          )}
          {doc.ocr?.ficheroUrl && (
            <a
              href={doc.ocr.ficheroUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:underline"
            >
              Ver PDF original
            </a>
          )}
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Esto es lo que la IA ha entendido del documento. Corrige lo que no cuadre y acepta.
        </p>

        {avisos.length > 0 && (
          <ul className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-300 space-y-1">
            {avisos.map((a, i) => (
              <li key={i}>⚠ {a}</li>
            ))}
          </ul>
        )}

        <form onSubmit={(e) => e.preventDefault()} onKeyDown={enterComoTab} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="text-sm text-slate-400 block mb-1">Proveedor</label>
              <SelectorContacto
                tipo="proveedor"
                contactos={proveedores}
                valor={proveedorId}
                onChange={setProveedorId}
                onCreado={(p) => setProveedores((ps) => [...ps, p])}
              />
              {!proveedorId && extra.proveedor?.nombre && (
                <p className="text-[0.6875rem] text-amber-300 mt-1">
                  No está en tu cartera: al validar se dará de alta «{extra.proveedor.nombre}»
                  {extra.proveedor.nif ? ` (${extra.proveedor.nif})` : ""}.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">
                {esFactura ? "Nº factura del proveedor" : "Nº albarán del proveedor"}
              </label>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>

          <EditorLineas lineas={lineas} setLineas={setLineas} precio="compra" conDescuento />

          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={descartar}
              disabled={ocupado !== null}
              className="text-sm px-4 py-2 rounded-lg border border-red-400/40 text-red-300 hover:bg-red-400/10 transition-colors"
            >
              {ocupado === "descartar" ? "Descartando…" : "Descartar documento"}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => aceptar(false)}
                disabled={ocupado !== null || lineas.every((l) => !l.descripcion)}
                className={esFactura ? "btn-ghost" : "btn-primary"}
              >
                {ocupado === "guardar" ? "Guardando…" : esFactura ? "Solo guardar" : "Aceptar"}
              </button>
              {esFactura && (
                <button
                  type="button"
                  onClick={() => aceptar(true)}
                  disabled={ocupado !== null || lineas.every((l) => !l.descripcion)}
                  className="btn-primary"
                >
                  {ocupado === "validar" ? "Validando…" : "Aceptar y validar"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
