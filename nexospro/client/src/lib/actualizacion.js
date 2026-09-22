// Detección y aplicación de versiones nuevas del programa.
//
// Problema que resuelve: un usuario puede llevar días con la app abierta
// (sobre todo en TPV) y no enterarse de que se ha desplegado una versión
// nueva. El service worker solo detecta cambios cuando cambia su propio
// código, así que aquí se compara el hash del bundle que tiene la página
// cargada con el que está sirviendo el servidor (/api/version).

let buildEnMemoria = null;

// Hash del bundle que tiene cargado esta página (de su propia etiqueta
// <script src="/assets/index-XXXX.js">). En desarrollo no existe: "dev".
export function buildActual() {
  if (buildEnMemoria) return buildEnMemoria;
  for (const s of document.querySelectorAll('script[src*="/assets/"]')) {
    const m = String(s.src).match(/\/assets\/index-([A-Za-z0-9_-]+)\.js/);
    if (m) return (buildEnMemoria = m[1]);
  }
  return (buildEnMemoria = "dev");
}

// true si el servidor está sirviendo un build distinto del cargado.
export async function comprobarActualizacion() {
  try {
    const r = await fetch("/api/version", { cache: "no-store" });
    if (!r.ok) return false;
    const datos = await r.json();
    return !!datos.build && datos.build !== "dev" && datos.build !== buildActual();
  } catch {
    return false;
  }
}

// Deja el service worker al día y recarga. Al recargar, la navegación es
// red-primero y trae el index.html nuevo con sus assets nuevos.
export async function aplicarActualizacion() {
  try {
    const registro = await navigator.serviceWorker?.getRegistration();
    await registro?.update().catch(() => {});
    registro?.waiting?.postMessage({ tipo: "ACTIVAR_YA" });
  } catch {
    // Sin service worker (o error): basta la recarga.
  }
  setTimeout(() => window.location.reload(), 300);
}
