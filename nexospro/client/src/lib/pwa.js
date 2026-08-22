// Registro del service worker y aviso de versión nueva.
// Solo se activa en producción (en desarrollo estorba al recargado en caliente).

let alAvisar = null;

export function registrarSW(alDetectarActualizacion) {
  alAvisar = alDetectarActualizacion;
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  // Si la página ya ha terminado de cargar (lo normal al montar React), se
  // registra en el momento; si no, se espera al load para no competir con ella.
  if (document.readyState === "complete") registrar();
  else window.addEventListener("load", registrar, { once: true });
}

async function registrar() {
  try {
    const registro = await navigator.serviceWorker.register("/sw.js");

    // Si ya hay una versión esperando, se avisa enseguida.
    if (registro.waiting && navigator.serviceWorker.controller) {
      alAvisar?.(() => activar(registro));
    }

    registro.addEventListener("updatefound", () => {
      const nuevo = registro.installing;
      if (!nuevo) return;
      nuevo.addEventListener("statechange", () => {
        // Solo interesa cuando ya había una versión funcionando.
        if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
          alAvisar?.(() => activar(registro));
        }
      });
    });

    // Al tomar el control la versión nueva, se recarga una sola vez.
    let recargando = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (recargando) return;
      recargando = true;
      location.reload();
    });

    // Cada media hora se comprueba si hay versión nueva publicada.
    setInterval(() => registro.update().catch(() => {}), 30 * 60 * 1000);
  } catch (error) {
    console.warn("No se pudo registrar el service worker:", error);
  }
}

function activar(registro) {
  registro.waiting?.postMessage({ tipo: "ACTIVAR_YA" });
}
