import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { IconBorrar } from "../components/icons.jsx";

const CAMPOS_VENTA = [
  ["proxPresupuesto", "Próx. presup."],
  ["proxAlbaran", "Próx. albarán"],
  ["proxFactura", "Próx. factura"],
];
const CAMPOS_COMPRA = [
  ["proxPresupuesto", "Próx. presup."],
  ["proxPedido", "Próx. pedido"],
  ["proxAlbaran", "Próx. albarán"],
];

const nuevaVenta = (defecto = false) => ({
  nombre: "", defecto, proxPresupuesto: 1, proxAlbaran: 1, proxFactura: 1,
});
const nuevaCompra = (defecto = false) => ({
  nombre: "", defecto, proxPresupuesto: 1, proxPedido: 1, proxAlbaran: 1,
});

function IconoCapas() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="m2 12 10 5 10-5" />
      <path d="m2 17 10 5 10-5" />
    </svg>
  );
}

function Estrella({ activa }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"
      fill={activa ? "#f59e0b" : "none"} stroke={activa ? "#f59e0b" : "#94a3b8"}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6z" />
    </svg>
  );
}

function TarjetaSeries({ titulo, subtitulo, campos, series, onCambio }) {
  const poner = (i, campo, valor) =>
    onCambio(series.map((s, j) => (j === i ? { ...s, [campo]: valor } : s)));

  const marcarDefecto = (i) => onCambio(series.map((s, j) => ({ ...s, defecto: j === i })));

  const borrar = (i) => {
    const resto = series.filter((_, j) => j !== i);
    if (resto.length > 0 && !resto.some((s) => s.defecto)) resto[0].defecto = true;
    onCambio(resto);
  };

  const anadir = () => onCambio([...series, campos === CAMPOS_VENTA ? nuevaVenta(series.length === 0) : nuevaCompra(series.length === 0)]);

  return (
    <div className="panel p-5 mb-5 max-w-3xl">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 shrink-0">
          <IconoCapas />
        </span>
        <div>
          <h2 className="text-white font-semibold leading-tight">{titulo}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_108px_108px_108px_64px_36px] gap-3 items-end mb-1.5 px-0.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500">Serie</span>
        {campos.map(([clave, etiqueta]) => (
          <span key={clave} className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500 text-right">
            {etiqueta}
          </span>
        ))}
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500 text-center">Defecto</span>
        <span />
      </div>

      <div className="space-y-2">
        {series.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_108px_108px_108px_64px_36px] gap-3 items-center">
            <input
              className="input uppercase"
              value={s.nombre}
              placeholder="A"
              maxLength={10}
              onChange={(e) => poner(i, "nombre", e.target.value.toUpperCase())}
            />
            {campos.map(([clave]) => (
              <input
                key={clave}
                type="number"
                min="1"
                className="input text-right num"
                value={s[clave] ?? 1}
                onChange={(e) => poner(i, clave, e.target.value)}
              />
            ))}
            <button
              type="button"
              title={s.defecto ? "Serie por defecto" : "Marcar como por defecto"}
              onClick={() => marcarDefecto(i)}
              className="justify-self-center flex items-center justify-center w-8 h-8 rounded-lg hover:bg-amber-400/10 transition-colors"
            >
              <Estrella activa={s.defecto} />
            </button>
            <button
              type="button"
              title={series.length <= 1 ? "Debe quedar al menos una serie" : "Eliminar serie"}
              disabled={series.length <= 1}
              onClick={() => borrar(i)}
              className="justify-self-center flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
            >
              <IconBorrar />
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={anadir} className="btn-ghost mt-4 text-[13px]">
        + Añadir serie
      </button>
    </div>
  );
}

// Tarjeta de métodos de pago: nombre + plazos en días (opcional).
// Un método con plazos "30, 60, 90" genera en la factura tres vencimientos
// a partes iguales; sin plazos es un pago único con vencimiento manual.
function TarjetaMetodosPago({ metodos, onCambio }) {
  const poner = (i, campo, valor) =>
    onCambio(metodos.map((m, j) => (j === i ? { ...m, [campo]: valor } : m)));

  const marcarDefecto = (i) => onCambio(metodos.map((m, j) => ({ ...m, defecto: j === i })));

  const borrar = (i) => {
    const resto = metodos.filter((_, j) => j !== i);
    if (resto.length > 0 && !resto.some((m) => m.defecto)) resto[0].defecto = true;
    onCambio(resto);
  };

  // El usuario escribe "30, 60, 90" y se guarda como [30, 60, 90].
  const ponerPlazos = (i, texto) => {
    const plazos = texto
      .split(/[,\s/]+/)
      .map((t) => parseInt(t, 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    onCambio(metodos.map((m, j) => (j === i ? { ...m, plazos, _textoPlazos: texto } : m)));
  };

  const anadir = () =>
    onCambio([...metodos, { nombre: "", plazos: [], defecto: metodos.length === 0 }]);

  return (
    <div className="panel p-5 mb-5 max-w-3xl">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
        </span>
        <div>
          <h2 className="text-white font-semibold leading-tight">Métodos de pago</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Catálogo de formas de pago de las facturas. Con plazos en días (p.ej. «30, 60, 90»)
            la factura genera esos vencimientos a partes iguales.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_200px_64px_36px] gap-3 items-end mb-1.5 px-0.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500">Método</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500">Plazos (días)</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500 text-center">Defecto</span>
        <span />
      </div>

      <div className="space-y-2">
        {metodos.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_200px_64px_36px] gap-3 items-center">
            <input
              className="input"
              value={m.nombre}
              placeholder="Transferencia, pagaré, confirming…"
              maxLength={40}
              onChange={(e) => poner(i, "nombre", e.target.value)}
            />
            <input
              className="input num"
              value={m._textoPlazos ?? (m.plazos?.length ? m.plazos.join(", ") : "")}
              placeholder="— (pago único)"
              title="Días separados por comas: 30, 60, 90"
              onChange={(e) => ponerPlazos(i, e.target.value)}
            />
            <button
              type="button"
              title={m.defecto ? "Método por defecto" : "Marcar como por defecto"}
              onClick={() => marcarDefecto(i)}
              className="justify-self-center flex items-center justify-center w-8 h-8 rounded-lg hover:bg-amber-400/10 transition-colors"
            >
              <Estrella activa={m.defecto} />
            </button>
            <button
              type="button"
              title={metodos.length <= 1 ? "Debe quedar al menos un método" : "Eliminar método"}
              disabled={metodos.length <= 1}
              onClick={() => borrar(i)}
              className="justify-self-center flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
            >
              <IconBorrar />
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={anadir} className="btn-ghost mt-4 text-[13px]">
        + Añadir método de pago
      </button>
    </div>
  );
}

export default function SeriesPage() {
  const [venta, setVenta] = useState(null);
  const [compra, setCompra] = useState(null);
  const [metodos, setMetodos] = useState([]);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch("/api/empresa")
      .then((r) => r.json())
      .then((e) => {
        setVenta(e.seriesVenta?.length ? e.seriesVenta : [nuevaVenta(true)]);
        setCompra(e.seriesCompra?.length ? e.seriesCompra : [nuevaCompra(true)]);
        setMetodos(
          e.metodosPago?.length
            ? e.metodosPago
            : [{ nombre: "Transferencia", plazos: [], defecto: true }]
        );
      })
      .catch(() => setError("No se pudo conectar con la API."));
  }, []);

  async function guardar() {
    setAviso(null);
    setError(null);
    if (venta.some((s) => !String(s.nombre).trim()) || compra.some((s) => !String(s.nombre).trim())) {
      return setError("Todas las series necesitan nombre.");
    }
    if (metodos.some((m) => !String(m.nombre).trim())) {
      return setError("Todos los métodos de pago necesitan nombre.");
    }
    setGuardando(true);
    try {
      const r = await fetch("/api/empresa/series", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesVenta: venta, seriesCompra: compra, metodosPago: metodos }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo guardar");
      setVenta(datos.seriesVenta);
      setCompra(datos.seriesCompra);
      setMetodos(datos.metodosPago);
      setAviso("Series y métodos de pago guardados. Los próximos documentos ya usan esta configuración.");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <CabeceraPagina
        titulo="Series"
        descripcion="Numeración de presupuestos, albaranes y facturas. Cada documento toma el número de la serie marcada por defecto."
      >
        {venta && (
          <button onClick={guardar} disabled={guardando} className="btn-primary">
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        )}
      </CabeceraPagina>

      {aviso && <p className="text-sm text-accent mb-4">{aviso}</p>}
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {!venta ? null : (
        <>
          <TarjetaSeries
            titulo="Series de venta"
            subtitulo="Numeración de presupuestos, albaranes y facturas emitidas"
            campos={CAMPOS_VENTA}
            series={venta}
            onCambio={setVenta}
          />
          <TarjetaSeries
            titulo="Series de compra"
            subtitulo="Numeración interna de presupuestos, pedidos y albaranes recibidos"
            campos={CAMPOS_COMPRA}
            series={compra}
            onCambio={setCompra}
          />
          <TarjetaMetodosPago metodos={metodos} onCambio={setMetodos} />
        </>
      )}
    </>
  );
}
