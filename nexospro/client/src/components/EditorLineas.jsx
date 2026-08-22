import { useEffect, useMemo, useRef, useState } from "react";
import { euros } from "./ui.jsx";
import { enterComoTab } from "../utils/enter-tab.js";

export const lineaVacia = () => ({ descripcion: "", cantidad: 1, precioUnitario: 0, iva: 21 });

// Editor de líneas de documento. El campo descripción busca en el catálogo
// de artículos al escribir: al elegir uno rellena precio e IVA (precio de
// venta o de compra según `precio`), y si no existe se puede crear ahí mismo.
// `conTipo` (taller) añade el selector mano de obra / material, que decide
// qué descuento de la aseguradora se aplica al facturar la orden.
// `conGrupo` (taller) activa las imputaciones: las líneas se agrupan por
// trabajo (Chapa, Pintura, o texto libre) con subtotal por grupo, igual que
// las imputaciones de una valoración Audatex. `gruposSugeridos` alimenta el
// desplegable (p.ej. los trabajos marcados en la orden).
// `conDescuento` (compras) añade la columna de % de descuento por línea;
// el importe de la línea y los totales salen ya netos.
export default function EditorLineas({ lineas, setLineas, precio = "venta", conTipo = false, conGrupo = false, gruposSugeridos = [], conDescuento = false }) {
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

  const nuevaLinea = (grupo) => {
    const base = conTipo ? { ...lineaVacia(), tipo: "mano_obra" } : lineaVacia();
    if (conGrupo) base.grupo = grupo ?? "";
    if (conDescuento) base.descuento = 0;
    return base;
  };

  // Enter en el último campo de la última línea: añade otra y le da el foco.
  function anadirLineaYFoco(grupo) {
    setLineas((ls) => [...ls, nuevaLinea(grupo)]);
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

  const importesLinea = (l) => {
    const bruto = (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0);
    const base = bruto * (1 - (Number(l.descuento) || 0) / 100);
    return { base, iva: (base * (Number(l.iva) || 0)) / 100 };
  };

  const totales = lineas.reduce(
    (acc, l) => {
      const { base, iva } = importesLinea(l);
      acc.base += base;
      acc.iva += iva;
      return acc;
    },
    { base: 0, iva: 0 }
  );

  // Imputaciones: nombres sugeridos (trabajos de la orden + ya usados).
  const opcionesGrupo = useMemo(() => {
    if (!conGrupo) return [];
    const usados = lineas.map((l) => (l.grupo ?? "").trim()).filter(Boolean);
    return [...new Set([...gruposSugeridos.filter(Boolean), ...usados])];
  }, [conGrupo, gruposSugeridos, lineas]);

  // Secciones agrupadas para el render: "Sin imputación" primero, luego los
  // grupos en orden de aparición. Cada línea conserva su índice original.
  const secciones = useMemo(() => {
    if (!conGrupo) return null;
    const ordenNombres = [];
    const mapa = new Map();
    lineas.forEach((l, i) => {
      const g = (l.grupo ?? "").trim();
      if (!mapa.has(g)) {
        mapa.set(g, []);
        ordenNombres.push(g);
      }
      mapa.get(g).push(i);
    });
    ordenNombres.sort((a, b) => (a === "" ? -1 : b === "" ? 1 : 0));
    return ordenNombres.map((nombre) => {
      const idxs = mapa.get(nombre);
      const sub = idxs.reduce(
        (acc, i) => {
          const { base, iva } = importesLinea(lineas[i]);
          acc.base += base;
          acc.iva += iva;
          return acc;
        },
        { base: 0, iva: 0 }
      );
      return { nombre, idxs, sub };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conGrupo, lineas]);

  function filaLinea(l, i) {
    return (
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
            className={`${conTipo ? (conDescuento ? "col-span-3" : "col-span-4") : conDescuento ? "col-span-5" : "col-span-6"} input text-base sm:text-sm`}
            autoComplete="off"
          />
          {conTipo && (
            <select
              data-editor="linea"
              value={l.tipo ?? "mano_obra"}
              onChange={(e) => cambiar(i, "tipo", e.target.value)}
              className="col-span-2 input !px-2"
              title="Mano de obra o material (decide el descuento de la aseguradora)"
            >
              <option value="mano_obra">M. obra</option>
              <option value="material">Material</option>
            </select>
          )}
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
          {conDescuento && (
            <input
              data-editor="linea"
              type="number" min="0" max="100" step="0.1" placeholder="Dto%"
              title="Descuento de la línea en %"
              value={l.descuento ?? 0}
              onChange={(e) => cambiar(i, "descuento", e.target.value)}
              className="col-span-1 input !px-2 text-right"
            />
          )}
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

        {conGrupo && (
          <input
            data-editor="linea"
            list="editor-grupos"
            placeholder="Imputación: Chapa, Pintura… (vacío = sin imputación)"
            value={l.grupo ?? ""}
            onChange={(e) => cambiar(i, "grupo", e.target.value)}
            className="input !py-1 mt-1 w-full sm:w-[46%] sm:min-w-[220px] text-xs"
            title="Grupo de trabajo al que se imputa la línea (subtotal en la orden y en el parte impreso)"
          />
        )}

        {/* Sugerencias del catálogo + alta rápida de artículo */}
        {sugerenciasEn === i && creando?.indice !== i && (
          <div className="absolute left-0 top-full z-30 mt-1 w-full sm:w-[46%] min-w-[280px] rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden">
            {coincidencias(l.descripcion).map((a) => (
              <button
                key={a._id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  aplicarArticulo(i, a);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-3 sm:py-2 text-left text-[0.9375rem] sm:text-sm hover:bg-accent/10 transition-colors"
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
          <div className="absolute left-0 top-full z-30 mt-1 w-full sm:w-[46%] min-w-[280px] rounded-lg border border-accent/40 bg-white shadow-xl p-3 space-y-2">
            <p className="text-[0.6875rem] font-semibold text-accent uppercase tracking-wider">
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
    );
  }

  return (
    <div className="space-y-2" ref={contenedorRef} onKeyDown={(e) => enterComoTab(e, contenedorRef, () => anadirLineaYFoco())}>
      <label className="text-xs uppercase tracking-wider text-slate-500">
        Líneas <span className="normal-case font-normal">— escribe para buscar en artículos · Enter pasa al siguiente campo</span>
      </label>

      {conGrupo && (
        <datalist id="editor-grupos">
          {opcionesGrupo.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      )}

      {conGrupo
        ? secciones.map((sec) => (
            <div key={sec.nombre || "_sin"} className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-600 truncate">
                  {sec.nombre || "Sin imputación"}
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-[0.6875rem] font-semibold text-slate-500 num">
                    {euros(sec.sub.base + sec.sub.iva)}
                  </span>
                  <button
                    type="button"
                    onClick={() => anadirLineaYFoco(sec.nombre)}
                    className="text-[0.6875rem] font-semibold text-accent hover:underline"
                  >
                    + línea
                  </button>
                </span>
              </div>
              <div className="p-2 space-y-2">{sec.idxs.map((i) => filaLinea(lineas[i], i))}</div>
            </div>
          ))
        : lineas.map((l, i) => filaLinea(l, i))}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => anadirLineaYFoco()}
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
