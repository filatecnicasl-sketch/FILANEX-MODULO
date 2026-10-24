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
  `<g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 38 L16 26 Q20 20 32 19 L82 16 Q100 15 112 22 L128 28 Q136 31 136 38 L136 46 L124 48"/>
    <path d="M10 38 L6 44 Q4 49 12 51 L28 52"/>
    <circle cx="34" cy="50" r="11"/>
    <circle cx="34" cy="50" r="5"/>
    <circle cx="108" cy="50" r="11"/>
    <circle cx="108" cy="50" r="5"/>
    <path d="M58 52 L84 52"/>
    <path d="M26 22 L32 33 L86 30 L92 19"/>
    <path d="M44 22 L44 33 M68 20 L68 31 M92 19 L92 27"/>
    <path d="M112 22 L124 26"/>
  </g>`,
  142, 64
);

const COCHE_SUPERIOR = svg(
  `<g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 22 Q20 6 50 6 L90 6 Q120 6 126 22 L128 38 Q130 70 120 86 L110 94 Q100 100 90 100 L50 100 Q40 100 30 94 L20 86 Q10 70 12 38 Z"/>
    <path d="M24 22 L116 22 L116 80 L24 80 Z"/>
    <path d="M42 22 L42 80 M98 22 L98 80"/>
    <path d="M24 36 L42 36 M98 36 L116 36"/>
    <path d="M24 66 L42 66 M98 66 L116 66"/>
    <path d="M50 6 L50 22 M90 6 L90 22"/>
    <ellipse cx="14" cy="50" rx="5" ry="10"/>
    <ellipse cx="126" cy="50" rx="5" ry="10"/>
    <path d="M38 100 Q50 108 62 100 M78 100 Q90 108 102 100"/>
  </g>`,
  140, 112
);

const COCHE_FRONTAL = svg(
  `<g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 30 Q16 8 40 8 L64 8 Q88 8 92 30 L96 48 Q98 60 92 66 L90 82 Q90 90 84 90 L78 90 L78 80 L26 80 L26 90 L20 90 Q14 90 14 82 L12 66 Q6 60 8 48 Z"/>
    <path d="M12 48 L92 48 L92 56 L12 56 Z"/>
    <path d="M16 30 L88 30 L86 42 L18 42 Z"/>
    <path d="M14 56 L24 56 L24 74 L14 74 Z"/>
    <path d="M80 56 L90 56 L90 74 L80 74 Z"/>
    <rect x="34" y="60" width="36" height="10" rx="2"/>
    <path d="M28 18 Q40 12 52 12 Q64 12 76 18"/>
    <circle cx="20" cy="72" r="4"/>
    <circle cx="84" cy="72" r="4"/>
  </g>`,
  104, 96
);

const COCHE_TRASERA = svg(
  `<g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 32 Q14 8 40 8 L64 8 Q90 8 94 32 L96 50 Q98 62 92 68 L90 82 Q90 90 84 90 L78 90 L78 80 L26 80 L26 90 L20 90 Q14 90 14 82 L12 68 Q6 62 8 50 Z"/>
    <path d="M10 50 L94 50 L94 58 L10 58 Z"/>
    <path d="M16 32 L88 32 L86 44 L18 44 Z"/>
    <rect x="14" y="58" width="18" height="14" rx="2"/>
    <rect x="72" y="58" width="18" height="14" rx="2"/>
    <rect x="38" y="62" width="28" height="10" rx="2"/>
    <path d="M28 18 Q40 12 52 12 Q64 12 76 18"/>
    <circle cx="52" cy="76" r="5"/>
  </g>`,
  104, 96
);

export const BUILTIN_IMAGES = {
  "coche-lateral": COCHE_LATERAL,
  "coche-superior": COCHE_SUPERIOR,
  "coche-frontal": COCHE_FRONTAL,
  "coche-trasera": COCHE_TRASERA,
};

export const BUILTIN_IMAGE_NAMES = {
  "coche-lateral": "Coche - vista lateral",
  "coche-superior": "Coche - vista superior",
  "coche-frontal": "Coche - vista frontal",
  "coche-trasera": "Coche - vista trasera",
};

export function resolveImageSrc(src) {
  return BUILTIN_IMAGES[src] ?? src;
}
