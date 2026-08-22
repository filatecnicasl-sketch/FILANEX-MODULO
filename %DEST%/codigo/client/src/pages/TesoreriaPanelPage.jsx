import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { euros } from "../components/ui.jsx";

const fmtFecha = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "—");
// Vencimiento por defecto: fecha de expedición + 30 días.
const vencimientoDe = (doc) => {
  if (doc.vencimiento) return new Date(doc.vencimiento);
  const d = new Date(doc.fechaExpedicion ?? doc.createdAt ?? Date.now());
  d.setDate(d.getDate() + 30);
  return d;
};
const esVencida = (doc, cubierto) => vencimientoDe(doc) < new Date() && doc.total - cubierto > 0.005;

function Tarjeta({ titulo, valor, detalle, tono, to }) {
  const tonos = {
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    amber: "text-amber-600",
    indigo: "text-indigo-600",
    sky: "text-sky-600",
  };
  return (
    <Link to={to} className="panel px-6 py-5 block hover:border-accent/40 transition-colors">
      <p className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-slate-400">{titulo}</p>
      <p className={`num text-[26px] font-semibold mt-1.5 ${tonos[tono]}`}>{valor}</p>
      <p className="text-xs text-slate-400 mt-1">{detalle}</p>
    </Link>
  );
}

function MiniLista({ titulo, docs, cubiertoDe, nombreDe, to }) {
  return (
    <div className="panel">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <h2 className="text-[14px] font-semibold text-[#0f172a]">{titulo}</h2>
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
                  <p className="text-sm font-medium text-[#0f172a] truncate">{nombreDe(d)}</p>
                  <p className={`num text-[11.5px] mt-0.5 ${vencida ? "text-rose-500 font-medium" : "text-slate-400"}`}>
                    vence {fmtFecha(vencimientoDe(d))}
                  </p>
                </div>
                <p className="num text-sm font-semibold text-[#0f172a] whitespace-nowrap">
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
  const [cobros, setCobros] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [remesas, setRemesas] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [rc, rp, rr] = await Promise.all([
          fetch("/api/facturas-venta?pendientesCobro=1"),
          fetch("/api/facturas-compra?pendientesPago=1"),
          fetch("/api/remesas"),
        ]);
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

  const porVencimiento = (a, b) => vencimientoDe(a) - vencimientoDe(b);
  const cobrosUrgentes = [...cobros].sort(porVencimiento).slice(0, 5);
  const pagosUrgentes = [...pagos].sort(porVencimiento).slice(0, 5);

  return (
    <>
      <CabeceraPagina
        titulo="Tesorería"
        descripcion="Resumen de cobros pendientes, pagos a proveedores y remesas."
      />

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Tarjeta
          titulo="Pendiente de cobro"
          valor={euros(pendCobro)}
          detalle={`${cobros.length} factura(s) de clientes`}
          tono="emerald"
          to="/tesoreria/cobros"
        />
        <Tarjeta
          titulo="Pendiente de pago"
          valor={euros(pendPago)}
          detalle={`${pagos.length} factura(s) de proveedores`}
          tono="rose"
          to="/tesoreria/pagos"
        />
        <Tarjeta
          titulo="Vencidas"
          valor={vencidasCobro + vencidosPago}
          detalle={`${vencidasCobro} por cobrar · ${vencidosPago} por pagar`}
          tono="amber"
          to="/tesoreria/cobros"
        />
        <div className="panel px-6 py-5">
          <p className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-slate-400">
            Neto previsto
          </p>
          <p className={`num text-[26px] font-semibold mt-1.5 ${pendCobro - pendPago >= 0 ? "text-sky-600" : "text-rose-600"}`}>
            {euros(pendCobro - pendPago)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Cobros − pagos · {remesas.length} remesa(s) SEPA
          </p>
        </div>
      </div>

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
