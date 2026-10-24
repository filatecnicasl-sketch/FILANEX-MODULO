// Sustitución mecánica de clases por los nuevos componentes de diseño.
// Uso: node scripts/redisenio-clases.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/src");

const archivos = [
  "pages/VentasPage.jsx",
  "pages/ComprasPage.jsx",
  "pages/ClientesPage.jsx",
  "pages/ProveedoresPage.jsx",
  "pages/ArticulosPage.jsx",
  "pages/PresupuestosPage.jsx",
  "pages/AlbaranesPage.jsx",
  "pages/TesoreriaPage.jsx",
  "pages/RecurrenciasPage.jsx",
  "pages/ConfigPage.jsx",
  "components/FormDocumento.jsx",
  "components/EditorLineas.jsx",
];

const sustituciones = [
  ["bg-panel border border-accent/30 rounded-xl", "panel border-accent/30"],
  ["bg-panel border border-white/5 rounded-xl", "panel"],
  [
    "bg-accent text-navy-950 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-cyan-300 transition-colors disabled:opacity-50",
    "btn-primary",
  ],
  [
    "bg-accent text-navy-950 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-cyan-300 transition-colors",
    "btn-primary",
  ],
  [
    "border border-accent/40 text-accent font-semibold text-sm px-4 py-2 rounded-lg hover:bg-accent/10 transition-colors",
    "btn-ghost",
  ],
  [
    "bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white",
    "input",
  ],
  ['<table className="w-full text-sm">', '<table className="tabla w-full text-sm">'],
];

let total = 0;
for (const rel of archivos) {
  const ruta = path.join(raiz, rel);
  let contenido = readFileSync(ruta, "utf8");
  let cambios = 0;
  for (const [antes, despues] of sustituciones) {
    const partes = contenido.split(antes);
    if (partes.length > 1) {
      cambios += partes.length - 1;
      contenido = partes.join(despues);
    }
  }
  if (cambios > 0) {
    writeFileSync(ruta, contenido);
    console.log(`${rel}: ${cambios} sustituciones`);
    total += cambios;
  }
}
console.log(`TOTAL: ${total}`);
