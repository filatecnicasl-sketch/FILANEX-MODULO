import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import CobroModal from "./CobroModal.jsx";
import { cargarConfigHardware, imprimirTicketSegunConfig } from "../../lib/tpvHardware.js";
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
const COLORES_FAMILIA = [
  "bg-indigo-600", "bg-emerald-600", "bg-amber-600", "bg-sky-600",
  "bg-violet-600", "bg-rose-600", "bg-teal-600", "bg-orange-600",
];

const colorTarjeta = (i) => COLORES_TARJETA[i % COLORES_TARJETA.length];
const colorFamilia = (i) => COLORES_FAMILIA[i % COLORES_FAMILIA.length];

export default function TpvTerminalPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [familiaActiva, setFamiliaActiva] = useState("favoritos");
  const [lineas, setLineas] = useState([]);
  const [mostrarCobro, setMostrarCobro] = useState(false);
  const [fondo, setFondo] = useState("100");
  const [abriendoCaja, setAbriendoCaja] = useState(false);
  const [espera, setEspera] = useState([]);
  const [mostrarEspera, setMostrarEspera] = useState(false);
  const [descuentoTotal, setDescuentoTotal] = useState(0);
  const cfgHw = cargarConfigHardware();

  // Pitido corto al añadir (feedback táctil/sonoro del escáner o el toque).
  const pitido = useCallback((frecuencia = 880, duracion = 0.07) => {
    if (!cargarConfigHardware().escaner.sonido) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.frequency.value = frecuencia;
      osc.type = "sine";
      vol.gain.value = 0.08;
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duracion);
      osc.onended = () => ctx.close();
    } catch { /* sin audio disponible */ }
  }, []);

  const cargarEstado = useCallback(async () => {
    try {
      const [rEstado, rEspera] = await Promise.all([
        fetch("/api/tpv/estado"),
        fetch("/api/tpv/espera"),
      ]);
      const datos = await rEstado.json();
      if (!rEstado.ok) throw new Error(datos.error || "Error al cargar TPV");
      setEstado(datos);
      setEspera(rEspera.ok ? await rEspera.json() : []);
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
    let lista = estado.articulos;
    if (q) {
      return lista.filter(
        (a) =>
          a.descripcion.toLowerCase().includes(q) ||
          (a.codigo && a.codigo.toLowerCase().includes(q)) ||
          (a.codigoBarras && a.codigoBarras.includes(q))
      );
    }
    if (familiaActiva === "favoritos") {
      const fav = new Set((estado.favoritos ?? []).map(String));
      const enFav = lista.filter((a) => fav.has(String(a._id)));
      return enFav.length ? enFav : lista;
    }
    if (familiaActiva === "todos") return lista;
    if (familiaActiva === "sin") return lista.filter((a) => !a.familia);
    return lista.filter((a) => a.familia === familiaActiva);
  }, [estado, busqueda, familiaActiva]);

  const total = useMemo(
    () =>
      lineas.reduce(
        (acc, l) =>
          acc +
          l.cantidad * l.precioUnitario * (1 - (l.descuento ?? 0) / 100) * (1 + l.iva / 100),
        0
      ),
    [lineas]
  );

  function agregarArticulo(a) {
    pitido();
    setLineas((prev) => {
      const i = prev.findIndex((l) => l.articulo === a._id && (l.descuento ?? 0) === 0);
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
          descuento: 0,
        },
      ];
    });
  }

  function onEnterBusqueda(e) {
    if (e.key !== "Enter") return;
    const q = busqueda.trim().toLowerCase();
    if (!q) return;
    // Escáner de código de barras: coincidencia exacta → añade directo.
    const exacto = estado?.articulos?.find(
      (a) =>
        (a.codigoBarras && a.codigoBarras.toLowerCase() === q) ||
        (a.codigo && a.codigo.toLowerCase() === q)
    );
    const destino = exacto ?? (articulosFiltrados.length === 1 ? articulosFiltrados[0] : null);
    if (destino) {
      agregarArticulo(destino);
      setBusqueda("");
    } else {
      pitido(220, 0.12); // tono grave: no encontrado
    }
  }

  async function reimprimirUltimo() {
    try {
      const r = await fetch("/api/tpv/tickets");
      const lista = await r.json();
      if (!r.ok) throw new Error(lista.error || "Error al buscar tickets");
      const ultimo = lista?.find((t) => t.total >= 0);
      if (!ultimo) {
        setError("Todavía no hay tickets para reimprimir");
        return;
      }
      window.open(`/api/tpv/tickets/${ultimo._id}/imprimir`, "_blank", "width=400,height=600");
    } catch (e) {
      setError(e.message);
    }
  }

  function cambiarCantidad(i, delta) {
    setLineas((prev) => {
      const copia = [...prev];
      copia[i] = { ...copia[i], cantidad: Math.max(1, copia[i].cantidad + delta) };
      return copia;
    });
  }

  function cambiarDescuento(i, valor) {
    setLineas((prev) => {
      const copia = [...prev];
      copia[i] = { ...copia[i], descuento: Math.min(100, Math.max(0, valor)) };
      return copia;
    });
  }

  function aplicarDescuentoTotal(pct) {
    const d = Math.min(100, Math.max(0, pct));
    setDescuentoTotal(d);
    setLineas((prev) => prev.map((l) => ({ ...l, descuento: d })));
  }

  function quitarLinea(i) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  function abrirCobro() {
    if (!lineas.length) return;
    window.__tpvLineas = lineas;
    setMostrarCobro(true);
  }

  async function aparcarTicket() {
    if (!lineas.length) return;
    const nombre = window.prompt("Referencia del ticket en espera (opcional):", "");
    if (nombre === null) return;
    try {
      const r = await fetch("/api/tpv/espera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, lineas }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo aparcar");
      setLineas([]);
      setDescuentoTotal(0);
      await cargarEstado();
    } catch (e) {
      setError(e.message);
    }
  }

  async function recuperarTicket(t) {
    setLineas(t.lineas.map((l) => ({ ...l })));
    setDescuentoTotal(0);
    setMostrarEspera(false);
    await fetch(`/api/tpv/espera/${t._id}`, { method: "DELETE" });
    setEspera((prev) => prev.filter((x) => x._id !== t._id));
  }

  async function borrarEspera(t) {
    await fetch(`/api/tpv/espera/${t._id}`, { method: "DELETE" });
    setEspera((prev) => prev.filter((x) => x._id !== t._id));
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
    setDescuentoTotal(0);
    if (datos?.imprimirUrl && cfgHw.impresion.autoImprimir) {
      if (datos.conRegalo && cfgHw.impresion.modo !== "escpos") {
        // Navegador: ticket y regalo salen juntos en la misma impresión.
        const w = window.open(`${datos.imprimirUrl}&copiaRegalo=1`, "_blank", "width=400,height=600");
        if (w) w.focus();
      } else {
        imprimirTicketSegunConfig(cfgHw, {
          ticket: datos.ticket,
          empresa: estado?.empresa,
          imprimirUrl: datos.imprimirUrl,
        });
        if (datos.conRegalo) {
          imprimirTicketSegunConfig(cfgHw, {
            ticket: datos.ticket,
            empresa: estado?.empresa,
            imprimirUrl: datos.imprimirUrl,
            regalo: true,
          });
        }
      }
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

  const pestañas = [
    { id: "favoritos", etiqueta: "★ Favoritos" },
    { id: "todos", etiqueta: "Todos" },
    ...(estado?.familias ?? []).map((f) => ({ id: f, etiqueta: f })),
    ...(estado?.articulos?.some((a) => !a.familia) ? [{ id: "sin", etiqueta: "Sin familia" }] : []),
  ];

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
            onClick={reimprimirUltimo}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
            title="Reimprimir el último ticket"
          >
            Reimprimir
          </button>
          <button
            onClick={() => setMostrarEspera(true)}
            className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
          >
            En espera
            {espera.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center">
                {espera.length}
              </span>
            )}
          </button>
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
            onKeyDown={onEnterBusqueda}
            className="w-full mb-2 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-lg placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {/* Pestañas de familias */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {pestañas.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setFamiliaActiva(p.id)}
                className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition ${
                  familiaActiva === p.id
                    ? `${colorFamilia(i)} text-white shadow-lg`
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 content-start">
            {articulosFiltrados.map((a, i) => (
              <button
                key={a._id}
                onClick={() => agregarArticulo(a)}
                className={`${colorTarjeta(i)} rounded-xl p-4 text-left shadow-lg transition active:scale-95`}
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
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-slate-300">Ticket actual</h2>
            {lineas.length > 0 && (
              <button
                onClick={aparcarTicket}
                className="px-3 py-1.5 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 text-sm font-semibold"
              >
                Aparcar
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {lineas.map((l, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{l.descripcion}</p>
                    <p className="text-sm text-slate-400">
                      {euros(l.precioUnitario)}
                      {l.descuento > 0 && (
                        <span className="ml-2 text-amber-400 font-semibold">−{l.descuento}%</span>
                      )}
                    </p>
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
                  <p className="w-20 text-right font-bold">
                    {euros(l.cantidad * l.precioUnitario * (1 - (l.descuento ?? 0) / 100) * (1 + l.iva / 100))}
                  </p>
                  <button
                    onClick={() => quitarLinea(i)}
                    className="w-9 h-9 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/40"
                  >
                    ×
                  </button>
                </div>
                {/* Descuento por línea */}
                <div className="flex gap-1 mt-2">
                  {[0, 5, 10, 20].map((d) => (
                    <button
                      key={d}
                      onClick={() => cambiarDescuento(i, d)}
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        (l.descuento ?? 0) === d
                          ? "bg-amber-500 text-slate-900"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      {d === 0 ? "Sin dto" : `−${d}%`}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {!lineas.length && (
              <p className="text-center text-slate-500 py-10">Toca un artículo para añadirlo</p>
            )}
          </div>
          <div className="p-4 border-t border-slate-800">
            {/* Descuento sobre el total */}
            {lineas.length > 0 && (
              <div className="flex gap-2 mb-3">
                <span className="text-sm text-slate-400 self-center">Dto. ticket:</span>
                {[0, 5, 10, 20].map((d) => (
                  <button
                    key={d}
                    onClick={() => aplicarDescuentoTotal(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold ${
                      descuentoTotal === d
                        ? "bg-amber-500 text-slate-900"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {d === 0 ? "Quitar" : `−${d}%`}
                  </button>
                ))}
              </div>
            )}
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

      {/* Tickets en espera */}
      {mostrarEspera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Tickets en espera</h3>
              <button onClick={() => setMostrarEspera(false)} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            {!espera.length ? (
              <p className="text-slate-500 text-center py-6">No hay tickets aparcados.</p>
            ) : (
              <div className="space-y-2">
                {espera.map((t) => (
                  <div key={t._id} className="flex items-center gap-3 bg-slate-800 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {t.nombre || `Ticket ${new Date(t.fecha).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`}
                      </p>
                      <p className="text-sm text-slate-400">
                        {t.lineas.length} líneas ·{" "}
                        {euros(t.lineas.reduce((a, l) => a + l.cantidad * l.precioUnitario * (1 + l.iva / 100), 0))}
                      </p>
                    </div>
                    <button
                      onClick={() => recuperarTicket(t)}
                      className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-bold"
                    >
                      Recuperar
                    </button>
                    <button
                      onClick={() => borrarEspera(t)}
                      className="px-3 py-2 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 text-sm"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
