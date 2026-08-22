import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Avatar, euros } from "../components/ui.jsx";

const fmtFecha = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "—");
// Vencimiento por defecto: fecha de expedición + 30 días.
const fechaVencimiento = (f) => {
  const d = new Date(f.fechaExpedicion ?? f.createdAt ?? Date.now());
  d.setDate(d.getDate() + 30);
  return d;
};
const pendienteDe = (f) => f.total - (f.pagado ?? 0);
const esVencida = (f) => fechaVencimiento(f) < new Date() && pendienteDe(f) > 0.005;

function FilaPago({ f, pagoForm, setPagoForm, onRegistrar }) {
  const pendiente = pendienteDe(f);
  const vencida = esVencida(f);
  return (
    <div
      className={`panel px-5 py-4 flex items-center gap-4 ${
        vencida ? "!bg-rose-50/50 !border-rose-200/50" : ""
      }`}
    >
      <Avatar nombre={f.proveedor?.nombre} className="!w-10 !h-10 !rounded-full" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[#0f172a] truncate flex items-center gap-2">
          {f.proveedor?.nombre}
          {vencida && (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-rose-100 text-rose-600">
              Vencida
            </span>
          )}
        </p>
        <p className="num text-[11.5px] text-slate-400 mt-0.5">
          {f.numeroFacturaProveedor ?? "s/n"} · {fmtFecha(f.fechaExpedicion)} ·{" "}
          <span className={vencida ? "text-rose-500 font-medium" : ""}>
            vence {fmtFecha(fechaVencimiento(f))}
          </span>
        </p>
      </div>
      <p className="num text-[17px] font-semibold text-[#0f172a] whitespace-nowrap">
        {euros(pendiente)}
      </p>
      {pagoForm?.id === f._id ? (
        <span className="inline-flex items-center gap-2 shrink-0">
          <input
            type="number"
            step="0.01"
            min="0"
            value={pagoForm.importe}
            onChange={(e) => setPagoForm({ ...pagoForm, importe: e.target.value })}
            className="input w-24 !px-2 !py-1.5 text-right num"
          />
          <select
            value={pagoForm.metodo}
            onChange={(e) => setPagoForm({ ...pagoForm, metodo: e.target.value })}
            className="input !px-2 !py-1.5"
          >
            {["transferencia", "domiciliacion", "tarjeta", "efectivo", "otro"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            onClick={() => onRegistrar(f)}
            className="text-xs font-semibold bg-rose-600 text-white px-3 py-2 rounded-lg hover:bg-rose-700"
          >
            OK
          </button>
        </span>
      ) : (
        <button
          onClick={() =>
            setPagoForm({ id: f._id, importe: pendiente.toFixed(2), metodo: "transferencia" })
          }
          className="shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-semibold bg-rose-600 text-white px-3.5 py-2 rounded-lg hover:bg-rose-700 transition-colors"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Marcar pagada
        </button>
      )}
    </div>
  );
}

export default function TesoreriaPagosPage() {
  const [pendientes, setPendientes] = useState([]);
  const [pagoForm, setPagoForm] = useState(null); // {id, importe, metodo}
  const [vista, setVista] = useState("lista"); // "lista" | "proveedor"
  const [error, setError] = useState(null);

  async function cargar() {
    try {
      const r = await fetch("/api/facturas-compra?pendientesPago=1");
      setPendientes(await r.json());
      setPagoForm(null);
    } catch {
      setError("No se pudo conectar con la API.");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function registrarPago(f) {
    const importe = Number(pagoForm?.importe ?? 0);
    if (!(importe > 0)) return;
    setError(null);
    const r = await fetch(`/api/facturas-compra/${f._id}/pagos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importe, metodo: pagoForm.metodo ?? "transferencia" }),
    });
    if (r.ok) await cargar();
    else setError((await r.json()).error);
  }

  const totalPendiente = pendientes.reduce((s, f) => s + pendienteDe(f), 0);
  const vencidas = pendientes.filter(esVencida);

  const gruposProveedor = (() => {
    const m = new Map();
    for (const f of pendientes) {
      const k = f.proveedor?.nombre ?? "Sin proveedor";
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(f);
    }
    return [...m.entries()].map(([nombre, fs]) => ({
      nombre,
      fs,
      total: fs.reduce((s, f) => s + pendienteDe(f), 0),
    }));
  })();

  const propsFila = { pagoForm, setPagoForm, onRegistrar: registrarPago };

  return (
    <>
      <CabeceraPagina
        titulo="Pagos"
        descripcion="Facturas de compra validadas que aún no se han pagado."
      >
        <div className="inline-flex rounded-lg overflow-hidden border border-white/15 text-[12.5px] font-semibold">
          <button
            onClick={() => setVista("lista")}
            className={`px-3.5 py-2 transition-colors ${vista === "lista" ? "bg-white text-slate-800" : "text-slate-300 hover:text-white"}`}
          >
            Lista
          </button>
          <button
            onClick={() => setVista("proveedor")}
            className={`px-3.5 py-2 transition-colors ${vista === "proveedor" ? "bg-white text-slate-800" : "text-slate-300 hover:text-white"}`}
          >
            Por proveedor
          </button>
        </div>
      </CabeceraPagina>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="panel px-6 py-5">
          <p className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-slate-400">
            Pendiente de pago
          </p>
          <p className="num text-[26px] font-semibold text-rose-600 mt-1.5">
            {euros(totalPendiente)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{pendientes.length} factura(s)</p>
        </div>
        <div className="panel px-6 py-5 !bg-rose-50/70 !border-rose-200/60">
          <p className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-rose-400">
            Vencidas
          </p>
          <p className="num text-[26px] font-semibold text-rose-600 mt-1.5">{vencidas.length}</p>
          <p className="text-xs text-rose-400/80 mt-1">Vencimiento: fecha + 30 días</p>
        </div>
      </div>

      {/* Lista de pagos */}
      {pendientes.length === 0 ? (
        <div className="panel p-8 text-center text-slate-400 text-sm">
          Nada pendiente de pago.
        </div>
      ) : vista === "lista" ? (
        <div className="space-y-2.5">
          {pendientes.map((f) => (
            <FilaPago key={f._id} f={f} {...propsFila} />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {gruposProveedor.map((g) => (
            <div key={g.nombre}>
              <div className="flex items-center justify-between px-2 mb-2">
                <p className="text-sm font-semibold text-[#0f172a]">
                  {g.nombre} <span className="text-slate-400 font-normal">· {g.fs.length} factura(s)</span>
                </p>
                <p className="num text-sm font-semibold text-rose-600">{euros(g.total)}</p>
              </div>
              <div className="space-y-2.5">
                {g.fs.map((f) => (
                  <FilaPago key={f._id} f={f} {...propsFila} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
