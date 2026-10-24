import { useCallback, useEffect, useRef } from "react";

// Cierre de ventanas "a prueba de dedos": evita perder facturas, órdenes y
// citas enteras por un Escape o un clic fuera hechos sin querer (pasó en
// Montiel y en Filatecnica: la ventana se cierra de golpe y todo lo escrito
// se pierde).
//
// Uso:
//   const cierre = useCierreProtegido(onCerrar);
//   <div className="fondo" {...cierre.fondoProps}>        // cierra con confirmación
//     <div className="panel" {...cierre.panelProps}> ...  // marca "hay cambios"
//
// Reglas:
// 1. Si el usuario ha tocado algún campo y pulsa Escape con el foco dentro de
//    un campo, el foco sale del campo pero la ventana NO se cierra.
// 2. Si pulsa Escape (o clica el fondo) habiendo cambios, se pide confirmación.
// 3. Si no ha tocado nada, se cierra sin molestar.
// 4. El fondo SOLO cierra si el mousedown y el mouseup ocurren ambos en el
//    propio fondo. Así, arrastrar para seleccionar una palabra o frase
//    (marcar en azul) y soltar el ratón fuera del campo — sobre el fondo
//    oscuro — ya no cierra la ventana (era la queja de Montiel del 19/10:
//    "se sale de la pantalla y otra vez a empezar de nuevo").
export function useCierreProtegido(onCerrar) {
  const tocado = useRef(false);
  const inicioEnFondo = useRef(false);

  const confirmarYSalir = useCallback(() => {
    if (tocado.current && !window.confirm("Hay datos sin guardar. ¿Cerrar de todas formas y perderlos?")) return;
    onCerrar();
  }, [onCerrar]);

  useEffect(() => {
    const alPulsar = (e) => {
      if (e.key !== "Escape") return;
      const t = e.target;
      const enCampo =
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (enCampo && tocado.current) {
        // Primera pulsación con el foco en un campo: saca el foco, no cierra.
        t.blur();
        return;
      }
      confirmarYSalir();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [confirmarYSalir]);

  const marcarTocado = useCallback(() => {
    tocado.current = true;
  }, []);

  return {
    cerrar: confirmarYSalir,
    panelProps: { onInput: marcarTocado, onChange: marcarTocado },
    fondoProps: {
      onMouseDown: (e) => {
        inicioEnFondo.current = e.target === e.currentTarget;
      },
      onClick: (e) => {
        if (!inicioEnFondo.current) return; // el arrastre empezó dentro del panel
        inicioEnFondo.current = false;
        // Está seleccionando texto (o acaba de soltar una selección): no cerrar.
        const sel = window.getSelection?.();
        if (sel && String(sel)) return;
        if (e.target !== e.currentTarget) return;
        confirmarYSalir();
      },
    },
    botonProps: { onClick: confirmarYSalir },
  };
}

// Variante sin estado para ventanas secundarias (ver datos, filtrar, conciliar…):
// mismo arreglo del arrastre-selección, sin confirmación de datos sin guardar.
// Uso: <div className="fondo…" {...fondoSeguro(onCerrar)}>
let _inicioEnFondo = false;
export function fondoSeguro(onCerrar) {
  return {
    onMouseDown: (e) => {
      _inicioEnFondo = e.target === e.currentTarget;
    },
    onClick: (e) => {
      if (!_inicioEnFondo) return; // el arrastre empezó dentro del panel
      _inicioEnFondo = false;
      const sel = window.getSelection?.();
      if (sel && String(sel)) return; // marcando texto en azul: no cerrar
      if (e.target !== e.currentTarget) return;
      onCerrar();
    },
  };
}
