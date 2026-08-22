import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import FormDocumentoCompra from "../components/FormDocumentoCompra.jsx";
import ModalVerificacionOCR from "../components/ModalVerificacionOCR.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda, euros } from "../components/ui.jsx";
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
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [form, setForm] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [conTaller, setConTaller] = useState(false);
  const [envio, setEnvio] = useState(null); // albarán cuyas líneas se mandan a una OT
  const [verificando, setVerificando] = useState(null); // { tipo, documento }
  const inputRef = useRef(null);

  // Filtra por todos los campos visibles de la tabla.
  const filtrada = (lista ?? []).filter((a) =>
    coincideBusqueda(
      q,
      a.numero,
      a.numeroAlbaran,
      a.proveedor?.nombre,
      a.proveedor?.nif,
      fecha(a.fecha),
      NOMBRE[a.estado],
      euros(a.total),
      a.total,
      [...new Set((a.ordenesTaller ?? []).map((e) => e.numeroOrden))].join(" ")
    )
  );

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
    // El botón "→ OT" solo aparece si la empresa tiene el módulo Taller.
    fetch("/api/empresa")
      .then((r) => (r.ok ? r.json() : null))
      .then((e) => setConTaller(Boolean(e?.modulos?.includes("taller"))))
      .catch(() => setConTaller(false));
  }, []);

  // Importar PDF (IA): Gemini detecta albarán o factura y al terminar se
  // abre la verificación para comprobar, corregir y aceptar.
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
      setVerificando(datos);
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

      {lista?.length > 0 && (
        <div className="mb-3">
          <InputBusqueda value={q} onChange={setQ} />
        </div>
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
                {filtrada.map((a) => (
                  <tr key={a._id}>
                    <td className="font-bold text-white whitespace-nowrap num">{a.numero ?? "—"}</td>
                  <td className="text-slate-400 num">
                      {a.numeroAlbaran ?? "—"}
                      {a.ocr && <Badge tono="slate"> IA</Badge>}
                      {a.ordenesTaller?.length > 0 && (
                        <span className="block mt-0.5">
                          {[...new Set(a.ordenesTaller.map((e) => e.numeroOrden))].map((n) => (
                            <Badge key={n} tono="amber">{"→ "}{n}</Badge>
                          ))}
                        </span>
                      )}
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
                          className={`cursor-pointer appearance-none rounded-full border text-[0.6875rem] font-semibold pl-3 pr-7 py-1 bg-no-repeat focus:outline-none ${
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
                      {conTaller && (
                        <button
                          onClick={() => setEnvio(a)}
                          title="Enviar líneas a una orden de reparación"
                          className="text-xs text-teal-300 hover:underline mr-3"
                        >
                          → OT
                        </button>
                      )}
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
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-8">
                      Sin resultados para «{q}».
                    </td>
                  </tr>
                )}
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

      {envio && (
        <ModalEnviarAOrden
          albaran={envio}
          onCerrar={() => setEnvio(null)}
          onEnviado={(n, ot) => {
            setEnvio(null);
            cargar();
            setAviso(`${n} línea(s) enviadas a ${ot}: revísalas y ajusta el precio de venta en Taller → Órdenes.`);
          }}
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

// Elige las líneas del albarán y la orden de reparación destino. Las líneas
// se copian como "material" con el precio de compra.
function ModalEnviarAOrden({ albaran, onCerrar, onEnviado }) {
  const [ots, setOts] = useState(null);
  const [ordenId, setOrdenId] = useState("");
  const [marcadas, setMarcadas] = useState(() => new Set(albaran.lineas.map((_, i) => i)));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/taller/ordenes")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => {
        const abiertas = lista.filter((o) => !o.factura);
        setOts(abiertas);
        if (abiertas.length === 1) setOrdenId(abiertas[0]._id);
      })
      .catch(() => setOts([]));
  }, []);

  function alternar(i) {
    setMarcadas((m) => {
      const copia = new Set(m);
      copia.has(i) ? copia.delete(i) : copia.add(i);
      return copia;
    });
  }

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch(`/api/albaranes-compra/${albaran._id}/enviar-a-orden`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordenId, indices: [...marcadas] }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo enviar");
      onEnviado(datos.enviadas, datos.orden.numero);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-1">
          Enviar a orden de reparación
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Albarán {albaran.numero ?? albaran.numeroAlbaran}
          {albaran.proveedor?.nombre ? ` · ${albaran.proveedor.nombre}` : ""}
        </p>
        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 block mb-1">Líneas a enviar</label>
            <div className="rounded-xl border border-white/10 divide-y divide-white/5 max-h-56 overflow-y-auto">
              {albaran.lineas.map((l, i) => (
                <label key={i} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={marcadas.has(i)}
                    onChange={() => alternar(i)}
                    className="accent-[#2ec4b6]"
                  />
                  <span className="flex-1 text-sm text-slate-200 truncate">{l.descripcion}</span>
                  <span className="text-xs text-slate-500 num whitespace-nowrap">
                    {l.cantidad} × {euros(l.precioUnitario)}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 block mb-1">Orden de reparación</label>
            {!ots ? (
              <p className="text-sm text-slate-500">Cargando…</p>
            ) : ots.length === 0 ? (
              <p className="text-sm text-amber-300">
                No hay órdenes sin facturar: crea primero la OT en Taller → Órdenes.
              </p>
            ) : (
              <select className="input w-full" value={ordenId} onChange={(e) => setOrdenId(e.target.value)} required>
                <option value="" disabled>Elige la orden…</option>
                {ots.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.numero} · {o.matricula} · {o.clienteNombre ?? "sin cliente"}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-[0.71875rem] text-slate-500">
            Se copian como material con el precio de compra: ajusta el precio de venta en la orden antes de facturar.
          </p>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={enviando || !ordenId || marcadas.size === 0} className="btn-primary">
              {enviando ? "Enviando…" : `Enviar ${marcadas.size} línea(s)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
