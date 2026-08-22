import { useEffect, useRef, useState } from "react";

// Buscador unificado de entidades (clientes, proveedores, artículos,
// aseguradoras, vehículos…): un único criterio en todo el programa.
// Escribir filtra por nombre o dato secundario (NIF, matrícula); Enter o
// clic elige; la × limpia. Filas grandes pensadas para pantalla de móvil.
//
// Dos modos:
//  - Cerrado (por id): pasa `valorId` + `onElegir(op|null)`. Solo vale lo
//    que se elige de la lista; si se escribe sin elegir, se revierte.
//  - Abierto (texto libre con sugerencias): pasa también `valorTexto` +
//    `onTexto`. El texto se conserva aunque no se elija nada.
const normalizar = (t) =>
  (t ?? "").toString().normalize("NFD").replace(/[́-ͯ]/g, "").toLowerCase();

export default function BuscadorEntidad({
  opciones, // [{ _id, nombre, nif?|secundario? }]
  valorId = "",
  valorTexto,
  onElegir,
  onTexto,
  placeholder = "Escribe para buscar…",
  required = false,
}) {
  const abierto = typeof onTexto === "function";
  const seleccionada = opciones.find((o) => String(o._id) === String(valorId));
  const [texto, setTexto] = useState(abierto ? (valorTexto ?? "") : (seleccionada?.nombre ?? ""));
  const [listaAbierta, setListaAbierta] = useState(false);
  const [resaltada, setResaltada] = useState(0);
  const cajaRef = useRef(null);

  // Sincroniza el texto visible con el valor externo (modales de edición,
  // opciones que llegan después por red…), sin pisar lo que se está escribiendo.
  useEffect(() => {
    if (!listaAbierta) {
      setTexto(abierto ? (valorTexto ?? "") : (seleccionada?.nombre ?? ""));
    }
  }, [valorId, valorTexto, abierto, listaAbierta, seleccionada?.nombre]);

  // Clic fuera: cierra.
  useEffect(() => {
    function fuera(e) {
      if (cajaRef.current && !cajaRef.current.contains(e.target)) setListaAbierta(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const q = normalizar(texto);
  const filtradas = (
    q
      ? opciones.filter(
          (o) => normalizar(o.nombre).includes(q) || normalizar(o.nif ?? o.secundario).includes(q)
        )
      : opciones
  ).slice(0, 50);

  function elegir(op) {
    setTexto(op.nombre);
    setListaAbierta(false);
    onElegir?.(op);
    if (abierto) onTexto(op.nombre);
  }

  function limpiar() {
    setTexto("");
    setListaAbierta(false);
    onElegir?.(null);
    if (abierto) onTexto("");
  }

  function alEscribir(e) {
    setTexto(e.target.value);
    setResaltada(0);
    setListaAbierta(true);
    if (abierto) onTexto(e.target.value);
  }

  function alTeclado(e) {
    if (e.key === "ArrowDown" && listaAbierta && filtradas.length > 0) {
      e.preventDefault();
      e.__enterTab = true;
      setResaltada((r) => (r + 1) % filtradas.length);
    } else if (e.key === "ArrowUp" && listaAbierta && filtradas.length > 0) {
      e.preventDefault();
      e.__enterTab = true;
      setResaltada((r) => (r - 1 + filtradas.length) % filtradas.length);
    } else if (e.key === "Enter" && listaAbierta && filtradas.length > 0) {
      e.preventDefault();
      e.__enterTab = true; // que enterComoTab no salte de campo
      elegir(filtradas[resaltada] ?? filtradas[0]);
    } else if (e.key === "Escape") {
      setListaAbierta(false);
    }
  }

  function alPerderFoco() {
    // Pequeña espera para que el clic en una opción llegue antes del cierre.
    setTimeout(() => {
      setListaAbierta(false);
      if (!abierto) setTexto(seleccionada?.nombre ?? "");
    }, 150);
  }

  return (
    <div ref={cajaRef} className="relative flex-1 min-w-0">
      <input
        value={texto}
        onChange={alEscribir}
        onFocus={() => {
          setResaltada(0);
          setListaAbierta(true);
        }}
        onBlur={alPerderFoco}
        onKeyDown={alTeclado}
        placeholder={placeholder}
        required={required && !valorId && !texto}
        autoComplete="off"
        className="input w-full !pr-8"
      />
      {texto && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            limpiar();
          }}
          title="Quitar la selección"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400 px-1"
        >
          ×
        </button>
      )}

      {listaAbierta && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {filtradas.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-slate-400">Sin coincidencias</p>
          ) : (
            filtradas.map((o, i) => (
              <button
                key={o._id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(o);
                }}
                onMouseEnter={() => setResaltada(i)}
                className={`w-full text-left px-3.5 py-3 sm:py-2.5 text-[0.9375rem] sm:text-sm transition-colors ${
                  i === resaltada ? "bg-accent/10" : ""
                }`}
              >
                <span className="block truncate text-slate-700">{o.nombre}</span>
                {(o.nif ?? o.secundario) && (
                  <span className="block text-xs text-slate-400 num">{o.nif ?? o.secundario}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
