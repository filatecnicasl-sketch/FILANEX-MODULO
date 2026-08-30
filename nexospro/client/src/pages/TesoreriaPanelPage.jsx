import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { euros } from "../components/ui.jsx";
import {
  IconVentas, IconTesoreria, IconFacturaRecibida, IconProveedores,
  IconClientes, IconArticulos, IconPedidos, IconAlbaranes,
  IconCobros, IconPagos,
} from "../components/icons.jsx";

const fmtFecha = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "—");
const vencimientoDe = (doc) => {
  if (doc.vencimiento) return new Date(doc.vencimiento);
  const d = new Date(doc.fechaExpedicion ?? doc.createdAt ?? Date.now());
  d.setDate(d.getDate() + 30);
  return d;
};
const esVencida = (doc, cubierto) => vencimientoDe(doc) < new Date() && doc.total - cubierto > 0.005;

const TONOS_TARJETA = {
  emerald: { fondo: "bg-emerald-50", borde: "border-emerald-200", texto: "text-emerald-700", icono: "bg-emerald-100 text-emerald-600" },
  rose: { fondo: "bg-rose-50", borde: "border-rose-200", texto: "text-rose-700", icono: "bg-rose-100 text-rose-600" },
  amber: { fondo: "bg-amber-50", borde: "border-amber-200", texto: "text-amber-700", icono: "bg-amber-100 text-amber-600" },
  sky: { fondo: "bg-sky-50", borde: "border-sky-200", texto: "text-sky-700", icono: "bg-sky-100 text-sky-600" },
  indigo: { fondo: "bg-indigo-50", borde: "border-indigo-200", texto: "text-indigo-700", icono: "bg-indigo-100 text-indigo-600" },
  violet: { fondo: "bg-violet-50", borde: "border-violet-200", texto: "text-violet-700", icono: "bg-violet-100 text-violet-600" },
};

function TarjetaGrande({ titulo, valor, detalle, tono, to, Icono }) {
  const t = TONOS_TARJETA[tono];
  return (
    <Link to={to} className="block group">
      <div className={`rounded-2xl border ${t.borde} ${t.fondo} p-5 transition-all duration-150 group-hover:shadow-md group-hover:-translate-y-0.5`}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{titulo}</p>
          <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${t.icono}`}>
            <Icono />
          </span>
        </div>
        <p className={`text-[1.875rem] leading-tight font-extrabold tracking-tight mt-3 tabular-nums ${t.texto}`}>
          {valor}
        </p>
        <p className="text-xs text-slate-500 mt-1.5">{detalle}</p>
      </div>
    </Link>
  );
}

function TarjetaContador({ etiqueta, valor, enlace, Icono }) {
  return (
    <Link to={enlace} className="block group">
      <div className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-150 group-hover:shadow-sm group-hover:-translate-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-slate-400">{etiqueta}</p>
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500">
            <Icono />
          </span>
        </div>
        <p className="text-2xl font-extrabold tracking-tight mt-2 tabular-nums text-slate-800">{valor}</p>
      </div>
    </Link>
  );
}

function MiniLista({ titulo, docs, cubiertoDe, nombreDe, to }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <h2 className="text-[0.875rem] font-semibold text-slate-800">{titulo}</h2>
        <Link to={to} className="text-xs text-accent hover:underline font-medium">Ver todos →</Link>
      </div>
      {docs.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400">Nada pendiente.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {docs.map((d) => {
            const cubierto = cubiertoDe(d);
            const vencida = esVencida(d, cubierto);
            return (
              <li key={d._id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{nombreDe(d)}</p>
                  <p className={`num text-[0.71875rem] mt-0.5 ${vencida ? "text-rose-500 font-medium" : "text-slate-400"}`}>
                    vence {fmtFecha(vencimientoDe(d))}
                  </p>
                </div>
                <p className="num text-sm font-semibold text-slate-800 whitespace-nowrap">
                  {euros(d.total - cubierto)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function TesoreriaPanelPage() {
  const [resumen, setResumen] = useState(null);
  const [cobros, setCobros] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [remesas, setRemesas] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [rResumen, rc, rp, rr] = await Promise.all([
          fetch("/api/resumen"),
          fetch("/api/facturas-venta?pendientesCobro=1"),
          fetch("/api/facturas-compra?pendientesPago=1"),
          fetch("/api/remesas"),
        ]);
        setResumen(await rResumen.json());
        setCobros(await rc.json());
        setPagos(await rp.json());
        setRemesas(await rr.json());
      } catch {
        setError("No se pudo conectar con la API.");
      }
    })();
  }, []);

  const pendCobro = cobros.reduce((s, f) => s + (f.total - f.cobrado), 0);
  const pendPago = pagos.reduce((s, f) => s + (f.total - (f.pagado ?? 0)), 0);
  const vencidasCobro = cobros.filter((f) => esVencida(f, f.cobrado)).length;
  const vencidosPago = pagos.filter((f) => esVencida(f, f.pagado ?? 0)).length;
  const netoPrevisto = pendCobro - pendPago;

  const porVencimiento = (a, b) => vencimientoDe(a) - vencimientoDe(b);
  const cobrosUrgentes = [...cobros].sort(porVencimiento).slice(0, 5);
  const pagosUrgentes = [...pagos].sort(porVencimiento).slice(0, 5);

  const maxMes = Math.max(1, ...(resumen?.mensual ?? []).map((m) => m.total));

  return (
    <>
      <CabeceraPagina
        titulo="Tesorería"
        descripcion="Situación general de la empresa: facturación, cobros, pagos y actividad."
      />

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}

      {/* Tarjetas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <TarjetaGrande
          titulo="Facturado"
          valor={resumen ? euros(resumen.facturado.total) : "—"}
          detalle={`${resumen?.facturado.count ?? "…"} facturas emitidas (incluye tickets TPV)`}
          tono="sky"
          to="/ventas"
          Icono={IconVentas}
        />
        <TarjetaGrande
          titulo="Cobrado hoy"
          valor={resumen ? euros(resumen.cobradoHoy?.total ?? 0) : "—"}
          detalle={
            resumen
              ? `Efectivo ${euros(resumen.cobradoHoy?.efectivo ?? 0)} · Tarjeta ${euros(resumen.cobradoHoy?.tarjeta ?? 0)}${
                  (resumen.cobradoHoy?.otros ?? 0) !== 0 ? ` · Otros ${euros(resumen.cobradoHoy.otros)}` : ""
                }${(resumen.cobradoHoy?.tpv ?? 0) !== 0 ? ` — TPV ${euros(resumen.cobradoHoy.tpv)} (${resumen.ticketsHoy} tickets)` : ""}`
              : "…"
          }
          tono="emerald"
          to="/tpv/tickets"
          Icono={IconCobros}
        />
        <TarjetaGrande
          titulo="Pendiente de cobro"
          valor={euros(pendCobro)}
          detalle={`${cobros.length} factura(s) de clientes`}
          tono="amber"
          to="/tesoreria/cobros"
          Icono={IconCobros}
        />
        <TarjetaGrande
          titulo="Pendiente de pago"
          valor={euros(pendPago)}
          detalle={`${pagos.length} factura(s) de proveedores · cobrado este mes ${euros(resumen?.cobradoMes?.total ?? 0)}`}
          tono="rose"
          to="/tesoreria/pagos"
          Icono={IconPagos}
        />
      </div>

      {/* Neto previsto en una franja propia */}
      <div className="grid grid-cols-1 mb-6">
        <TarjetaGrande
          titulo="Neto previsto"
          valor={euros(netoPrevisto)}
          detalle={`Cobros pendientes − pagos pendientes · ${remesas.length} remesa(s) SEPA`}
          tono={netoPrevisto >= 0 ? "indigo" : "amber"}
          to="/tesoreria/cobros"
          Icono={IconTesoreria}
        />
      </div>

      {/* Contadores secundarios */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <TarjetaContador etiqueta="Clientes" valor={resumen?.contadores.clientes ?? "—"} enlace="/clientes" Icono={IconClientes} />
        <TarjetaContador etiqueta="Proveedores" valor={resumen?.contadores.proveedores ?? "—"} enlace="/proveedores" Icono={IconProveedores} />
        <TarjetaContador etiqueta="Artículos" valor={resumen?.contadores.articulos ?? "—"} enlace="/articulos" Icono={IconArticulos} />
        <TarjetaContador etiqueta="Pedidos" valor={resumen?.contadores.pedidos ?? "—"} enlace="/compras/pedidos" Icono={IconPedidos} />
        <TarjetaContador etiqueta="Albaranes" valor={resumen?.contadores.albaranes ?? "—"} enlace="/albaranes" Icono={IconAlbaranes} />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-5">
            Facturación mensual
          </p>
          <div className="flex items-end gap-3" style={{ height: "176px" }}>
            {(resumen?.mensual ?? []).map((m) => {
              const alturaPx = m.total > 0 ? Math.max(8, Math.round((m.total / maxMes) * 120)) : 2;
              return (
                <div key={m.clave} className="flex-1 flex flex-col items-center justify-end gap-2 min-w-0 h-full" title={euros(m.total)}>
                  <span className="text-[0.625rem] text-slate-400 tabular-nums">
                    {m.total > 0 ? euros(m.total) : ""}
                  </span>
                  <div
                    className={`w-full max-w-14 rounded-t-lg transition-all ${
                      m.total > 0
                        ? "bg-gradient-to-t from-accent/50 to-accent shadow-sm"
                        : "bg-slate-100"
                    }`}
                    style={{ height: `${alturaPx}px` }}
                  />
                  <span className="text-[0.6875rem] text-slate-400 capitalize">{m.etiqueta}</span>
                </div>
              );
            })}
            {!resumen && <p className="text-sm text-slate-400">Cargando…</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-4">
            Distribución
          </p>
          <div className="flex items-center justify-center h-40">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 36 36" className="w-full h-full">
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                {pendCobro + pendPago > 0 && (
                  <>
                    <circle
                      cx="18" cy="18" r="15.9155" fill="none"
                      stroke="#10b981" strokeWidth="3"
                      strokeDasharray={`${(pendCobro / (pendCobro + pendPago)) * 100} ${100 - (pendCobro / (pendCobro + pendPago)) * 100}`}
                      strokeDashoffset="25"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="18" cy="18" r="15.9155" fill="none"
                      stroke="#f43f5e" strokeWidth="3"
                      strokeDasharray={`${(pendPago / (pendCobro + pendPago)) * 100} ${100 - (pendPago / (pendCobro + pendPago)) * 100}`}
                      strokeDashoffset={`${25 - (pendCobro / (pendCobro + pendPago)) * 100}`}
                      strokeLinecap="round"
                    />
                  </>
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xs text-slate-400">Total</p>
                <p className="text-lg font-bold text-slate-800">{euros(pendCobro + pendPago)}</p>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Por cobrar
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Por pagar
            </span>
          </div>
        </div>
      </div>

      {/* Listas urgentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MiniLista
          titulo="Cobros más urgentes"
          docs={cobrosUrgentes}
          cubiertoDe={(f) => f.cobrado}
          nombreDe={(f) => f.cliente?.nombre ?? "—"}
          to="/tesoreria/cobros"
        />
        <MiniLista
          titulo="Pagos más urgentes"
          docs={pagosUrgentes}
          cubiertoDe={(f) => f.pagado ?? 0}
          nombreDe={(f) => f.proveedor?.nombre ?? "—"}
          to="/tesoreria/pagos"
        />
      </div>
    </>
  );
}
