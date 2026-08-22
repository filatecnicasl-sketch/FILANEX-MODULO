import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import ModalVerificacionOCR from "../components/ModalVerificacionOCR.jsx";
import { Badge, euros } from "../components/ui.jsx";

function TarjetaRevision({ doc, onAccion }) {
  const [abierta, setAbierta] = useState(false);
  const extra = doc.ocr?.datosExtraidos ?? {};
  const avisos = extra.avisos ?? [];
  const nombreProveedor =
    doc.proveedor?.nombre ?? extra.proveedor?.nombre ?? "Proveedor sin identificar";

  return (
    <div className="panel">
      <button
        onClick={() => setAbierta(!abierta)}
        className="w-full text-left px-5 py-4 flex flex-wrap items-center gap-3"
      >
        <div className="flex-1 min-w-48">
          <p className="text-white font-medium truncate">{nombreProveedor}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {extra.numeroDocumento ? `Nº ${extra.numeroDocumento} · ` : ""}
            {extra.fecha ?? "sin fecha"}
          </p>
        </div>
        <Badge tono={doc.proveedor ? "cyan" : "amber"}>
          {doc.proveedor ? "Proveedor existente" : "Proveedor nuevo"}
        </Badge>
        {doc.ocr?.confianza != null && (
          <Badge tono={doc.ocr.confianza >= 0.75 ? "slate" : "red"}>
            Confianza {Math.round(doc.ocr.confianza * 100)}%
          </Badge>
        )}
        {avisos.length > 0 && <Badge tono="red">{avisos.length} aviso(s)</Badge>}
        <span className="text-white font-semibold">{euros(doc.total)}</span>
      </button>

      {abierta && (
        <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
          {avisos.length > 0 && (
            <ul className="text-sm text-red-300 space-y-1">
              {avisos.map((a, i) => (
                <li key={i}>⚠ {a}</li>
              ))}
            </ul>
          )}
          <table className="tabla w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="pb-2">Descripción</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2 text-right">Ud.</th>
                <th className="pb-2 text-right">Precio</th>
                <th className="pb-2 text-right">IVA</th>
                <th className="pb-2 text-right">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(doc.lineas ?? []).map((l, i) => (
                <tr key={i}>
                  <td className="py-2 text-slate-200">{l.descripcion}</td>
                  <td className="py-2">
                    <Badge tono={extra.lineas?.[i]?.tipo === "servicio" ? "cyan" : "slate"}>
                      {extra.lineas?.[i]?.tipo === "servicio" ? "Servicio" : "Artículo"}
                    </Badge>
                  </td>
                  <td className="py-2 text-right text-slate-400">{l.cantidad}</td>
                  <td className="py-2 text-right text-slate-400">
                    {euros(l.precioUnitario)}
                    {(l.descuento ?? 0) > 0 && <div className="text-xs text-amber-400">dto {l.descuento}%</div>}
                  </td>
                  <td className="py-2 text-right text-slate-400">{l.iva}%</td>
                  <td className="py-2 text-right text-slate-200">
                    {euros((l.cantidad ?? 0) * (l.precioUnitario ?? 0) * (1 - (l.descuento ?? 0) / 100))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Al validar se darán de alta automáticamente el proveedor y los
              artículos/servicios que no existan.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onAccion(doc._id, "rechazar")}
                className="text-sm px-4 py-2 rounded-lg border border-red-400/40 text-red-300 hover:bg-red-400/10 transition-colors"
              >
                Rechazar
              </button>
              <button
                onClick={() => onAccion(doc._id, "validar")}
                className="text-sm px-4 py-2 rounded-lg bg-accent text-navy-950 font-semibold hover:bg-cyan-300 transition-colors"
              >
                Validar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComprasPage() {
  const [cola, setCola] = useState([]);
  const [noticias, setNoticias] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const [verificando, setVerificando] = useState(null); // { tipo, documento }
  const inputRef = useRef(null);

  async function cargar() {
    try {
      const r = await fetch("/api/facturas-compra?estado=pendiente_revision");
      setCola(await r.json());
    } catch {
      setError("No se pudo conectar con la API.");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function subir(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setSubiendo(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("documento", f);
      const r = await fetch("/api/facturas-compra/ocr", { method: "POST", body: fd });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al procesar el documento");
      // Al terminar la importación se abre la verificación: comprobar,
      // corregir si hiciera falta y aceptar (o descartar).
      setVerificando(datos);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function accion(id, que) {
    const r = await fetch(`/api/facturas-compra/${id}/${que}`, { method: "POST" });
    if (r.ok) setCola((c) => c.filter((x) => x._id !== id));
  }

  return (
    <>
      <CabeceraPagina
        titulo="Compras OCR"
        descripcion="Sube albaranes y facturas de compra: Gemini los registra y tú solo validas."
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={subir}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="btn-primary"
        >
          {subiendo ? "Procesando…" : "Subir documento"}
        </button>
      </CabeceraPagina>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      {noticias.map((n, i) => (
        <p key={i} className="text-sm text-accent mb-2">{n}</p>
      ))}

      {cola.length === 0 ? (
        <div className="panel border-dashed border-accent/30 p-8 text-center text-slate-500 text-sm">
          Cola de revisión vacía. Sube una factura o albarán de compra y Gemini
          preparará el registro para que lo valides con un clic.
        </div>
      ) : (
        <div className="space-y-3">
          {cola.map((doc) => (
            <TarjetaRevision key={doc._id} doc={doc} onAccion={accion} />
          ))}
        </div>
      )}

      {verificando && (
        <ModalVerificacionOCR
          resultado={verificando}
          onAceptado={(msg) => {
            setVerificando(null);
            setNoticias((n) => [msg, ...n]);
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
