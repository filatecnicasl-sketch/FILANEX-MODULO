import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import CobroModal from "./CobroModal.jsx";
import { cargarConfigHardware, imprimirTicketSegunConfig, abrirCajon } from "../../lib/tpvHardware.js";
import { euros } from "../../components/ui.jsx";
import {
  IconTicket,
  IconCaja,
  IconCerrar,
  IconAyuda,
  IconImprimir,
  IconCorreo,
  IconBorrar,
} from "../../components/icons.jsx";

const COLORES_FAMILIA = [
  "bg-indigo-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-sky-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-teal-600",
  "bg-orange-600",
  "bg-lime-600",
  "bg-cyan-600",
  "bg-fuchsia-600",
  "bg-pink-600",
];

const colorFamilia = (i) => COLORES_FAMILIA[i % COLORES_FAMILIA.length];

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

  const categorias = useMemo(() => {
    const configuradas = (estado?.familiasTpv ?? []).map((f) => f.nombre);
    const deArticulos = (estado?.familias ?? []).filter((f) => !configuradas.includes(f));
    return [
      { id: "favoritos", nombre: "Favoritos", icono: "★" },
      { id: "todos", nombre: "Todas", icono: "⊞" },
      ...(estado?.familiasTpv ?? []).map((f) => ({ id: f.nombre, ...f, icono: null })),
      ...deArticulos.map((f, i) => ({ id: f, nombre: f, color: colorFamilia((estado?.familiasTpv?.length || 0) + i), icono: null })),
    ];
  }, [estado]);

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
    const total = base + iva;
    return { bruto, descuento, base, iva, total };
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
    if (k === "C") {
      if (modoTeclado === "linea") {
        setCantidadLinea(lineaSeleccionada, 1);
        setBufferTeclado("1");
      } else {
        setBufferTeclado("1");
      }
      return;
    }
    if (k === "B") {
      setBufferTeclado((prev) => {
        const nuevo = prev.length > 1 ? prev.slice(0, -1) : "1";
        return nuevo;
      });
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

  async function imprimirTicketRegalo() {
    try {
      const r = await fetch("/api/tpv/tickets");
      const lista = await r.json();
      if (!r.ok) throw new Error(lista.error || "Error al buscar tickets");
      const ultimo = lista?.find((t) => t.total >= 0);
      if (!ultimo) {
        setError("Todavía no hay tickets para imprimir");
        return;
      }
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
      <header className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Volver"
          >
            <IconCerrar />
          </button>
          <h1 className="text-lg font-bold">TPV</h1>
          <span className="text-sm text-slate-400 hidden sm:inline">
            Caja abierta · {estado?.caja?.apertura?.usuario ?? "—"}
          </span>
        </div>
        <div className="flex-1 max-w-xl mx-4">
          <input
            type="text"
            placeholder="Buscar artículo o escanear código…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={onEnterBusqueda}
            className="w-full px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-base placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostrarEspera(true)}
            className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
          >
            Espera
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
          <button
            onClick={() => navigate("/ayuda/tpv")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
            title="Ayuda TPV"
          >
            <IconAyuda /> Ayuda
          </button>
        </div>
      </header>

      {/* Cuerpo */}
      <div className="flex-1 flex overflow-hidden">
        {/* Categorías */}
        <aside className="w-28 sm:w-36 flex flex-col bg-slate-900 border-r border-slate-800 overflow-y-auto shrink-0">
          {categorias.map((c, i) => {
            const activa = familiaActiva === c.id;
            const bg = c.color || (activa ? colorFamilia(i) : "bg-slate-800");
            return (
              <button
                key={c.id}
                onClick={() => setFamiliaActiva(c.id)}
                className={`flex flex-col items-center justify-center gap-1 p-3 m-2 rounded-xl min-h-[76px] transition hover:brightness-110 ${
                  activa ? `${bg} text-white shadow-lg` : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {c.imagen ? (
                  <img
                    src={urlImagen(c.imagen)}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover bg-slate-700"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <span className="text-xl">{c.icono || "●"}</span>
                )}
                <span className="text-xs font-semibold text-center leading-tight">{c.nombre}</span>
              </button>
            );
          })}
        </aside>

        {/* Rejilla de productos */}
        <main className="flex-1 flex flex-col p-3 overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 content-start">
            {articulosFiltrados.map((a, i) => {
              const img = urlImagen(a.imagen);
              const cantidadEnTicket = cantidadesPorArticulo.get(String(a._id)) || 0;
              const catIndex = categorias.findIndex((c) => c.id === (a.familia || "todos"));
              const bg = colorFamilia(catIndex >= 0 ? catIndex : i);
              return (
                <button
                  key={a._id}
                  onClick={() => agregarArticulo(a)}
                  className={`group relative flex flex-col rounded-xl overflow-hidden shadow-lg transition active:scale-95 hover:brightness-110 ${bg}`}
                >
                  {cantidadEnTicket > 0 && (
                    <span className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-slate-900/80 text-white text-sm font-bold">
                      ×{cantidadEnTicket}
                    </span>
                  )}
                  <div className="h-24 sm:h-28 bg-slate-800/40 flex items-center justify-center overflow-hidden">
                    {img ? (
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <span className="text-2xl font-bold text-white/60">{iniciales(a.descripcion)}</span>
                    )}
                  </div>
                  <div className="p-3 text-left">
                    <p className="font-semibold text-white leading-tight line-clamp-2 text-sm sm:text-base">{a.descripcion}</p>
                    <p className="mt-2 text-lg sm:text-xl font-extrabold text-white/95">{euros(a.precioVenta)}</p>
                  </div>
                </button>
              );
            })}
            {!articulosFiltrados.length && (
              <p className="col-span-full text-center text-slate-500 py-10">No hay artículos</p>
            )}
          </div>
        </main>

        {/* Ticket + teclado */}
        <aside className="w-[360px] lg:w-[420px] flex flex-col bg-slate-900 border-l border-slate-800 shrink-0">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-bold text-slate-300">Ticket actual</h2>
              <p className="text-xs text-slate-500">Venta normal</p>
            </div>
            {lineas.length > 0 && (
              <button
                onClick={aparcarTicket}
                className="px-3 py-1.5 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 text-sm font-semibold"
              >
                Aparcar
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {lineas.map((l, i) => {
              const totalLinea = l.cantidad * l.precioUnitario * (1 - (l.descuento ?? 0) / 100) * (1 + l.iva / 100);
              const seleccionada = lineaSeleccionada === i;
              return (
                <div
                  key={i}
                  onClick={() => seleccionarLinea(i)}
                  className={`rounded-xl p-3 cursor-pointer transition ${
                    seleccionada ? "bg-indigo-600/30 border border-indigo-500" : "bg-slate-800 hover:bg-slate-700"
                  }`}
                >
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
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); cambiarCantidad(i, -1); }}
                        className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-lg font-bold"
                      >
                        −
                      </button>
                      <span className={`w-9 text-center font-bold text-lg ${seleccionada ? "text-indigo-300" : ""}`}>
                        {l.cantidad}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); cambiarCantidad(i, 1); }}
                        className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-lg font-bold"
                      >
                        +
                      </button>
                    </div>
                    <p className="w-20 text-right font-bold text-sm sm:text-base">{euros(totalLinea)}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); quitarLinea(i); }}
                      className="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 flex items-center justify-center"
                    >
                      <IconBorrar />
                    </button>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {[0, 5, 10, 20].map((d) => (
                      <button
                        key={d}
                        onClick={(e) => { e.stopPropagation(); cambiarDescuento(i, d); }}
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
              );
            })}
            {!lineas.length && (
              <p className="text-center text-slate-500 py-10">Toca un artículo para añadirlo</p>
            )}
          </div>

          {/* Teclado numérico */}
          <div className="p-3 border-t border-slate-800 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">
                {modoTeclado === "linea" ? "Editando cantidad" : "Cantidad siguiente"}
              </span>
              <span className="text-xl font-bold text-indigo-300">{bufferTeclado}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {["1", "2", "3", "Del"].map((k) => (
                <button
                  key={k}
                  onClick={() => tecla(k === "Del" ? "B" : k)}
                  className={`py-3 rounded-xl font-bold text-lg transition active:scale-95 ${
                    k === "Del" ? "bg-rose-600/20 text-rose-400 hover:bg-rose-600/40" : "bg-slate-800 hover:bg-slate-700"
                  }`}
                >
                  {k === "Del" ? "⌫" : k}
                </button>
              ))}
              {["4", "5", "6", "C"].map((k) => (
                <button
                  key={k}
                  onClick={() => tecla(k)}
                  className={`py-3 rounded-xl font-bold text-lg transition active:scale-95 ${
                    k === "C" ? "bg-amber-600/20 text-amber-400 hover:bg-amber-600/40" : "bg-slate-800 hover:bg-slate-700"
                  }`}
                >
                  {k}
                </button>
              ))}
              {["7", "8", "9", "."].map((k) => (
                <button
                  key={k}
                  onClick={() => tecla(k)}
                  className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-lg transition active:scale-95"
                >
                  {k}
                </button>
              ))}
              <button
                onClick={() => tecla("0")}
                className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-lg transition active:scale-95"
              >
                0
              </button>
              <button
                onClick={() => tecla("Enter")}
                className="col-span-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-lg transition active:scale-95"
              >
                Enter
              </button>
            </div>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => { if (lineaSeleccionada !== null) quitarLinea(lineaSeleccionada); }}
                disabled={lineaSeleccionada === null}
                className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm font-semibold"
              >
                Vaciar línea
              </button>
              <button
                onClick={vaciarTicket}
                disabled={!lineas.length}
                className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm font-semibold"
              >
                Borrar ticket
              </button>
            </div>
            <div className="flex justify-between items-end mb-3">
              <div className="text-xs text-slate-400 leading-tight">
                Bruto {euros(totales.bruto)}<br />
                Dto −{euros(totales.descuento)}<br />
                IVA {euros(totales.iva)}
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Total</p>
                <p className="text-3xl font-extrabold text-emerald-400">{euros(totales.total)}</p>
              </div>
            </div>
            <button
              onClick={abrirCobro}
              disabled={!lineas.length}
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-2xl font-extrabold tracking-wide transition active:scale-95"
            >
              COBRAR
            </button>
          </div>
        </aside>
      </div>

      {/* Barra inferior de acciones */}
      <footer className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-900 border-t border-slate-800 shrink-0">
        <button onClick={() => setModalMovimiento(true)} className="accion-tpv">
          <IconCaja /> Movim. caja
        </button>
        <button onClick={cargarResumen} className="accion-tpv">
          <IconTicket /> Informe usuario
        </button>
        <button onClick={imprimirProforma} disabled={!lineas.length} className="accion-tpv disabled:opacity-40">
          <IconImprimir /> Imprime proforma
        </button>
        <button onClick={imprimirTicketRegalo} className="accion-tpv">
          <IconTicket /> Ticket regalo
        </button>
        <button onClick={reimprimirUltimo} className="accion-tpv">
          <IconImprimir /> Copia últ. ticket
        </button>
        <button onClick={emailUltimoTicket} className="accion-tpv">
          <IconCorreo /> Email últ. ticket
        </button>
        <button onClick={abrirCajonTpv} className="accion-tpv">
          <IconCaja /> Abrir cajón
        </button>
      </footer>

      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-rose-600 text-white shadow-lg text-sm">
          {error}
        </div>
      )}

      {/* Tickets en espera */}
      {mostrarEspera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Tickets en espera</h3>
              <button onClick={() => setMostrarEspera(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            {!espera.length ? (
              <p className="text-slate-500 text-center py-6">No hay tickets aparcados.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
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

      {/* Movimiento de caja */}
      {modalMovimiento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={guardarMovimiento}
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Movimiento de caja</h3>
              <button type="button" onClick={() => setModalMovimiento(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                <select name="tipo" className="input w-full">
                  <option value="entrada">Entrada de efectivo</option>
                  <option value="salida">Salida de efectivo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Importe</label>
                <input name="importe" type="number" step="0.01" min="0.01" required className="input w-full" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Concepto</label>
                <input name="concepto" type="text" required className="input w-full" />
              </div>
              <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold">
                Guardar movimiento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resumen de usuario */}
      {modalResumen && resumen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Resumen del día</h3>
              <button onClick={() => setModalResumen(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="space-y-2 text-sm">
              <p>Fecha: <span className="font-semibold">{resumen.fecha}</span></p>
              <p>Tickets: {resumen.numeroTickets} · Devoluciones: {resumen.numeroDevoluciones}</p>
              <p>Ventas: {euros(resumen.ventas)} · Devoluciones: {euros(resumen.devoluciones)}</p>
              <p className="text-lg font-bold text-emerald-400">Total: {euros(resumen.total)}</p>
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-slate-400 mb-1">Por método de pago</p>
                {Object.entries(resumen.porMetodo).map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span className="capitalize">{k}</span><span>{euros(v)}</span></div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700">
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
