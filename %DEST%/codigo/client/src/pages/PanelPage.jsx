import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { euros } from "../components/ui.jsx";
import {
  IconVentas, IconTesoreria, IconFacturaRecibida, IconProveedores,
  IconClientes, IconArticulos, IconPedidos, IconAlbaranes,
} from "../components/icons.jsx";

const TONOS_ICONO = {
  cyan: { fondo: "bg-accent/15", chip: "bg-accent/10 border-accent/25 text-accent" },
  amber: { fondo: "bg-amber-400/15", chip: "bg-amber-400/10 border-amber-400/25 text-amber-300" },
  rose: { fondo: "bg-rose-400/15", chip: "bg-rose-400/10 border-rose-400/25 text-rose-300" },
  slate: { fondo: "bg-slate-400/10", chip: "bg-white/5 border-white/10 text-slate-300" },
};

function TarjetaDinero({ etiqueta, valor, nota, enlace, Icono, tono, pastel }) {
  const t = TONOS_ICONO[tono];
  return (
    <Link to={enlace} className="block">
      <div
        className="panel relative overflow-hidden p-5 h-full transition-all duration-150 hover:-translate-y-0.5 hover:border-white/[0.12]"
        style={pastel ? { background: pastel, borderColor: "rgba(15, 23, 42, 0.08)" } : undefined}
      >
        {!pastel && (
          <div aria-hidden="true" className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl ${t.fondo}`} />
        )}
        <div className="relative flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{etiqueta}</p>
          <span className={`flex items-center justify-center w-9 h-9 rounded-xl border ${t.chip}`}>
            <Icono />
          </span>
        </div>
        <p className="relative text-[30px] leading-tight font-extrabold tracking-tight mt-4 tabular-nums text-white">
          {valor}
        </p>
        <p className="relative text-xs text-slate-500 mt-1.5">{nota}</p>
      </div>
    </Link>
  );
}

function TarjetaContador({ etiqueta, valor, enlace, Icono }) {
  return (
    <Link to={enlace} className="block">
      <div className="panel relative overflow-hidden p-4 h-full transition-all duration-150 hover:-translate-y-0.5 hover:border-white/[0.12]">
        <div className="relative flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{etiqueta}</p>
          <span className="flex items-center justify-center w-7 h-7 rounded-lg border bg-white/5 border-white/10 text-slate-400">
            <Icono />
          </span>
        </div>
        <p className="relative text-2xl font-extrabold tracking-tight mt-2.5 tabular-nums text-white">{valor}</p>
      </div>
    </Link>
  );
}

const TONO_COBRO = { pendiente: "text-amber-300", parcial: "text-cyan-300", cobrada: "text-emerald-300" };

export default function PanelPage() {
  const [r, setResumen] = useState(null);

  useEffect(() => {
    fetch("/api/resumen")
      .then((res) => res.json())
      .then(setResumen)
      .catch(() => setResumen(null));
  }, []);

  const maxMes = Math.max(1, ...(r?.mensual ?? []).map((m) => m.total));

  return (
    <>
      <CabeceraPagina
        titulo="Panel"
        descripcion="Situación de la empresa: facturación, cobros y pagos pendientes, y actividad."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <TarjetaDinero
          etiqueta="Facturado"
          valor={r ? euros(r.facturado.total) : "—"}
          nota={`${r?.facturado.count ?? "…"} facturas emitidas`}
          enlace="/ventas"
          Icono={IconVentas}
          tono="cyan"
          pastel="#d3e7f7"
        />
        <TarjetaDinero
          etiqueta="Pendiente cobro"
          valor={r ? euros(r.pendienteCobro) : "—"}
          nota="Facturas sin cobrar"
          enlace="/tesoreria"
          Icono={IconTesoreria}
          tono="amber"
          pastel="#dcefe3"
        />
        <TarjetaDinero
          etiqueta="Gastos"
          valor={r ? euros(r.gastos.total) : "—"}
          nota={`${r?.gastos.count ?? "…"} facturas recibidas`}
          enlace="/compras/facturas"
          Icono={IconFacturaRecibida}
          tono="rose"
          pastel="#fdf0d3"
        />
        <TarjetaDinero
          etiqueta="Pendiente pago"
          valor={r ? euros(r.pendientePago) : "—"}
          nota="Facturas sin pagar"
          enlace="/compras/facturas"
          Icono={IconProveedores}
          tono="amber"
          pastel="#e6e0f4"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mt-4">
        <TarjetaContador etiqueta="Clientes" valor={r?.contadores.clientes ?? "—"} enlace="/clientes" Icono={IconClientes} />
        <TarjetaContador etiqueta="Proveedores" valor={r?.contadores.proveedores ?? "—"} enlace="/proveedores" Icono={IconProveedores} />
        <TarjetaContador etiqueta="Artículos" valor={r?.contadores.articulos ?? "—"} enlace="/articulos" Icono={IconArticulos} />
        <TarjetaContador etiqueta="Pedidos" valor={r?.contadores.pedidos ?? "—"} enlace="/compras/pedidos" Icono={IconPedidos} />
        <TarjetaContador etiqueta="Albaranes" valor={r?.contadores.albaranes ?? "—"} enlace="/albaranes" Icono={IconAlbaranes} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
        <div className="panel p-6 xl:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-5">
            Facturación mensual
          </p>
          <div className="flex items-end gap-3 h-44">
            {(r?.mensual ?? []).map((m) => (
              <div key={m.clave} className="flex-1 flex flex-col items-center gap-2 min-w-0" title={euros(m.total)}>
                <span className="text-[10px] text-slate-500 tabular-nums">
                  {m.total > 0 ? euros(m.total) : ""}
                </span>
                <div
                  className={`w-full max-w-14 rounded-t-lg transition-all ${
                    m.total > 0
                      ? "bg-gradient-to-t from-accent/50 to-accent shadow-glow"
                      : "bg-white/[0.06]"
                  }`}
                  style={{ height: `${Math.max(m.total > 0 ? 6 : 2, (m.total / maxMes) * 100)}%` }}
                />
                <span className="text-[11px] text-slate-500 capitalize">{m.etiqueta}</span>
              </div>
            ))}
            {!r && <p className="text-sm text-slate-600">Cargando…</p>}
          </div>
        </div>

        <div className="panel p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-4">
            Últimas facturas emitidas
          </p>
          {!r ? (
            <p className="text-sm text-slate-600">Cargando…</p>
          ) : r.ultimasFacturas.length === 0 ? (
            <p className="text-sm text-slate-600">Aún no hay facturas emitidas.</p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {r.ultimasFacturas.map((f) => (
                <Link key={f.numero} to="/ventas" className="flex items-baseline justify-between gap-3 py-2.5 group">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white group-hover:text-accent transition-colors">
                      {f.numero}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{f.cliente}</p>
                  </div>
                  <p className={`text-sm font-semibold tabular-nums whitespace-nowrap ${TONO_COBRO[f.estadoCobro] ?? "text-slate-300"}`}>
                    {euros(f.total)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
