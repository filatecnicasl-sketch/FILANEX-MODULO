import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Badge, euros, Avatar, coincideBusqueda } from "../components/ui.jsx";
import { IconImprimir, IconPdf, IconOjo, IconXml, IconBorrar } from "../components/icons.jsx";
import EditorLineas, { lineaVacia } from "../components/EditorLineas.jsx";
import { enterComoTab } from "../utils/enter-tab.js";
import SelectorContacto from "../components/SelectorContacto.jsx";
import { descargarPdf, imprimirDocumentoRapido } from "../utils/pdf.js";
import EnviarWhatsApp from "../components/EnviarWhatsApp.jsx";

const btnIcono =
  "inline-flex items-center justify-center w-6 h-6 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors";

const TONO_ESTADO = { borrador: "slate", emitida: "cyan", anulada: "red", rectificada: "amber" };
const TONO_COBRO = { pendiente: "amber", parcial: "cyan", cobrada: "green" };
const TONO_AEAT = {
  pendiente: "amber",
  aceptado: "green",
  aceptado_con_errores: "amber",
  rechazado: "red",
};

function FormNuevaFactura({ clientes: clientesProp, inicial = null, onCreada, onCerrar }) {
  const [clientes, setClientes] = useState(clientesProp);
  const [clienteId, setClienteId] = useState(inicial?.cliente?._id ?? inicial?.cliente ?? clientesProp[0]?._id ?? "");
  const [lineas, setLineas] = useState(inicial?.lineas?.length ? inicial.lineas.map((linea) => ({ ...linea })) : [lineaVacia()]);
  // Vencimiento por defecto: 30 días (como RO App).
  const [vencimiento, setVencimiento] = useState(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return inicial?.vencimiento
      ? new Date(inicial.vencimiento).toISOString().slice(0, 10)
      : d.toISOString().slice(0, 10);
  });
  // Métodos de pago del catálogo de la empresa (Sistema → Series).
  const [metodosPago, setMetodosPago] = useState([]);
  const [metodoPago, setMetodoPago] = useState(inicial?.metodoPago ?? "");
  const [otraEntrega, setOtraEntrega] = useState(Boolean(inicial?.direccionEntrega?.calle));
  const [entrega, setEntrega] = useState({
    calle: inicial?.direccionEntrega?.calle ?? "",
    ciudad: inicial?.direccionEntrega?.ciudad ?? "",
    cp: inicial?.direccionEntrega?.cp ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => setClientes(clientesProp), [clientesProp]);

  useEffect(() => {
    fetch("/api/empresa")
      .then((r) => r.json())
      .then((e) => {
        const lista = e.metodosPago?.length ? e.metodosPago : [{ nombre: "Transferencia", plazos: [], defecto: true }];
        setMetodosPago(lista);
        const def = lista.find((m) => m.defecto) ?? lista[0];
        setMetodoPago((actual) => actual || def.nombre);
      })
      .catch(() => setMetodosPago([{ nombre: "Transferencia", plazos: [], defecto: true }]));
  }, []);

  // Cerrar con Escape, como el resto de ventanas del programa.
  useEffect(() => {
    const alPulsar = (e) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  // Al elegir un método con plazos, el vencimiento pasa al último plazo.
  function elegirMetodo(nombre) {
    setMetodoPago(nombre);
    const m = metodosPago.find((x) => x.nombre === nombre);
    if (m?.plazos?.length) {
      const ultimo = Math.max(...m.plazos);
      setVencimiento(new Date(Date.now() + ultimo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    }
  }

  // Si el cliente tiene dirección de entrega en su ficha, se propone.
  function elegirCliente(id) {
    setClienteId(id);
    const c = clientes.find((x) => x._id === id);
    if (c?.direccionEntrega?.calle) {
      setOtraEntrega(true);
      setEntrega({
        calle: c.direccionEntrega.calle ?? "",
        ciudad: c.direccionEntrega.ciudad ?? "",
        cp: c.direccionEntrega.cp ?? "",
      });
    }
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const lineasOk = lineas.filter((l) => String(l.descripcion ?? "").trim() !== "");
      if (lineasOk.length === 0) throw new Error("Añade al menos una línea con descripción");
      const r = await fetch(inicial ? `/api/facturas-venta/${inicial._id}` : "/api/facturas-venta", {
        method: inicial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: clienteId,
          vencimiento: vencimiento || undefined,
          metodoPago,
          direccionEntrega: otraEntrega && entrega.calle.trim()
            ? { calle: entrega.calle.trim(), ciudad: entrega.ciudad.trim(), cp: entrega.cp.trim() }
            : undefined,
          lineas: lineasOk.map((l) => ({
            ...l,
            cantidad: Number(l.cantidad) || 0,
            precioUnitario: Number(l.precioUnitario) || 0,
            iva: Number(l.iva) || 0,
          })),
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al guardar la factura");
      onCreada();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCerrar}
    >
      <div
        className="modal-panel w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={enterComoTab}
      >
        <h2 className="text-lg font-bold text-white mb-4">
          {inicial ? "Modificar factura borrador" : "Nueva factura (borrador)"}
        </h2>

        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
              Datos del documento
            </p>
            <label className="text-sm text-slate-300">Cliente</label>
            <SelectorContacto
              tipo="cliente"
              contactos={clientes}
              valor={clienteId}
              onChange={elegirCliente}
              onCreado={(c) => setClientes((cs) => [...cs, c])}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-sm text-slate-300">Vencimiento</label>
                <input
                  type="date"
                  value={vencimiento}
                  onChange={(e) => setVencimiento(e.target.value)}
                  className="mt-1 w-full input"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Método de pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => elegirMetodo(e.target.value)}
                  className="mt-1 w-full input"
                >
                  {metodosPago.map((m) => (
                    <option key={m.nombre} value={m.nombre}>
                      {m.nombre}{m.plazos?.length ? ` (${m.plazos.join("/")} días)` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
              Dirección de entrega
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={otraEntrega}
                onChange={(e) => setOtraEntrega(e.target.checked)}
                className="accent-accent"
              />
              Distinta de la fiscal
            </label>
            {otraEntrega && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_120px] gap-3 mt-3">
                <div>
                  <label className="text-sm text-slate-300">Calle y número</label>
                  <input
                    value={entrega.calle}
                    onChange={(e) => setEntrega((d) => ({ ...d, calle: e.target.value }))}
                    className="mt-1 w-full input"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">Ciudad</label>
                  <input
                    value={entrega.ciudad}
                    onChange={(e) => setEntrega((d) => ({ ...d, ciudad: e.target.value }))}
                    className="mt-1 w-full input"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">Código postal</label>
                  <input
                    value={entrega.cp}
                    onChange={(e) => setEntrega((d) => ({ ...d, cp: e.target.value }))}
                    className="mt-1 w-full input"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <EditorLineas lineas={lineas} setLineas={setLineas} />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
            <button type="button" onClick={onCerrar} className="btn-ghost">
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || !clienteId}
              className="btn-primary"
            >
              {guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Guardar borrador"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetalleFactura({ f, onCerrar, onEditar, onRectificar, onValidar }) {
  const vf = f.verifactu ?? {};
  const fecha = (d) => (d ? new Date(d).toLocaleDateString("es-ES") : "—");

  // Cerrar con Escape, como el resto de ventanas del programa.
  useEffect(() => {
    const alPulsar = (e) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onCerrar}
    >
      <div
        className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white text-lg font-semibold num">
              Factura {f.serieNumero ?? "borrador"}
            </h2>
            {f.rectifica && (
              <p className="text-xs text-amber-600 mt-1">
                Factura rectificativa · rectifica a <span className="num font-semibold">{f.rectifica.serieNumero}</span>
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge tono={TONO_ESTADO[f.estado]}>{f.estado}</Badge>
              {f.estado !== "borrador" && f.estadoCobro && (
                <Badge tono={TONO_COBRO[f.estadoCobro]}>{f.estadoCobro}</Badge>
              )}
              {f.estado === "emitida" && (
                <Badge tono={TONO_AEAT[vf.estadoEnvio ?? "pendiente"]}>
                  AEAT {vf.estadoEnvio ?? "pendiente"}
                </Badge>
              )}
            </div>
          </div>
          <button onClick={onCerrar} className="text-slate-500 hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Cliente</p>
            <p className="text-white mt-1">{f.cliente?.nombre ?? "—"}</p>
            <p className="text-slate-500 text-xs num">{f.cliente?.nif ?? ""}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Expedición</p>
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

        {(f.metodoPago || (f.plazos ?? []).length > 0 || f.direccionEntrega?.calle) && (
          <div className="rounded-xl border border-white/5 p-4 space-y-2 text-sm">
            {f.metodoPago && (
              <p className="text-slate-400">
                Método de pago: <span className="text-white font-medium">{f.metodoPago}</span>
              </p>
            )}
            {(f.plazos ?? []).length > 0 && (
              <ul className="space-y-1">
                {f.plazos.map((p, i) => (
                  <li key={i} className="flex justify-between text-slate-300">
                    <span>Plazo {i + 1} · <span className="num">{fecha(p.fecha)}</span></span>
                    <span className="num">{euros(p.importe)}</span>
                  </li>
                ))}
              </ul>
            )}
            {f.direccionEntrega?.calle && (
              <p className="text-slate-400">
                Entrega: <span className="text-slate-200">
                  {f.direccionEntrega.calle}
                  {f.direccionEntrega.ciudad ? `, ${f.direccionEntrega.ciudad}` : ""}
                  {f.direccionEntrega.cp ? ` ${f.direccionEntrega.cp}` : ""}
                </span>
              </p>
            )}
          </div>
        )}

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
                  <td className="px-3 py-2 text-right text-slate-400 num">
                    {euros(l.precioUnitario)}
                    {(l.descuento ?? 0) > 0 && <div className="text-xs text-amber-400">dto {l.descuento}%</div>}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400 num">{l.iva}%</td>
                  <td className="px-3 py-2 text-right text-white num">
                    {euros((Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0) * (1 - (Number(l.descuento) || 0) / 100))}
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

        {vf.huella && (
          <div className="rounded-xl border border-white/5 p-4 space-y-1.5">
            <p className="text-xs uppercase tracking-wider text-slate-500">Registro VeriFactu</p>
            <p className="text-xs text-slate-400 break-all num">Huella: {vf.huella}</p>
            {vf.fechaRegistro && (
              <p className="text-xs text-slate-500 num">
                Registrada: {new Date(vf.fechaRegistro).toLocaleString("es-ES")}
              </p>
            )}
            {vf.qrContenido?.startsWith("http") && (
              <a
                href={vf.qrContenido}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs text-accent hover:underline mt-1"
              >
                Verificación tributaria (contenido del QR)
              </a>
            )}
          </div>
        )}

        {(f.cobros ?? []).length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Cobros</p>
            <ul className="text-sm space-y-1">
              {f.cobros.map((c, i) => (
                <li key={i} className="flex justify-between text-slate-300">
                  <span className="num">{fecha(c.fecha)}{c.metodo ? ` · ${c.metodo}` : ""}</span>
                  <span className="num">{euros(c.importe)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
          {f.estado !== "borrador" && (
            <a href={`/api/facturas-venta/${f._id}/xml`} className="btn-ghost">
              XML VeriFactu
            </a>
          )}
          <a href={`/api/facturas-venta/${f._id}/pdf`} target="_blank" rel="noreferrer" className="btn-ghost">
            Imprimir / PDF
          </a>
          {f.estado === "emitida" && !f.rectifica && (
            <button
              onClick={() => { onRectificar(); onCerrar(); }}
              className="inline-flex items-center gap-2 border border-amber-300 text-amber-600 font-semibold text-sm px-4 py-2 rounded-lg transition-colors hover:bg-amber-50"
            >
              Rectificar
            </button>
          )}
          {f.estado === "borrador" && (
            <>
              <button onClick={onEditar} className="btn-ghost">Modificar borrador</button>
              <button
                onClick={() => { onValidar(); onCerrar(); }}
                className="btn-primary"
              >
                Validar y emitir
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VentasPage() {
  const [facturas, setFacturas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [facturaEditar, setFacturaEditar] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState(null);
  // Filtros del listado (inspirado en RO App).
  const [buscar, setBuscar] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [soloVencidas, setSoloVencidas] = useState(false);
  const [params, setParams] = useSearchParams();

  // Abre directamente una factura cuando llega ?abrir=<id> (p. ej. desde el historial del vehículo).
  useEffect(() => {
    const id = params.get("abrir");
    if (!id || facturas.length === 0) return;
    const f = facturas.find((x) => x._id === id);
    if (f) {
      setDetalle(f);
      params.delete("abrir");
      setParams(params, { replace: true });
    }
  }, [facturas, params, setParams]);

  const esVencida = (f) =>
    f.estado === "emitida" &&
    f.estadoCobro !== "cobrada" &&
    f.vencimiento &&
    new Date(f.vencimiento) < new Date(new Date().toDateString());

  const facturasFiltradas = facturas.filter((f) => {
    if (filtroEstado !== "todas" && f.estado !== filtroEstado) return false;
    if (soloVencidas && !esVencida(f)) return false;
    return coincideBusqueda(
      buscar,
      f.serieNumero,
      f.cliente?.nombre,
      f.cliente?.nif,
      f.descripcion,
      f.fecha ? new Date(f.fecha).toLocaleDateString("es-ES") : "",
      f.vencimiento ? new Date(f.vencimiento).toLocaleDateString("es-ES") : "",
      euros(f.total),
      f.total,
      f.estado
    );
  });

  async function cargar() {
    try {
      const [rf, rc] = await Promise.all([
        fetch("/api/facturas-venta"),
        fetch("/api/clientes"),
      ]);
      setFacturas(await rf.json());
      setClientes(await rc.json());
    } catch {
      setError("No se pudo conectar con la API.");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function accion(id, que) {
    if (que === "rectificativa" && !window.confirm("¿Crear factura rectificativa? Se emitirá en negativo con registro VeriFactu R1 y la original quedará rectificada.")) return;
    const r = await fetch(`/api/facturas-venta/${id}/${que}`, { method: "POST" });
    if (r.ok) await cargar();
    else setError((await r.json()).error);
  }

  async function borrar(f) {
    if (!window.confirm(`¿Eliminar el borrador ${f.serieNumero ?? ""}? Esta acción no se puede deshacer.`)) return;
    const r = await fetch(`/api/facturas-venta/${f._id}`, { method: "DELETE" });
    if (r.ok) await cargar();
    else setError((await r.json()).error);
  }

  return (
    <>
      <CabeceraPagina
        titulo="Ventas"
        descripcion="Facturas emitidas y su estado en VeriFactu."
      >
        <button onClick={() => window.print()} className="btn-ghost">
          Imprimir
        </button>
        <button
          onClick={() => setMostrarForm(true)}
          className="btn-primary"
        >
          Nueva factura
        </button>
      </CabeceraPagina>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {/* Aviso VeriFactu */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-500 shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10z" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <p className="text-[0.78125rem] leading-relaxed text-amber-800">
          <span className="font-semibold">VeriFactu:</span> al emitir una factura se genera su
          registro con huella encadenada y código QR, y se remite a la AEAT. Las facturas emitidas
          no se pueden modificar ni eliminar: solo rectificar.
        </p>
      </div>

      {mostrarForm && (
        <FormNuevaFactura
          clientes={clientes}
          onCreada={() => {
            setMostrarForm(false);
            cargar();
          }}
          onCerrar={() => setMostrarForm(false)}
        />
      )}
      {facturaEditar && (
        <FormNuevaFactura
          clientes={clientes}
          inicial={facturaEditar}
          onCreada={() => {
            setFacturaEditar(null);
            cargar();
          }}
          onCerrar={() => setFacturaEditar(null)}
        />
      )}

      {facturas.length === 0 ? (
        <div className="panel p-8 text-center text-slate-500 text-sm">
          Aún no hay facturas. Crea un borrador y al emitirlo se generará el
          registro VeriFactu (huella encadenada, QR y remisión a la AEAT).
        </div>
      ) : (
        <>
          {/* Filtros (estilo RO App) */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar por nº, cliente o descripción…"
              className="input w-64"
            />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="input"
            >
              <option value="todas">Todas</option>
              <option value="borrador">Borradores</option>
              <option value="emitida">Emitidas</option>
              <option value="anulada">Anuladas</option>
              <option value="rectificada">Rectificadas</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={soloVencidas}
                onChange={(e) => setSoloVencidas(e.target.checked)}
                className="accent-red-500"
              />
              Solo vencidas
            </label>
          </div>
        <div className="panel overflow-x-auto">
          <table className="tabla text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th className="px-3.5 py-3">Nº</th>
                <th className="px-3.5 py-3">Cliente</th>
                <th className="px-3.5 py-3">Fecha</th>
                <th className="px-3.5 py-3 text-right">Base</th>
                <th className="px-3.5 py-3 text-right">IVA</th>
                <th className="px-3.5 py-3 text-right">Total</th>
                <th className="px-3.5 py-3">Vence</th>
                <th className="px-3.5 py-3">Estado</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Cobro/AEAT</th>
                <th className="px-3.5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {facturasFiltradas.map((f) => (
                <tr key={f._id}>
                  <td className="px-3.5 py-3 text-white font-medium whitespace-nowrap num">
                    {f.serieNumero ?? "—"}
                    {f.rectifica && (
                      <>
                        <span className="block text-[0.625rem] font-bold uppercase tracking-wide text-amber-600 mt-0.5">
                          Rectif.
                        </span>
                        <span className="block text-[0.65625rem] text-slate-400 font-normal">
                          rectifica {f.rectifica.serieNumero}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-slate-300 max-w-[180px] xl:max-w-[240px] 2xl:max-w-[320px]">
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
                  <td
                    className={`px-3.5 py-3 whitespace-nowrap num ${
                      esVencida(f) ? "text-red-600 font-semibold" : "text-slate-400"
                    }`}
                    title={esVencida(f) ? "Factura vencida sin cobrar" : undefined}
                  >
                    {f.vencimiento
                      ? new Date(f.vencimiento).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })
                      : "—"}
                  </td>
                  <td className="px-3.5 py-3"><Badge tono={TONO_ESTADO[f.estado]}>{f.estado}</Badge></td>
                  <td className="px-3.5 py-3">
                    <span className="flex flex-col items-start gap-1">
                      {f.estado !== "borrador" && f.estadoCobro && (
                        <Badge tono={TONO_COBRO[f.estadoCobro]}>{f.estadoCobro}</Badge>
                      )}
                      {f.estado === "emitida" && (
                        <Badge tono={TONO_AEAT[f.verifactu?.estadoEnvio ?? "pendiente"]}>
                          {f.verifactu?.estadoEnvio ?? "pendiente"}
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5">
                      <EnviarWhatsApp
                        telefono={f.cliente?.telefono}
                        cliente={f.cliente?._id}
                        clienteNombre={f.cliente?.nombre}
                        tipo="factura"
                        id={f._id}
                        numero={f.serieNumero}
                      />
                      <button
                        onClick={() => setDetalle(f)}
                        title="Ver detalle"
                        className={btnIcono}
                      >
                        <IconOjo />
                      </button>
                      <button
                        onClick={() => imprimirDocumentoRapido("factura-venta", f._id)}
                        title="Imprimir"
                        className={btnIcono}
                      >
                        <IconImprimir />
                      </button>
                      <button
                        onClick={() => descargarPdf("factura-venta", f._id, f.serieNumero)}
                        title="Descargar PDF"
                        className={btnIcono}
                      >
                        <IconPdf />
                      </button>
                      {f.estado !== "borrador" && (
                        <a
                          href={`/api/facturas-venta/${f._id}/xml`}
                          title="Descargar XML VeriFactu"
                          className={btnIcono}
                        >
                          <IconXml />
                        </a>
                      )}
                      {f.estado === "borrador" && (
                        <button
                          onClick={() => accion(f._id, "emitir")}
                          title="Validar y emitir: número definitivo + registro VeriFactu"
                          className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-lg hover:bg-accent/20"
                        >Validar</button>
                      )}
                      {f.estado === "borrador" && (
                        <button
                          onClick={() => borrar(f)}
                          title="Eliminar borrador"
                          className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <IconBorrar />
                        </button>
                      )}
                      {f.estado === "emitida" && !f.rectifica && (
                        <button
                          onClick={() => accion(f._id, "rectificativa")}
                          title="Crear factura rectificativa (en negativo)"
                          className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                            <path d="m9 15 6-6m0 0h-4m4 0v4" />
                          </svg>
                        </button>
                      )}
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
        <DetalleFactura
          f={detalle}
          onCerrar={() => setDetalle(null)}
          onEditar={() => {
            setFacturaEditar(detalle);
            setDetalle(null);
          }}
          onRectificar={() => accion(detalle._id, "rectificativa")}
          onValidar={() => accion(detalle._id, "emitir")}
        />
      )}
    </>
  );
}
