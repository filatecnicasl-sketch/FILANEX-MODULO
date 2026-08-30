import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import EditorLineas, { lineaVacia } from "../components/EditorLineas.jsx";
import { enterComoTab } from "../utils/enter-tab.js";
import { Badge } from "../components/ui.jsx";

export default function RecurrenciasPage() {
  const [recurrencias, setRecurrencias] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [noticia, setNoticia] = useState(null);
  const [error, setError] = useState(null);

  // Formulario
  const [clienteId, setClienteId] = useState("");
  const [concepto, setConcepto] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("albaran");
  const [lineas, setLineas] = useState([lineaVacia()]);
  const [periodicidad, setPeriodicidad] = useState("mensual");
  const [proximaEmision, setProximaEmision] = useState("");

  async function cargar() {
    try {
      const [rr, rc] = await Promise.all([
        fetch("/api/recurrencias"),
        fetch("/api/clientes"),
      ]);
      setRecurrencias(await rr.json());
      const cls = await rc.json();
      setClientes(cls);
      if (!clienteId && cls.length) setClienteId(cls[0]._id);
    } catch {
      setError("No se pudo conectar con la API.");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardar() {
    setError(null);
    try {
      const lineasOk = lineas.filter((l) => String(l.descripcion ?? "").trim() !== "");
      if (lineasOk.length === 0) throw new Error("Añade al menos una línea con descripción");
      const r = await fetch("/api/recurrencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: clienteId,
          concepto,
          tipoDocumento,
          lineas: lineasOk.map((l) => ({
            ...l,
            cantidad: Number(l.cantidad) || 0,
            precioUnitario: Number(l.precioUnitario) || 0,
            iva: Number(l.iva) || 0,
          })),
          periodicidad,
          diaEmision: new Date(proximaEmision).getDate(),
          proximaEmision,
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al crear la recurrencia");
      setMostrarForm(false);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function generar() {
    setError(null);
    setNoticia(null);
    const r = await fetch("/api/recurrencias/generar", { method: "POST" });
    const datos = await r.json();
    if (r.ok) {
      setNoticia(datos.generadas === 0
        ? "No había recurrencias vencidas. Nada que generar."
        : `${datos.generadas} documento(s) generado(s): albaranes en Compras/Ventas y facturas borrador en Ventas.`);
      await cargar();
    } else setError(datos.error);
  }

  async function alternar(id) {
    await fetch(`/api/recurrencias/${id}/activar`, { method: "POST" });
    await cargar();
  }

  return (
    <>
      <CabeceraPagina
        titulo="Facturación recurrente"
        descripcion="Cuotas periódicas (mantenimientos, líneas…). Genera albaranes o facturas borrador automáticamente."
      >
        <div className="space-x-2">
          <button
            onClick={generar}
            className="btn-primary"
          >
            Generar vencidas
          </button>
          <button
            onClick={() => setMostrarForm(true)}
            className="btn-ghost"
          >
            Nueva recurrencia
          </button>
        </div>
      </CabeceraPagina>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      {noticia && <p className="text-sm text-accent mb-4">{noticia}</p>}

      {mostrarForm && (
        <div className="panel border-accent/30 p-5 mb-6 space-y-4" onKeyDown={enterComoTab}>
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">Nueva recurrencia</h2>
            <button onClick={() => setMostrarForm(false)} className="text-slate-500 hover:text-white text-sm">Cerrar</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="input"
            >
              {clientes.map((c) => (
                <option key={c._id} value={c._id}>{c.nombre} — {c.nif}</option>
              ))}
            </select>
            <input
              placeholder="Concepto (p.ej. Cuota mantenimiento centralita)"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="input"
            />
            <select
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value)}
              className="input"
            >
              <option value="albaran">Albarán (cobro mensual)</option>
              <option value="factura">Factura borrador</option>
            </select>
            <select
              value={periodicidad}
              onChange={(e) => setPeriodicidad(e.target.value)}
              className="input"
            >
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="anual">Anual</option>
            </select>
            <input
              type="date"
              value={proximaEmision}
              onChange={(e) => setProximaEmision(e.target.value)}
              className="input"
            />
          </div>
          <EditorLineas lineas={lineas} setLineas={setLineas} conDescuento />
          <div className="flex justify-end pt-2 border-t border-white/5">
            <button
              onClick={guardar}
              disabled={!clienteId || !concepto || !proximaEmision}
              className="btn-primary"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {recurrencias.length === 0 && !mostrarForm ? (
        <div className="panel p-8 text-center text-slate-500 text-sm">
          Sin recurrencias. Las cuotas de mantenimiento de tus clientes van aquí.
        </div>
      ) : (
        <div className="panel divide-y divide-white/5">
          {recurrencias.map((r) => (
            <div key={r._id} className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">{r.concepto}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {r.tipoDocumento === "albaran" ? "Albarán" : "Factura"} · {r.cliente?.nombre} · {r.periodicidad} · próxima:{" "}
                  {new Date(r.proximaEmision).toLocaleDateString("es-ES")}
                </p>
              </div>
              <button onClick={() => alternar(r._id)}>
                <Badge tono={r.activa ? "green" : "slate"}>{r.activa ? "activa" : "pausada"}</Badge>
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
