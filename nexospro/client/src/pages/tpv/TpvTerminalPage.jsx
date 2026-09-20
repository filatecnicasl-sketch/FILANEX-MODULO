import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import CobroModal from "./CobroModal.jsx";
import { cargarConfigHardware, imprimirTicketSegunConfig, abrirCajon } from "../../lib/tpvHardware.js";
import { euros } from "../../components/ui.jsx";
import {
  IconTicket,
  IconCaja,
  IconAyuda,
  IconImprimir,
  IconBorrar,
} from "../../components/icons.jsx";

// Colores por defecto para las familias que no tengan uno configurado.
const PALETA = [
  "#6366f1", "#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6", "#f43f5e",
  "#14b8a6", "#f97316", "#84cc16", "#06b6d4", "#d946ef", "#ec4899",
];

function urlImagen(ruta) {
  if (!ruta) return null;
  if (ruta.startsWith("http")) return ruta;
  return ruta.startsWith("/") ? ruta : `/uploads/${ruta}`;
}

function iniciales(texto) {
  return texto
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

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
  const [lineaSeleccionada, setLineaSeleccionada] = useState(null);
  const [bufferTeclado, setBufferTeclado] = useState("1");
  const [modoTeclado, setModoTeclado] = useState("preseleccion");
  const [modalMovimiento, setModalMovimiento] = useState(false);
  const [modalResumen, setModalResumen] = useState(false);
  const [resumen, setResumen] = useState(null);
  const cfgHw = cargarConfigHardware();

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
    } catch { /* sin audio */ }
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

  // Color de una familia: el configurado en FamiliaTpv o uno de la paleta.
  const colorDeFamilia = useCallback(
    (familia) => {
      if (!familia) return "#94a3b8";
      const cfg = estado?.familiasTpv?.find((f) => f.nombre === familia);
      if (cfg?.color) return cfg.color;
      const idx = (estado?.familias ?? []).indexOf(familia);
      return PALETA[(idx >= 0 ? idx : 0) % PALETA.length];
    },
    [estado]
  );

  const categorias = useMemo(() => {
    const configuradas = (estado?.familiasTpv ?? []).map((f) => f.nombre);
    const deArticulos = (estado?.familias ?? []).filter((f) => !configuradas.includes(f));
    return [
      { id: "favoritos", nombre: "Favoritos", icono: "★", color: "#eab308" },
      { id: "todos", nombre: "Todas", icono: "⊞", color: "#475569" },
      ...(estado?.familiasTpv ?? []).map((f) => ({ id: f.nombre, ...f, icono: null })),
      ...deArticulos.map((f) => ({ id: f, nombre: f, color: colorDeFamilia(f), icono: null })),
    ];
  }, [estado, colorDeFamilia]);

  const articulosFiltrados = useMemo(() => {
    if (!estado?.articulos) return [];
    const q = busqueda.trim().toLowerCase();
    const lista = estado.articulos;
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
      return enFav.length ? enFav : lista.slice(0, 24);
    }
    if (familiaActiva === "todos") return lista;
    return lista.filter((a) => a.familia === familiaActiva);
  }, [estado, busqueda, familiaActiva]);

  const cantidadesPorArticulo = useMemo(() => {
    const map = new Map();
    for (const l of lineas) {
      map.set(String(l.articulo), (map.get(String(l.articulo)) || 0) + l.cantidad);
    }
    return map;
  }, [lineas]);

  const totales = useMemo(() => {
    const bruto = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0);
    const descuento = lineas.reduce(
      (acc, l) => acc + l.cantidad * l.precioUnitario * ((l.descuento ?? 0) / 100),
      0
    );
    const base = lineas.reduce(
      (acc, l) => acc + l.cantidad * l.precioUnitario * (1 - (l.descuento ?? 0) / 100),
      0
    );
    const iva = lineas.reduce(
      (acc, l) =>
        acc +
        l.cantidad * l.precioUnitario * (1 - (l.descuento ?? 0) / 100) * (l.iva / 100),
      0
    );
    return { bruto, descuento, base, iva, total: base + iva };
  }, [lineas]);

  function setCantidadLinea(idx, cantidad) {
    const c = Math.max(1, Number(cantidad) || 1);
    setLineas((prev) => {
      const copia = [...prev];
      copia[idx] = { ...copia[idx], cantidad: c };
      return copia;
    });
  }

  function agregarArticulo(a) {
    pitido();
    const cantidad = modoTeclado === "preseleccion" ? Math.max(1, Number(bufferTeclado) || 1) : 1;
    setLineas((prev) => {
      const i = prev.findIndex((l) => l.articulo === a._id && (l.descuento ?? 0) === 0);
      if (i >= 0) {
        const copia = [...prev];
        copia[i] = { ...copia[i], cantidad: copia[i].cantidad + cantidad };
        return copia;
      }
      return [
        ...prev,
        {
          articulo: a._id,
          descripcion: a.descripcion,
          cantidad,
          precioUnitario: a.precioVenta,
          iva: a.iva ?? 21,
          descuento: 0,
        },
      ];
    });
    if (modoTeclado === "preseleccion") setBufferTeclado("1");
  }

  function onEnterBusqueda(e) {
    if (e.key !== "Enter") return;
    const q = busqueda.trim().toLowerCase();
    if (!q) return;
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
      pitido(220, 0.12);
    }
  }

  function seleccionarLinea(idx) {
    setLineaSeleccionada(idx);
    setModoTeclado("linea");
    setBufferTeclado(String(lineas[idx]?.cantidad ?? 1));
  }

  function tecla(k) {
    if (k === "*") {
      setBufferTeclado("1");
      if (modoTeclado === "linea") setCantidadLinea(lineaSeleccionada, 1);
      return;
    }
    if (k === "%") {
      if (lineaSeleccionada === null) return;
      const actual = lineas[lineaSeleccionada]?.descuento ?? 0;
      const siguiente = actual === 0 ? 5 : actual === 5 ? 10 : actual === 10 ? 20 : 0;
      cambiarDescuento(lineaSeleccionada, siguiente);
      return;
    }
    if (k === "-") {
      if (lineaSeleccionada !== null) cambiarCantidad(lineaSeleccionada, -1);
      return;
    }
    if (k === "Del") {
      setBufferTeclado((prev) => (prev.length > 1 ? prev.slice(0, -1) : "1"));
      return;
    }
    if (k === ".") {
      setBufferTeclado((prev) => (prev.includes(".") ? prev : prev + "."));
      return;
    }
    if (k === "Enter") {
      if (modoTeclado === "linea") {
        setModoTeclado("preseleccion");
        setLineaSeleccionada(null);
        setBufferTeclado("1");
      } else {
        abrirCobro();
      }
      return;
    }
    setBufferTeclado((prev) => (prev === "0" || prev === "1" ? k : prev + k));
  }

  useEffect(() => {
    if (modoTeclado === "linea" && lineaSeleccionada !== null) {
      setCantidadLinea(lineaSeleccionada, bufferTeclado);
    }
  }, [bufferTeclado, modoTeclado, lineaSeleccionada]);

  function cambiarCantidad(i, delta) {
    setLineas((prev) => {
      const copia = [...prev];
      copia[i] = { ...copia[i], cantidad: Math.max(1, copia[i].cantidad + delta) };
      return copia;
    });
    if (lineaSeleccionada === i) setBufferTeclado(String(Math.max(1, lineas[i].cantidad + delta)));
  }

  function cambiarDescuento(i, valor) {
    setLineas((prev) => {
      const copia = [...prev];
      copia[i] = { ...copia[i], descuento: Math.min(100, Math.max(0, valor)) };
      return copia;
    });
  }

  function quitarLinea(i) {
    if (i === null) return;
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
    if (lineaSeleccionada === i) {
      setLineaSeleccionada(null);
      setModoTeclado("preseleccion");
      setBufferTeclado("1");
    }
  }

  function vaciarTicket() {
    setLineas([]);
    setLineaSeleccionada(null);
    setModoTeclado("preseleccion");
    setBufferTeclado("1");
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
      vaciarTicket();
      await cargarEstado();
    } catch (e) {
      setError(e.message);
    }
  }

  async function recuperarTicket(t) {
    setLineas(t.lineas.map((l) => ({ ...l })));
    setLineaSeleccionada(null);
    setModoTeclado("preseleccion");
    setBufferTeclado("1");
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

  async function ultimoTicket() {
    const r = await fetch("/api/tpv/tickets");
    const lista = await r.json();
    if (!r.ok) throw new Error(lista.error || "Error al buscar tickets");
    const ultimo = lista?.find((t) => t.total >= 0);
    if (!ultimo) throw new Error("Todavía no hay tickets");
    return ultimo;
  }

  async function reimprimirUltimo() {
    try {
      const ultimo = await ultimoTicket();
      window.open(`/api/tpv/tickets/${ultimo._id}/imprimir`, "_blank", "width=400,height=600");
    } catch (e) {
      setError(e.message);
    }
  }

  async function imprimirTicketRegalo() {
    try {
      const ultimo = await ultimoTicket();
      window.open(`/api/tpv/tickets/${ultimo._id}/imprimir?regalo=1`, "_blank", "width=400,height=600");
    } catch (e) {
      setError(e.message);
    }
  }

  async function emailUltimoTicket() {
    const destino = window.prompt("Correo del cliente (dejar vacío para usar el de la empresa):", "");
    if (destino === null) return;
    try {
      const r = await fetch("/api/tpv/tickets/ultimo/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: destino }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo enviar");
      setError(null);
      window.alert(`Ticket enviado a ${datos.para}`);
    } catch (e) {
      setError(e.message);
    }
  }

  function imprimirProforma() {
    if (!lineas.length) return;
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleString("es-ES");
    const filas = lineas
      .map((l) => {
        const totalLinea = l.cantidad * l.precioUnitario * (1 - (l.descuento ?? 0) / 100) * (1 + l.iva / 100);
        return `<tr><td>${esc(l.descripcion)}</td><td class="num">${l.cantidad}</td><td class="num">${euros(l.precioUnitario)}</td><td class="num">${euros(totalLinea)}</td></tr>`;
      })
      .join("");
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Proforma</title>
<style>@page{size:80mm auto;margin:0}body{width:72mm;margin:4mm auto;font-family:'Courier New',monospace;font-size:11px;color:#000}.centro{text-align:center}.sep{border-top:1px dashed #000;margin:6px 0}table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top}.num{text-align:right;white-space:nowrap}.total{font-size:14px;font-weight:bold}@media print{.noprint{display:none}}</style></head><body>
<button class="noprint" onclick="window.print()" style="width:100%;padding:8px;font-size:14px;margin-bottom:8px;">Imprimir proforma</button>
<div class="centro"><strong>PROFORMA</strong><br>${fecha}</div>
<div class="sep"></div>
<table>${filas}</table>
<div class="sep"></div>
<div class="num">Base: ${euros(totales.base)}<br>IVA: ${euros(totales.iva)}<br><span class="total">TOTAL: ${euros(totales.total)}</span></div>
<div class="sep"></div>
<div class="centro">Proforma sin valor fiscal</div>
</body></html>`;
    const w = window.open("", "_blank", "width=400,height=600");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  async function abrirCajonTpv() {
    try {
      await abrirCajon();
    } catch (e) {
      setError(e.message);
    }
  }

  async function cargarResumen() {
    try {
      const r = await fetch("/api/tpv/resumen");
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar resumen");
      setResumen(datos);
      setModalResumen(true);
    } catch (e) {
      setError(e.message);
    }
  }

  async function guardarMovimiento(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const tipo = fd.get("tipo");
    const importe = Number(fd.get("importe"));
    const concepto = fd.get("concepto");
    if (!(importe > 0)) return;
    try {
      const r = await fetch("/api/tpv/caja/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, importe, concepto }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo guardar");
      setModalMovimiento(false);
      await cargarEstado();
    } catch (err) {
      setError(err.message);
    }
  }

  function onCobrado(datos) {
    setMostrarCobro(false);
    vaciarTicket();
    if (datos?.imprimirUrl && cfgHw.impresion.autoImprimir) {
      if (datos.conRegalo && cfgHw.impresion.modo !== "escpos") {
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
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">
        Cargando TPV…
      </div>
    );
  }

  if (error && !estado) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center text-slate-700 p-6">
        <p className="text-rose-600 mb-4">{error}</p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700"
        >
          Volver al panel
        </button>
      </div>
    );
  }

  const cajaAbierta = !!estado?.caja;

  if (!cajaAbierta) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center text-slate-800 p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl p-6 border border-slate-200 shadow-lg">
          <h1 className="text-2xl font-bold mb-2 text-center">TPV / Caja</h1>
          <p className="text-slate-500 text-center mb-6">
            No hay ninguna sesión de caja abierta. Introduce el fondo inicial para empezar a vender.
          </p>
          <label className="block text-sm text-slate-500 mb-2">Fondo de caja</label>
          <input
            type="number"
            step="0.01"
            value={fondo}
            onChange={(e) => setFondo(e.target.value)}
            className="w-full text-center text-2xl font-bold bg-slate-50 border border-slate-300 rounded-xl py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
          {error && <p className="text-sm text-rose-600 mb-3 text-center">{error}</p>}
          <button
            onClick={abrirCaja}
            disabled={abriendoCaja}
            className="w-full py-4 rounded-xl bg-neutral-900 hover:bg-neutral-700 disabled:bg-slate-300 text-white text-xl font-bold transition"
          >
            {abriendoCaja ? "Abriendo…" : "Abrir caja"}
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-full mt-3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
          >
            Volver al panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-800 select-none overflow-hidden">
      {/* Barra superior negra */}
      <header className="flex items-center gap-3 px-3 h-14 bg-neutral-900 text-white shrink-0">
        <button
          onClick={() => navigate("/")}
          className="text-2xl px-2 hover:bg-white/10 rounded"
          title="Menú principal"
        >
          ☰
        </button>
        <h1 className="text-lg font-bold tracking-wide">Venta</h1>
        <div className="flex-1 max-w-xl mx-auto">
          <input
            type="text"
            placeholder="Buscar artículo o escanear código…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={onEnterBusqueda}
            className="w-full px-4 py-1.5 rounded-lg bg-white text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 px-3 py-2 rounded hover:bg-white/10 text-sm font-semibold"
          >
            ↩ VOLVER
          </button>
          <button
            onClick={() => setMostrarEspera(true)}
            className="relative px-3 py-2 rounded hover:bg-white/10"
            title="Tickets en espera"
          >
            <IconTicket />
            {espera.length > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {espera.length}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate("/tpv/tickets")}
            className="px-3 py-2 rounded hover:bg-white/10"
            title="Tickets"
          >
            <IconImprimir />
          </button>
          <button
            onClick={() => navigate("/tpv/caja")}
            className="px-3 py-2 rounded hover:bg-white/10"
            title="Caja"
          >
            <IconCaja />
          </button>
          <button
            onClick={() => navigate("/ayuda/tpv")}
            className="flex items-center gap-1 px-3 py-2 rounded hover:bg-white/10 text-sm font-semibold"
          >
            <IconAyuda /> AYUDA
          </button>
        </div>
      </header>

      {/* Cuerpo */}
      <div className="flex-1 flex overflow-hidden">
        {/* Categorías */}
        <aside className="w-36 sm:w-44 bg-white border-r border-slate-200 overflow-y-auto shrink-0">
          {categorias.map((c) => {
            const activa = familiaActiva === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setFamiliaActiva(c.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-3 border-b border-slate-100 border-l-4 transition ${
                  activa
                    ? "bg-slate-100 font-bold"
                    : "text-slate-600 hover:bg-slate-50 border-l-transparent"
                }`}
                style={activa ? { borderLeftColor: c.color } : undefined}
              >
                <span className="text-sm text-left leading-tight">{c.nombre}</span>
                <span
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shrink-0 overflow-hidden"
                  style={{ backgroundColor: c.color }}
                >
                  {c.imagen ? (
                    <img
                      src={urlImagen(c.imagen)}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : (
                    c.icono || iniciales(c.nombre)
                  )}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Rejilla de productos */}
        <main className="flex-1 overflow-y-auto p-4 min-w-0 bg-white">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-3 gap-y-5 content-start">
            {articulosFiltrados.map((a) => {
              const img = urlImagen(a.imagen);
              const cantidad = cantidadesPorArticulo.get(String(a._id)) || 0;
              const color = colorDeFamilia(a.familia);
              return (
                <button
                  key={a._id}
                  onClick={() => agregarArticulo(a)}
                  className="group flex flex-col items-center transition active:scale-95"
                >
                  <div
                    className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-b-4 bg-slate-50 overflow-hidden shadow group-hover:shadow-lg transition"
                    style={{ borderBottomColor: color }}
                  >
                    {img ? (
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <span
                        className="w-full h-full flex items-center justify-center text-2xl font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {iniciales(a.descripcion)}
                      </span>
                    )}
                    <span className="absolute top-1 right-1 bg-emerald-500 text-white text-xs font-bold rounded-full px-2 py-0.5 shadow">
                      {euros(a.precioVenta)}
                    </span>
                    {cantidad > 0 && (
                      <span className="absolute top-1 left-1 bg-rose-500 text-white text-xs font-bold rounded px-1.5 py-0.5 shadow">
                        +{cantidad}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-center leading-tight text-slate-700 line-clamp-2">
                    {a.descripcion}
                  </p>
                </button>
              );
            })}
            {!articulosFiltrados.length && (
              <p className="col-span-full text-center text-slate-400 py-10">No hay artículos</p>
            )}
          </div>
        </main>

        {/* Ticket + teclado */}
        <aside className="w-[360px] lg:w-[400px] flex flex-col bg-slate-50 border-l border-slate-200 shrink-0">
          {/* Cabecera del ticket */}
          <div className="bg-white border-b-2 border-rose-300 px-4 py-3 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-neutral-800 text-white flex items-center justify-center text-lg">
                  👤
                </span>
                <div>
                  <span className="inline-block bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-bold rounded px-2 py-0.5">
                    VENTA NORMAL
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    {modoTeclado === "linea" ? `Cantidad: ${bufferTeclado}` : `Siguiente cantidad: ${bufferTeclado}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Ticket actual</p>
                <p className="text-xs text-slate-400">
                  {new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "medium" })}
                </p>
                <p className="text-3xl font-extrabold text-slate-900">{euros(totales.total)}</p>
              </div>
            </div>
          </div>

          {/* Líneas */}
          <div className="flex-1 overflow-y-auto bg-white min-h-0">
            {lineas.map((l, i) => {
              const totalLinea = l.cantidad * l.precioUnitario * (1 - (l.descuento ?? 0) / 100) * (1 + l.iva / 100);
              const seleccionada = lineaSeleccionada === i;
              return (
                <div
                  key={i}
                  onClick={() => seleccionarLinea(i)}
                  className={`flex items-center justify-between gap-3 px-4 py-3 border-b-2 cursor-pointer transition ${
                    seleccionada ? "bg-indigo-50 border-indigo-400" : "border-rose-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">
                      {l.cantidad} ud. x {euros(l.precioUnitario)}
                      {l.descuento > 0 && <span className="ml-1 text-rose-500 font-bold">−{l.descuento}%</span>}
                    </p>
                    <p className="font-bold text-slate-800 truncate">{l.descripcion}</p>
                  </div>
                  <p className="text-xl font-bold text-slate-900 whitespace-nowrap">{euros(totalLinea)}</p>
                </div>
              );
            })}
            {!lineas.length && (
              <p className="text-center text-slate-400 py-10">Toca un artículo para añadirlo</p>
            )}
          </div>

          {/* Totales */}
          <div className="grid grid-cols-4 bg-white border-t border-slate-200 text-center shrink-0">
            <div className="py-2 border-r border-slate-100">
              <p className="text-[11px] text-slate-400">Total bruto:</p>
              <p className="font-bold text-slate-700">{euros(totales.bruto)}</p>
            </div>
            <div className="py-2 border-r border-slate-100">
              <p className="text-[11px] text-slate-400">Total base:</p>
              <p className="font-bold text-slate-700">{euros(totales.base)}</p>
            </div>
            <div className="py-2 border-r border-slate-100">
              <p className="text-[11px] text-slate-400">Impuestos:</p>
              <p className="font-bold text-slate-700">{euros(totales.iva)}</p>
            </div>
            <div className="py-2">
              <p className="text-[11px] text-slate-400">Total dto:</p>
              <p className="font-bold text-slate-700">{euros(totales.descuento)}</p>
            </div>
          </div>

          {/* Teclado + columna de acciones */}
          <div className="flex bg-slate-100 p-1 gap-1 shrink-0">
            <div className="flex-1 grid grid-cols-4 gap-1">
              {["7", "8", "9", "*", "4", "5", "6", "%", "1", "2", "3", "-", "0", ".", "Del", "Enter"].map((k) => (
                <button
                  key={k}
                  onClick={() => tecla(k)}
                  className={`py-4 rounded font-bold text-xl transition active:scale-95 ${
                    k === "Enter"
                      ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                      : k === "Del"
                        ? "bg-rose-100 hover:bg-rose-200 text-rose-600"
                        : "bg-slate-300 hover:bg-slate-400 text-slate-800"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="w-14 flex flex-col gap-1">
              <button
                onClick={() => setMostrarEspera(true)}
                className="flex-1 rounded bg-sky-500 hover:bg-sky-400 text-white text-xl"
                title="Tickets en espera"
              >
                ⤓
              </button>
              <button
                onClick={aparcarTicket}
                disabled={!lineas.length}
                className="flex-1 rounded bg-cyan-500 hover:bg-cyan-400 text-white text-xl disabled:opacity-40"
                title="Aparcar ticket"
              >
                ⤴
              </button>
              <button
                onClick={() => quitarLinea(lineaSeleccionada)}
                disabled={lineaSeleccionada === null}
                className="flex-1 rounded bg-rose-500 hover:bg-rose-400 text-white disabled:opacity-40 flex items-center justify-center"
                title="Vaciar línea"
              >
                <IconBorrar />
              </button>
              <button
                onClick={vaciarTicket}
                disabled={!lineas.length}
                className="flex-1 rounded bg-neutral-700 hover:bg-neutral-600 text-white text-xl disabled:opacity-40"
                title="Borrar ticket"
              >
                ✕
              </button>
              <button
                onClick={abrirCobro}
                disabled={!lineas.length}
                className="flex-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-2xl disabled:opacity-40"
                title="Cobrar"
              >
                €
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Barra inferior de acciones */}
      <footer className="grid grid-cols-7 bg-white border-t border-slate-200 shrink-0">
        <button
          onClick={() => setModalMovimiento(true)}
          className="py-3 text-sm font-bold uppercase text-slate-600 hover:bg-slate-50 border-b-4 border-sky-500"
        >
          Movim. caja
        </button>
        <button
          onClick={cargarResumen}
          className="py-3 text-sm font-bold uppercase text-slate-600 hover:bg-slate-50 border-b-4 border-neutral-700"
        >
          Informe usuario
        </button>
        <button
          onClick={imprimirProforma}
          disabled={!lineas.length}
          className="py-3 text-sm font-bold uppercase text-slate-600 hover:bg-slate-50 border-b-4 border-amber-400 disabled:opacity-40"
        >
          Imprime proforma
        </button>
        <button
          onClick={imprimirTicketRegalo}
          className="py-3 text-sm font-bold uppercase text-slate-600 hover:bg-slate-50 border-b-4 border-orange-400"
        >
          Ticket regalo
        </button>
        <button
          onClick={reimprimirUltimo}
          className="py-3 text-sm font-bold uppercase text-slate-600 hover:bg-slate-50 border-b-4 border-yellow-400"
        >
          Copia últ.ticket
        </button>
        <button
          onClick={emailUltimoTicket}
          className="py-3 text-sm font-bold uppercase text-slate-600 hover:bg-slate-50 border-b-4 border-neutral-500"
        >
          Email últ.ticket
        </button>
        <button
          onClick={abrirCajonTpv}
          className="py-3 text-sm font-bold uppercase text-slate-600 hover:bg-slate-50 border-b-4 border-sky-600"
        >
          Abrir cajón
        </button>
      </footer>

      {error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-rose-600 text-white shadow-lg text-sm">
          {error}
        </div>
      )}

      {/* Tickets en espera */}
      {mostrarEspera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Tickets en espera</h3>
              <button onClick={() => setMostrarEspera(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            {!espera.length ? (
              <p className="text-slate-400 text-center py-6">No hay tickets aparcados.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {espera.map((t) => (
                  <div key={t._id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">
                        {t.nombre || `Ticket ${new Date(t.fecha).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`}
                      </p>
                      <p className="text-sm text-slate-500">
                        {t.lineas.length} líneas ·{" "}
                        {euros(t.lineas.reduce((a, l) => a + l.cantidad * l.precioUnitario * (1 + l.iva / 100), 0))}
                      </p>
                    </div>
                    <button
                      onClick={() => recuperarTicket(t)}
                      className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
                    >
                      Recuperar
                    </button>
                    <button
                      onClick={() => borrarEspera(t)}
                      className="px-3 py-2 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200 text-sm"
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

      {/* Movimiento de caja */}
      {modalMovimiento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={guardarMovimiento}
            className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Movimiento de caja</h3>
              <button type="button" onClick={() => setModalMovimiento(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-500 mb-1">Tipo</label>
                <select name="tipo" className="input w-full">
                  <option value="entrada">Entrada de efectivo</option>
                  <option value="salida">Salida de efectivo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Importe</label>
                <input name="importe" type="number" step="0.01" min="0.01" required className="input w-full" />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Concepto</label>
                <input name="concepto" type="text" required className="input w-full" />
              </div>
              <button type="submit" className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-700 text-white font-bold">
                Guardar movimiento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resumen de usuario */}
      {modalResumen && resumen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Resumen del día</h3>
              <button onClick={() => setModalResumen(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <p>Fecha: <span className="font-semibold">{resumen.fecha}</span></p>
              <p>Tickets: {resumen.numeroTickets} · Devoluciones: {resumen.numeroDevoluciones}</p>
              <p>Ventas: {euros(resumen.ventas)} · Devoluciones: {euros(resumen.devoluciones)}</p>
              <p className="text-lg font-bold text-emerald-600">Total: {euros(resumen.total)}</p>
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-slate-400 mb-1">Por método de pago</p>
                {Object.entries(resumen.porMetodo).map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span className="capitalize">{k}</span><span>{euros(v)}</span></div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-slate-400 mb-1">Top artículos</p>
                {resumen.topArticulos.slice(0, 5).map((a) => (
                  <div key={a.descripcion} className="flex justify-between"><span className="truncate pr-2">{a.descripcion}</span><span>{a.cantidad}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarCobro && (
        <CobroModal
          total={totales.total}
          onCobrado={onCobrado}
          onCerrar={() => setMostrarCobro(false)}
        />
      )}
    </div>
  );
}
