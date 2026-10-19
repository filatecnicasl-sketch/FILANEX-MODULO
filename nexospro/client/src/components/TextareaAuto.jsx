import { useEffect, useRef } from "react";

// Textarea que crece sola con el contenido. Cuenta tanto los saltos de línea
// escritos como el ajuste de línea del navegador (texto que ocupa varias
// líneas visibles sin Intro), de modo que nunca queda texto escondido: el
// campo se hace tan alto como haga falta (con un máximo razonable, a partir
// del cual aparece la barra de desplazamiento).
//
// Motivo: en el taller se escriben descripciones de daños largas y con la
// altura fija (rows=2) el resto del texto no se veía — parecía que el
// programa "no dejaba" escribir más (propuesta de Montiel, 19/10/2026).
export default function TextareaAuto({ value, minRows = 2, maxRows = 18, className = "", ...props }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const linea = Number.parseFloat(getComputedStyle(el).lineHeight) || 21;
    const alto = Math.min(el.scrollHeight, Math.ceil(linea) * maxRows);
    el.style.height = `${alto}px`;
    el.style.overflowY = el.scrollHeight > alto ? "auto" : "hidden";
  }, [value, maxRows]);

  return <textarea ref={ref} rows={minRows} value={value} className={className} {...props} />;
}
