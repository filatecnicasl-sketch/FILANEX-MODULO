/* FILANEX — service worker.
   Objetivo: que la aplicación abra y se pueda consultar aunque no haya internet.
   Sin dependencias ni herramientas de compilación: se sirve tal cual desde /public.

   Estrategias:
   - Navegación (abrir la app): red primero; si no hay red, se sirve el index cacheado.
   - Estáticos (/assets, iconos, fuentes): stale-while-revalidate (rápido y se actualiza solo).
   - GET de /api: red primero y se guarda copia; sin red se devuelve la última copia.
   - Las escrituras (POST/PUT/DELETE) las gestiona la propia app mediante la cola
     offline; el SW no las intercepta.
*/

const VERSION = "filanex-v5";
const SHELL = `${VERSION}-shell`;
const ESTATICOS = `${VERSION}-estaticos`;
const DATOS = `${VERSION}-datos`;

// Lo mínimo para que la app arranque sin conexión. Los assets hasheados de
// Vite se cachean bajo demanda con stale-while-revalidate.
const PRECARGA = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icono-192.png",
  "/icono-512.png",
  "/icono-maskable-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // addAll falla entero si un archivo falta: se añaden de uno en uno.
      await Promise.all(
        PRECARGA.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => {})),
      );
      // También intentamos precargar los assets actuales si el build ya existe.
      try {
        const manifestResp = await fetch("/asset-manifest.json", { cache: "no-store" });
        if (manifestResp.ok) {
          const manifest = await manifestResp.json();
          const entradas = Array.isArray(manifest) ? manifest : Object.values(manifest).flat();
          await Promise.all(
            entradas
              .filter((u) => typeof u === "string" && u.startsWith("/assets/"))
              .map((u) => cache.add(new Request(u, { cache: "reload" })).catch(() => {})),
          );
        }
      } catch {
        // No hay manifest o no hay red: los assets se cachearán bajo demanda.
      }
    })(),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      // Fuera las cachés de versiones anteriores.
      const nombres = await caches.keys();
      await Promise.all(
        nombres.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => {});
      }
      await self.clients.claim();
    })(),
  );
});

// El cliente pide activar la versión nueva sin esperar (tras un despliegue).
self.addEventListener("message", (evento) => {
  if (evento.data?.tipo === "ACTIVAR_YA") self.skipWaiting();
});

// Sincronización en segundo plano: la app pide "filanex-sync" cuando vuelve la red.
self.addEventListener("sync", (evento) => {
  if (evento.tag === "filanex-sync") {
    evento.waitUntil(avisar({ tipo: "filanex:sync" }));
  }
});

async function avisar(mensaje) {
  const clientes = await self.clients.matchAll({ type: "window" });
  for (const cliente of clientes) cliente.postMessage(mensaje);
}

function esExcluida(url, peticion) {
  if (url.pathname.startsWith("/api/auth")) return true;
  if (url.pathname.startsWith("/api/telefonia/stream")) return true;
  if (peticion.headers.get("accept")?.includes("text/event-stream")) return true;
  return false;
}

// Copia de una respuesta marcada como "servida sin conexión".
async function marcarCache(respuesta) {
  const cabeceras = new Headers(respuesta.headers);
  cabeceras.set("X-Filanex-Cache", "1");
  return new Response(await respuesta.blob(), {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: cabeceras,
  });
}

async function navegacion(evento) {
  try {
    const precargada = await evento.preloadResponse;
    const respuesta = precargada || (await fetch(evento.request));
    const cache = await caches.open(SHELL);
    cache.put("/index.html", respuesta.clone()).catch(() => {});
    return respuesta;
  } catch {
    const cache = await caches.open(SHELL);
    const guardada = (await cache.match("/index.html")) || (await cache.match("/"));
    if (guardada) {
      avisar({ tipo: "filanex:sin-conexion" });
      return marcarCache(guardada);
    }
    return new Response(
      "<!doctype html><meta charset=utf-8><title>FILANEX</title>" +
        "<body style='font-family:sans-serif;background:#0A0A0A;color:#fff;padding:2rem'>" +
        "<h1>Sin conexión</h1><p>Abre la aplicación una vez con internet para poder usarla sin conexión.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

async function estatico(peticion) {
  const cache = await caches.open(ESTATICOS);
  const guardada = await cache.match(peticion);
  const red = fetch(peticion)
    .then((respuesta) => {
      if (respuesta.ok) cache.put(peticion, respuesta.clone()).catch(() => {});
      return respuesta;
    })
    .catch(() => null);
  if (guardada) return guardada;
  const respuesta = await red;
  if (respuesta) return respuesta;
  return new Response("", { status: 504 });
}

async function datos(peticion) {
  const cache = await caches.open(DATOS);
  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok) cache.put(peticion, respuesta.clone()).catch(() => {});
    return respuesta;
  } catch {
    const guardada = await cache.match(peticion);
    if (guardada) {
      avisar({ tipo: "filanex:sin-conexion" });
      return marcarCache(guardada);
    }
    avisar({ tipo: "filanex:sin-conexion" });
    return new Response(
      JSON.stringify({ error: "Sin conexión y sin datos guardados de esta consulta." }),
      { status: 503, headers: { "Content-Type": "application/json", "X-Filanex-Offline": "1" } },
    );
  }
}

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  const url = new URL(peticion.url);
  const propio = url.origin === self.location.origin;

  // Las escrituras las gestiona la propia app (cola offline). El SW solo
  // interviene en lecturas para servir cache cuando no hay red.
  if (peticion.method !== "GET") return;

  if (esExcluida(url, peticion)) return;

  if (peticion.mode === "navigate") {
    evento.respondWith(navegacion(evento));
    return;
  }

  if (propio && url.pathname.startsWith("/api/")) {
    evento.respondWith(datos(peticion));
    return;
  }

  // Estáticos propios y fuentes de Google.
  const esFuente = url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com");
  if (propio || esFuente) {
    evento.respondWith(estatico(peticion));
  }
});
