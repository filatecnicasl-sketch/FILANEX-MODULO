import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import FormDocumentoCompra from "../components/FormDocumentoCompra.jsx";
import { Badge, EstadoVacio, euros } from "../components/ui.jsx";
import { IconImprimir } from "../components/icons.jsx";
import { imprimirDocumento } from "../utils/imprimir.js";

const TONO = { borrador: "slate", confirmado: "cyan", facturado: "green" };
const NOMBRE = { borrador: "Borrador", confirmado: "Confirmado", facturado: "Facturado" };

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");
const aInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

// Desplegable de estado con aspecto de pill coloreada (referencia).
const CLASES_PILL_ESTADO = {
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  cyan: "bg-sky-100 text-sky-700 border-sky-200",
};
const ESTILO_FLECHA = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundPosition: "right 9px center",
};

export default function ComprasAlbaranesPage() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [form, setForm] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef(null);

  async function cargar() {
    try {
      const r = await fetch("/api/albaranes-compra");
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

  // Importar PDF (IA): Gemini detecta albarán y lo registra directamente.
  // Si el PDF resulta ser una factura, irá a la cola de revisión.
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
      if (datos.tipo === "factura") {
        setAviso("El documento era una factura: la tienes en Revisión OCR para validar.");
      }
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function cambiarEstado(a, estado) {
    const r = await fetch(`/api/albaranes-compra/${a._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo cambiar el estado");
  }

  async function pasarAFactura(a) {
    const numero = window.prompt(
      `Nº de factura del proveedor para ${a.numero ?? a.numeroAlbaran} (déjalo vacío si aún no la tienes):`
    );
    if (numero === null) return; // cancelado
    const r = await fetch(`/api/albaranes-compra/${a._id}/pasar-a-factura`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numeroFacturaProveedor: numero || undefined }),
    });
    const datos = await r.json();
    if (r.ok) {
      cargar();
      alert("Factura de compra creada: valídala en Compras → Revisión OCR.");
    } else alert(datos.error || "No se pudo convertir");
  }

  async function borrar(a) {
    if (!window.confirm(`¿Borrar el albarán ${a.numero ?? a.numeroAlbaran}?`)) return;
    const r = await fetch(`/api/albaranes-compra/${a._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  return (
    <>
      <CabeceraPagina
        titulo="Albaranes de compra"
        descripcion="Mercancía recibida de proveedores. Cuando llega la factura, se pasa a factura de compra."
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={importarPdf}
        />
        <button onClick={() => window.print()} className="btn-ghost mr-2">
          Imprimir
        </button>
        <button onClick={() => inputRef.current?.click()} disabled={subiendo} className="btn-ghost mr-2">
          {subiendo ? "Procesando…" : "Importar PDF (IA)"}
        </button>
        <button onClick={() => setForm({ modo: "nuevo" })} className="btn-primary">
          Nuevo albarán
        </button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}
      {aviso && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{aviso}</div>
      )}

      <div className="panel px-3.5 py-2">
        {!lista ? null : lista.length === 0 ? (
          <EstadoVacio
            titulo="Sin albaranes"
            descripcion="Registra la mercancía recibida a mano, desde un pedido o subiendo el PDF del albarán (IA)."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Nº proveedor</th>
                  <th>Proveedor</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a._id}>
                    <td className="font-bold text-white whitespace-nowrap num">{a.numero ?? "—"}</td>
                    <td className="text-slate-400 num">
                      {a.numeroAlbaran ?? "—"}
                      {a.ocr && <Badge tono="slate"> IA</Badge>}
                    </td>
                    <td className="text-slate-300 max-w-[190px]">
                      <span className="block truncate" title={a.proveedor?.nombre}>{a.proveedor?.nombre ?? "—"}</span>
                    </td>
                    <td className="text-slate-400 num">{fecha(a.fecha)}</td>
                    <td>
                      {a.estado === "facturado" ? (
                        <Badge tono={TONO.facturado}>{NOMBRE.facturado}</Badge>
                      ) : (
                        <select
                          value={a.estado}
                          onChange={(e) => cambiarEstado(a, e.target.value)}
                          className={`cursor-pointer appearance-none rounded-full border text-[11px] font-semibold pl-3 pr-7 py-1 bg-no-repeat focus:outline-none ${
                            CLASES_PILL_ESTADO[TONO[a.estado]] ?? CLASES_PILL_ESTADO.slate
                          }`}
                          style={ESTILO_FLECHA}
                        >
                          <option value="borrador">Borrador</option>
                          <option value="confirmado">Confirmado</option>
                        </select>
                      )}
                    </td>
                    <td className="text-right text-slate-300 whitespace-nowrap num">{euros(a.total)}</td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          imprimirDocumento({
                            tipo: "Albarán de compra",
                            numero: a.numero,
                            fecha: a.fecha,
                            contraparte: a.proveedor,
                            quienContraparte: "Proveedor",
                            lineas: a.lineas,
                            notas: a.notas,
                          })
                        }
                        title="Imprimir"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle mr-2"
                      >
                        <IconImprimir />
                      </button>
                      {a.estado !== "facturado" && (
                        <>
                          <button
                            onClick={() => pasarAFactura(a)}
                            className="text-xs text-amber-300 hover:underline mr-3"
                          >
                            Pasar a factura
                          </button>
                          <button
                            onClick={() => setForm({ modo: "editar", albaran: a })}
                            className="text-xs text-accent hover:underline mr-3"
                          >
                            Editar
                          </button>
                        </>
                      )}
                      <button onClick={() => borrar(a)} className="text-xs text-rose-400 hover:underline">
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form?.modo === "nuevo" && (
        <FormDocumentoCompra
          titulo="Nuevo albarán de compra"
          url="/api/albaranes-compra"
          conNumeroProveedor
          onGuardado={() => { setForm(null); cargar(); }}
          onCerrar={() => setForm(null)}
        />
      )}
      {form?.modo === "editar" && (
        <FormDocumentoCompra
          titulo={`Albarán ${form.albaran.numero ?? form.albaran.numeroAlbaran}`}
          url={`/api/albaranes-compra/${form.albaran._id}`}
          metodo="PUT"
          conNumeroProveedor
          inicial={{
            proveedor: form.albaran.proveedor?._id ?? form.albaran.proveedor,
            fecha: aInput(form.albaran.fecha),
            numeroAlbaran: form.albaran.numeroAlbaran ?? "",
            lineas: form.albaran.lineas,
          }}
          onGuardado={() => { setForm(null); cargar(); }}
          onCerrar={() => setForm(null)}
        />
      )}
    </>
  );
}
