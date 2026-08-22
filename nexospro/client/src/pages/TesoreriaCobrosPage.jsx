import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Avatar, euros } from "../components/ui.jsx";

const fmtFecha = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "—");
// Vencimiento por defecto: fecha de expedición + 30 días (como la referencia).
const fechaVencimiento = (f) => {
  if (f.vencimiento) return new Date(f.vencimiento);
  const d = new Date(f.fechaExpedicion ?? f.createdAt ?? Date.now());
  d.setDate(d.getDate() + 30);
  return d;
};
const esVencida = (f) => fechaVencimiento(f) < new Date() && f.total - f.cobrado > 0;

function FilaCobro({ f, seleccion, onToggle, cobroForm, setCobroForm, onRegistrar }) {
  const pendiente = f.total - f.cobrado;
  const conIban = !!f.cliente?.iban;
  const vencida = esVencida(f);
  return (
    <div
      className={`panel px-5 py-4 flex items-center gap-4 ${
        vencida ? "!bg-rose-50/50 !border-rose-200/50" : ""
      }`}
    >
      {conIban && !f.remesa ? (
        <input
          type="checkbox"
          checked={seleccion.includes(f._id)}
          onChange={() => onToggle(f._id)}
          title="Incluir en remesa SEPA"
          className="accent-[#0369a1] w-4 h-4 shrink-0"
        />
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <Avatar nombre={f.cliente?.nombre} className="!w-10 !h-10 !rounded-full" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[#0f172a] truncate flex items-center gap-2">
          {f.cliente?.nombre}
          {vencida && (
            <span className="shrink-0 text-[0.625rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-rose-100 text-rose-600">
              Vencida
            </span>
          )}
          {!conIban && (
            <span className="shrink-0 text-[0.625rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-100 text-amber-600">
              sin IBAN
            </span>
          )}
          {f.remesa && (
            <span className="shrink-0 text-[0.625rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-sky-100 text-sky-600">
              en remesa
            </span>
          )}
        </p>
        <p className="num text-[0.71875rem] text-slate-400 mt-0.5">
          {f.serieNumero} · {fmtFecha(f.fechaExpedicion)} ·{" "}
          <span className={vencida ? "text-rose-500 font-medium" : ""}>
            vence {fmtFecha(fechaVencimiento(f))}
          </span>
        </p>
      </div>
      <p className="num text-[1.0625rem] font-semibold text-[#0f172a] whitespace-nowrap">
        {euros(pendiente)}
      </p>
      {cobroForm?.id === f._id ? (
        <span className="inline-flex items-center gap-2 shrink-0">
          <input
            type="number"
            step="0.01"
            min="0"
            value={cobroForm.importe}
            onChange={(e) => setCobroForm({ ...cobroForm, importe: e.target.value })}
            className="input w-24 !px-2 !py-1.5 text-right num"
          />
          <select
            value={cobroForm.metodo}
            onChange={(e) => setCobroForm({ ...cobroForm, metodo: e.target.value })}
            className="input !px-2 !py-1.5"
          >
            {["transferencia", "efectivo", "tarjeta", "remesa", "otro"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            onClick={() => onRegistrar(f)}
            className="text-xs font-semibold bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700"
          >
            OK
          </button>
        </span>
      ) : (
        <button
          onClick={() =>
            setCobroForm({ id: f._id, importe: pendiente.toFixed(2), metodo: "transferencia" })
          }
          className="shrink-0 inline-flex items-center gap-1.5 text-[0.78125rem] font-semibold bg-emerald-600 text-white px-3.5 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
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
          Marcar cobrada
        </button>
      )}
    </div>
  );
}

export default function TesoreriaCobrosPage() {
  const [pendientes, setPendientes] = useState([]);
  const [remesas, setRemesas] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [fechaCargo, setFechaCargo] = useState("");
  const [cobroForm, setCobroForm] = useState(null); // {id, importe, metodo}
  const [vista, setVista] = useState("lista"); // "lista" | "cliente"
  const [error, setError] = useState(null);

  async function cargar() {
    try {
      const [rf, rr] = await Promise.all([
        fetch("/api/facturas-venta?pendientesCobro=1"),
        fetch("/api/remesas"),
      ]);
      setPendientes(await rf.json());
      setRemesas(await rr.json());
      setSeleccion([]);
      setCobroForm(null);
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

  async function registrarCobro(f) {
    const importe = Number(cobroForm?.importe ?? 0);
    if (!(importe > 0)) return;
    setError(null);
    const r = await fetch(`/api/facturas-venta/${f._id}/cobros`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importe, metodo: cobroForm.metodo ?? "transferencia" }),
    });
    if (r.ok) await cargar();
    else setError((await r.json()).error);
  }

  async function generarRemesa() {
    if (!fechaCargo) {
      setError("Indica la fecha de cargo de la remesa.");
      return;
    }
    setError(null);
    const r = await fetch("/api/remesas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facturaIds: seleccion, fechaCargo }),
    });
    if (r.ok) await cargar();
    else setError((await r.json()).error);
  }

  const totalPendiente = pendientes.reduce((s, f) => s + (f.total - f.cobrado), 0);
  const vencidas = pendientes.filter(esVencida);

  // Agrupación por cliente para la vista "Por cliente".
  const gruposCliente = (() => {
    const m = new Map();
    for (const f of pendientes) {
      const k = f.cliente?.nombre ?? "Sin cliente";
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(f);
    }
    return [...m.entries()].map(([nombre, fs]) => ({
      nombre,
      fs,
      total: fs.reduce((s, f) => s + (f.total - f.cobrado), 0),
    }));
  })();

  const propsFila = { seleccion, onToggle: toggle, cobroForm, setCobroForm, onRegistrar: registrarCobro };

  return (
    <>
      <CabeceraPagina
        titulo="Cobros"
        descripcion="Facturas emitidas que aún no se han cobrado, registro de cobros y remesas SEPA."
      >
        <div className="inline-flex rounded-lg overflow-hidden border border-slate-300 bg-white text-[0.78125rem] font-semibold">
          <button
            onClick={() => setVista("lista")}
            className={`px-3.5 py-2 transition-colors ${vista === "lista" ? "seg-activo" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
          >
            Lista
          </button>
          <button
            onClick={() => setVista("cliente")}
            className={`px-3.5 py-2 transition-colors ${vista === "cliente" ? "seg-activo" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
          >
            Por cliente
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
          <p className="text-[0.65625rem] font-semibold tracking-[0.12em] uppercase text-slate-400">
            Pendiente de cobro
          </p>
          <p className="num text-[1.625rem] font-semibold text-emerald-600 mt-1.5">
            {euros(totalPendiente)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{pendientes.length} factura(s)</p>
        </div>
        <div className="panel px-6 py-5 !bg-rose-50/70 !border-rose-200/60">
          <p className="text-[0.65625rem] font-semibold tracking-[0.12em] uppercase text-rose-400">
            Vencidas
          </p>
          <p className="num text-[1.625rem] font-semibold text-rose-600 mt-1.5">{vencidas.length}</p>
          <p className="text-xs text-rose-400/80 mt-1">Vencimiento superado y sin cobrar</p>
        </div>
      </div>

      {/* Generación de remesa cuando hay selección */}
      {seleccion.length > 0 && (
        <div className="panel px-5 py-4 mb-5 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-[#0f172a]">{seleccion.length}</span> factura(s)
            seleccionada(s) para remesa SEPA
          </p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fechaCargo}
              onChange={(e) => setFechaCargo(e.target.value)}
              className="input"
            />
            <button onClick={generarRemesa} className="btn-primary">
              Generar remesa ({seleccion.length})
            </button>
          </div>
        </div>
      )}

      {/* Lista de cobros */}
      {pendientes.length === 0 ? (
        <div className="panel p-8 text-center text-slate-400 text-sm mb-6">
          Nada pendiente de cobro.
        </div>
      ) : vista === "lista" ? (
        <div className="space-y-2.5 mb-8">
          {pendientes.map((f) => (
            <FilaCobro key={f._id} f={f} {...propsFila} />
          ))}
        </div>
      ) : (
        <div className="space-y-5 mb-8">
          {gruposCliente.map((g) => (
            <div key={g.nombre}>
              <div className="flex items-center justify-between px-2 mb-2">
                <p className="text-sm font-semibold text-[#0f172a]">
                  {g.nombre} <span className="text-slate-400 font-normal">· {g.fs.length} factura(s)</span>
                </p>
                <p className="num text-sm font-semibold text-emerald-600">{euros(g.total)}</p>
              </div>
              <div className="space-y-2.5">
                {g.fs.map((f) => (
                  <FilaCobro key={f._id} f={f} {...propsFila} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-[0.9375rem] font-semibold text-[#0f172a] mb-3">Remesas generadas</h2>
      {remesas.length === 0 ? (
        <p className="text-sm text-slate-400">Ninguna remesa todavía.</p>
      ) : (
        <div className="panel divide-y divide-slate-100">
          {remesas.map((r) => (
            <div key={r._id} className="px-5 py-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#0f172a]">
                  {r.recibos?.length ?? 0} recibo(s) ·{" "}
                  <span className="num">{euros(r.total)}</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cargo el {fmtFecha(r.fechaCargo)} · creada el {fmtFecha(r.createdAt)}
                </p>
              </div>
              <a
                href={`/api/remesas/${r._id}/xml`}
                className="text-accent hover:underline text-xs font-medium"
              >
                Descargar XML SEPA
              </a>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
