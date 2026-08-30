import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import CobroModal from "./CobroModal.jsx";
import { euros } from "../../components/ui.jsx";
import { IconTicket, IconCaja, IconCerrar } from "../../components/icons.jsx";

const COLORES_TARJETA = [
  "bg-indigo-600 hover:bg-indigo-500",
  "bg-emerald-600 hover:bg-emerald-500",
  "bg-amber-600 hover:bg-amber-500",
  "bg-sky-600 hover:bg-sky-500",
  "bg-violet-600 hover:bg-violet-500",
  "bg-rose-600 hover:bg-rose-500",
  "bg-teal-600 hover:bg-teal-500",
  "bg-orange-600 hover:bg-orange-500",
];

function colorPorIndice(i) {
  return COLORES_TARJETA[i % COLORES_TARJETA.length];
}

export default function TpvTerminalPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [lineas, setLineas] = useState([]);
  const [mostrarCobro, setMostrarCobro] = useState(false);
  const [fondo, setFondo] = useState("100");
  const [abriendoCaja, setAbriendoCaja] = useState(false);

  const cargarEstado = useCallback(async () => {
    try {
      const r = await fetch("/api/tpv/estado");
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar TPV");
      setEstado(datos);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarEstado(); }, [cargarEstado]);

  const articulosFiltrados = useMemo(() => {
    if (!estado?.articulos) return [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return estado.articulos;
    return estado.articulos.filter(
      (a) =>
        a.descripcion.toLowerCase().includes(q) ||
        (a.codigo && a.codigo.toLowerCase().includes(q)) ||
        (a.codigoBarras && a.codigoBarras.includes(q))
    );
  }, [estado, busqueda]);

  const total = useMemo(
    () => lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0),
    [lineas]
  );

  function agregarArticulo(a) {
    setLineas((prev) => {
      const i = prev.findIndex((l) => l.articulo === a._id);
      if (i >= 0) {
        const copia = [...prev];
        copia[i] = { ...copia[i], cantidad: copia[i].cantidad + 1 };
        return copia;
      }
      return [
        ...prev,
        {
          articulo: a._id,
          descripcion: a.descripcion,
          cantidad: 1,
          precioUnitario: a.precioVenta,
          iva: a.iva ?? 21,
        },
      ];
    });
  }

  function cambiarCantidad(i, delta) {
    setLineas((prev) => {
      const copia = [...prev];
      copia[i] = { ...copia[i], cantidad: Math.max(1, copia[i].cantidad + delta) };
      return copia;
    });
  }

  function quitarLinea(i) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  function abrirCobro() {
    if (!lineas.length) return;
    window.__tpvLineas = lineas;
    setMostrarCobro(true);
  }

  async function abrirCaja() {
    setAbriendoCaja(true);
    setError(null);
    try {
      const r = await fetch("/api/tpv/caja/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fondo: Number(fondo) || 0 }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo abrir caja");
      await cargarEstado();
    } catch (e) {
      setError(e.message);
    } finally {
      setAbriendoCaja(false);
    }
  }

  function onCobrado(datos) {
    setMostrarCobro(false);
    setLineas([]);
    if (datos?.imprimirUrl) {
      const w = window.open(datos.imprimirUrl, "_blank", "width=400,height=600");
      if (w) w.focus();
    }
    cargarEstado();
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Cargando TPV…
      </div>
    );
  }

  if (error && !estado) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 p-6">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700"
        >
          Volver al panel
        </button>
      </div>
    );
  }

  const cajaAbierta = !!estado?.caja;

  if (!cajaAbierta) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200 p-6">
        <div className="w-full max-w-sm bg-slate-900 rounded-2xl p-6 border border-slate-700">
          <h1 className="text-2xl font-bold mb-2 text-center">TPV / Caja</h1>
          <p className="text-slate-400 text-center mb-6">
            No hay ninguna sesión de caja abierta. Introduce el fondo inicial para empezar a vender.
          </p>
          <label className="block text-sm text-slate-400 mb-2">Fondo de caja</label>
          <input
            type="number"
            step="0.01"
            value={fondo}
            onChange={(e) => setFondo(e.target.value)}
            className="w-full text-center text-2xl font-bold bg-slate-800 border border-slate-600 rounded-xl py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-sm text-red-400 mb-3 text-center">{error}</p>}
          <button
            onClick={abrirCaja}
            disabled={abriendoCaja}
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-xl font-bold transition"
          >
            {abriendoCaja ? "Abriendo…" : "Abrir caja"}
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-full mt-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            Volver al panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Cabecera */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Volver"
          >
            <IconCerrar />
          </button>
          <h1 className="text-lg font-bold">TPV</h1>
          <span className="text-sm text-slate-400">
            Caja abierta · {estado?.caja?.apertura?.usuario ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/tpv/tickets")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
          >
            <IconTicket /> Tickets
          </button>
          <button
            onClick={() => navigate("/tpv/caja")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
          >
            <IconCaja /> Caja
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Izquierda: artículos */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          <input
            type="text"
            placeholder="Buscar artículo o código…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full mb-3 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-lg placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 content-start">
            {articulosFiltrados.map((a, i) => (
              <button
                key={a._id}
                onClick={() => agregarArticulo(a)}
                className={`${colorPorIndice(i)} rounded-xl p-4 text-left shadow-lg transition active:scale-95`}
              >
                <p className="font-semibold text-white leading-tight line-clamp-2">{a.descripcion}</p>
                <p className="mt-2 text-xl font-extrabold text-white/95">{euros(a.precioVenta)}</p>
              </button>
            ))}
            {!articulosFiltrados.length && (
              <p className="col-span-full text-center text-slate-500 py-10">No hay artículos</p>
            )}
          </div>
        </div>

        {/* Derecha: ticket */}
        <div className="w-96 flex flex-col bg-slate-900 border-l border-slate-800">
          <div className="p-3 border-b border-slate-800">
            <h2 className="font-bold text-slate-300">Ticket actual</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {lineas.map((l, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-800 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{l.descripcion}</p>
                  <p className="text-sm text-slate-400">{euros(l.precioUnitario)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => cambiarCantidad(i, -1)}
                    className="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-xl font-bold"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-bold text-lg">{l.cantidad}</span>
                  <button
                    onClick={() => cambiarCantidad(i, 1)}
                    className="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-xl font-bold"
                  >
                    +
                  </button>
                </div>
                <p className="w-20 text-right font-bold">{euros(l.cantidad * l.precioUnitario)}</p>
                <button
                  onClick={() => quitarLinea(i)}
                  className="w-9 h-9 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/40"
                >
                  ×
                </button>
              </div>
            ))}
            {!lineas.length && (
              <p className="text-center text-slate-500 py-10">Toca un artículo para añadirlo</p>
            )}
          </div>
          <div className="p-4 border-t border-slate-800">
            <div className="flex justify-between items-end mb-4">
              <span className="text-slate-400">Total</span>
              <span className="text-4xl font-extrabold text-emerald-400">{euros(total)}</span>
            </div>
            <button
              onClick={abrirCobro}
              disabled={!lineas.length}
              className="w-full py-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-2xl font-extrabold tracking-wide transition"
            >
              COBRAR
            </button>
          </div>
        </div>
      </div>

      {mostrarCobro && (
        <CobroModal
          total={total}
          onCobrado={onCobrado}
          onCerrar={() => setMostrarCobro(false)}
        />
      )}
    </div>
  );
}
