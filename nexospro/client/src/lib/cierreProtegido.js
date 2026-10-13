import { useCallback, useEffect, useRef } from "react";

// Cierre de ventanas "a prueba de dedos": evita perder facturas y citas
// enteras por un Escape o un clic fuera hechos sin querer (pasó en Montiel y
// en Filatecnica: la ventana se cierra de golpe y todo lo escrito se pierde).
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
export function useCierreProtegido(onCerrar) {
  const tocado = useRef(false);

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
    panelProps: { onInput: marcarTocado, onChange: marcarTocado },
    fondoProps: { onClick: confirmarYSalir },
    botonProps: { onClick: confirmarYSalir },
  };
}
