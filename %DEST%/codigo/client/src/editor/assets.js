/**
 * Imágenes integradas para elementos de tipo imagen.
 * Placeholders SVG (siluetas de coche) — sustituibles por los PNG originales
 * del NEXOPRO clásico sin tocar las plantillas (misma clave de imagen).
 */
const svg = (contenido, w, h) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${contenido}</svg>`
  )}`;

const COCHE_LATERAL = svg(
  `<g fill="none" stroke="%23334155" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 34 L20 20 Q22 15 30 14 L72 11 Q84 10 92 16 L104 25 L118 28 Q126 30 126 36 L126 44 L114 46"/>
    <path d="M14 34 L10 40 Q8 44 14 46 L26 47"/>
    <circle cx="40" cy="47" r="10"/>
    <circle cx="100" cy="47" r="10"/>
    <path d="M50 48 L90 48"/>
    <path d="M34 16 L38 27 L78 24 L80 13"/>
  </g>`,
  136, 62
);

const COCHE_SUPERIOR = svg(
  `<g fill="none" stroke="%23334155" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="20" y="6" width="96" height="124" rx="26"/>
    <path d="M28 30 L108 30 M28 108 L108 108"/>
    <path d="M34 44 L102 44 L102 92 L34 92 Z" stroke-width="2"/>
    <rect x="12" y="34" width="8" height="16" rx="3"/>
    <rect x="116" y="34" width="8" height="16" rx="3"/>
  </g>`,
  136, 136
);

const COCHE_INFERIOR = svg(
  `<g fill="none" stroke="%23334155" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="24" y="6" width="88" height="124" rx="22"/>
    <circle cx="24" cy="34" r="8"/><circle cx="112" cy="34" r="8"/>
    <circle cx="24" cy="102" r="8"/><circle cx="112" cy="102" r="8"/>
    <path d="M44 30 L92 30 M44 106 L92 106" stroke-width="2"/>
    <rect x="48" y="48" width="40" height="40" rx="6" stroke-width="2"/>
  </g>`,
  136, 136
);

export const BUILTIN_IMAGES = {
  "coche-superior": COCHE_SUPERIOR,
  "coche-inferior": COCHE_INFERIOR,
  "coche-lateral": COCHE_LATERAL,
};

export const BUILTIN_IMAGE_NAMES = {
  "coche-superior": "Coche - vista superior",
  "coche-inferior": "Coche - vista inferior",
  "coche-lateral": "Coche - vista lateral",
};

export function resolveImageSrc(src) {
  return BUILTIN_IMAGES[src] ?? src;
}
