import { useEffect, useRef, useState } from "react";
import { euros } from "./ui.jsx";
import { enterComoTab } from "../utils/enter-tab.js";

export const lineaVacia = () => ({ descripcion: "", cantidad: 1, precioUnitario: 0, iva: 21 });

// Editor de líneas de documento. El campo descripción busca en el catálogo
// de artículos al escribir: al elegir uno rellena precio e IVA (precio de
// venta o de compra según `precio`), y si no existe se puede crear ahí mismo.
export default function EditorLineas({ lineas, setLineas, precio = "venta" }) {
  const [articulos, setArticulos] = useState([]);
  const [sugerenciasEn, setSugerenciasEn] = useState(null); // índice de línea con el desplegable abierto
  const [creando, setCreando] = useState(null); // { indice, descripcion, precio, iva }
  const [errorAlta, setErrorAlta] = useState(null);
  const contenedorRef = useRef(null);

  useEffect(() => {
    fetch("/api/articulos")
      .then((r) => r.json())
      .then((lista) => setArticulos(Array.isArray(lista) ? lista : []))
      .catch(() => setArticulos([]));
  }, []);

  // Cierra el desplegable al hacer clic fuera.
  useEffect(() => {
    function fuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setSugerenciasEn(null);
        setCreando(null);
        setErrorAlta(null);
      }
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  function cambiar(i, campo, valor) {
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  }

  // Enter en el último campo de la última línea: añade otra y le da el foco.
  function anadirLineaYFoco() {
    setLineas((ls) => [...ls, lineaVacia()]);
    setTimeout(() => {
      const descs = contenedorRef.current?.querySelectorAll("input[data-editor-desc]");
      descs?.[descs.length - 1]?.focus();
    }, 0);
  }

  function aplicarArticulo(i, a) {
    setLineas((ls) =>
      ls.map((l, j) =>
        j === i
          ? {
              ...l,
              descripcion: a.descripcion,
              precioUnitario: precio === "compra" ? a.precioCompra ?? 0 : a.precioVenta ?? 0,
              iva: a.iva ?? 21,
            }
          : l
      )
    );
    setSugerenciasEn(null);
  }

  async function crearArticulo() {
    setErrorAlta(null);
    const descripcion = creando.descripcion.trim();
    if (!descripcion) return setErrorAlta("Falta la descripción");
    const precioNum = Number(creando.precio) || 0;
    try {
      const r = await fetch("/api/articulos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion,
          precioVenta: precio === "compra" ? 0 : precioNum,
          precioCompra: precio === "compra" ? precioNum : 0,
          iva: Number(creando.iva) || 0,
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al crear el artículo");
      setArticulos((as) => [...as, datos]);
      aplicarArticulo(creando.indice, datos);
      setCreando(null);
    } catch (e) {
      setErrorAlta(e.message);
    }
  }

  function coincidencias(texto) {
    const q = texto.trim().toLowerCase();
    if (!q) return articulos.slice(0, 6);
    return articulos
      .filter(
        (a) =>
          a.descripcion?.toLowerCase().includes(q) ||
          a.codigo?.toLowerCase().includes(q) ||
          a.referenciaProveedor?.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }

  const totales = lineas.reduce(
    (acc, l) => {
      const base = (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0);
      acc.base += base;
      acc.iva += (base * (Number(l.iva) || 0)) / 100;
      return acc;
    },
    { base: 0, iva: 0 }
  );

  return (
    <div className="space-y-2" ref={contenedorRef} onKeyDown={(e) => enterComoTab(e, contenedorRef, anadirLineaYFoco)}>
      <label className="text-xs uppercase tracking-wider text-slate-500">
        Líneas <span className="normal-case font-normal">— escribe para buscar en artículos · Enter pasa al siguiente campo</span>
      </label>
      {lineas.map((l, i) => (
        <div key={i} className="relative">
          <div className="grid grid-cols-12 gap-2">
            <input
              data-editor="linea" data-editor-desc
              placeholder="Descripción o artículo…"
              value={l.descripcion}
              onFocus={() => setSugerenciasEn(i)}
              onChange={(e) => {
                cambiar(i, "descripcion", e.target.value);
                setSugerenciasEn(i);
              }}
              onKeyDown={(e) => e.key === "Escape" && setSugerenciasEn(null)}
              className="col-span-6 input"
              autoComplete="off"
            />
            <input
              data-editor="linea"
              type="number" min="0" step="1" placeholder="Uds."
              value={l.cantidad}
              onChange={(e) => cambiar(i, "cantidad", e.target.value)}
              className="col-span-2 input text-right"
            />
            <input
              data-editor="linea"
              type="number" min="0" step="0.01" placeholder="Precio"
              value={l.precioUnitario}
              onChange={(e) => cambiar(i, "precioUnitario", e.target.value)}
              className="col-span-2 input text-right"
            />
            <select
              data-editor="linea"
              value={l.iva}
              onChange={(e) => cambiar(i, "iva", e.target.value)}
              className="col-span-1 input !px-2"
            >
              {[21, 10, 4, 0].map((v) => <option key={v} value={v}>{v}%</option>)}
            </select>
            <button
              onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))}
              className="col-span-1 text-slate-500 hover:text-red-300"
              title="Quitar línea"
            >×</button>
          </div>

          {/* Sugerencias del catálogo + alta rápida de artículo */}
          {sugerenciasEn === i && creando?.indice !== i && (
            <div className="absolute left-0 top-full z-30 mt-1 w-[46%] min-w-[280px] rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden">
              {coincidencias(l.descripcion).map((a) => (
                <button
                  key={a._id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    aplicarArticulo(i, a);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/10 transition-colors"
                >
                  <span className="truncate text-slate-700">
                    {a.codigo && <span className="text-slate-400 text-xs mr-1.5 num">{a.codigo}</span>}
                    {a.descripcion}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500 num">
                    {euros(precio === "compra" ? a.precioCompra ?? 0 : a.precioVenta ?? 0)}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setCreando({ indice: i, descripcion: l.descripcion, precio: 0, iva: 21 });
                  setSugerenciasEn(null);
                }}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-accent hover:bg-accent/10 border-t border-slate-100 transition-colors"
              >
                + Crear artículo{l.descripcion.trim() ? ` «${l.descripcion.trim()}»` : ""}…
              </button>
            </div>
          )}

          {/* Mini-formulario de alta de artículo */}
          {creando?.indice === i && (
            <div className="absolute left-0 top-full z-30 mt-1 w-[46%] min-w-[280px] rounded-lg border border-accent/40 bg-white shadow-xl p-3 space-y-2">
              <p className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                Nuevo artículo
              </p>
              <input
                autoFocus
                placeholder="Descripción *"
                value={creando.descripcion}
                onChange={(e) => setCreando((c) => ({ ...c, descripcion: e.target.value }))}
                className="input w-full !py-1.5 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number" min="0" step="0.01"
                  placeholder={precio === "compra" ? "Precio de compra" : "Precio de venta"}
                  value={creando.precio}
                  onChange={(e) => setCreando((c) => ({ ...c, precio: e.target.value }))}
                  className="input !py-1.5 text-sm text-right"
                />
                <select
                  value={creando.iva}
                  onChange={(e) => setCreando((c) => ({ ...c, iva: e.target.value }))}
                  className="input !py-1.5 text-sm"
                >
                  {[21, 10, 4, 0].map((v) => <option key={v} value={v}>IVA {v}%</option>)}
                </select>
              </div>
              {errorAlta && <p className="text-xs text-red-500">{errorAlta}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    crearArticulo();
                  }}
                  className="btn-primary !py-1 !px-3 text-xs"
                >
                  Crear y usar
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCreando(null);
                    setErrorAlta(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setLineas((ls) => [...ls, lineaVacia()])}
          className="text-accent text-sm hover:underline"
        >+ Añadir línea</button>
        <p className="text-sm text-slate-400">
          Base {euros(totales.base)} · IVA {euros(totales.iva)} ·{" "}
          <span className="text-white font-semibold">Total {euros(totales.base + totales.iva)}</span>
        </p>
      </div>
    </div>
  );
}
