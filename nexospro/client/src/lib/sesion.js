// Sesión: token JWT en sessionStorage por pestaña. Cada pestaña del navegador
// es independiente, por lo que se puede tener admin en una y demo en otra sin
// que se mezclen llamadas, facturas ni ningún dato.
//
// Wrapper global de fetch que añade Authorization a /api y gestiona la cola
// offline.
import { reglaOffline } from "./rutasOffline.js";
import { encolar } from "./colaOffline.js";

const CLAVE_TOKEN = "filanex-token";
// Copia persistente del token, SOLO para poder abrir la app sin internet.
// En condiciones normales manda sessionStorage (sesiones independientes por
// pestaña); la copia se usa únicamente si la pestaña es nueva y no hay red.
const CLAVE_TOKEN_OFFLINE = "filanex-token-offline";

function getStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getLocal() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function obtenerToken() {
  const enPestana = getStorage()?.getItem(CLAVE_TOKEN);
  if (enPestana) return enPestana;
  // Sin sesión en esta pestaña y sin internet: recuperamos la última sesión
  // del equipo para que la app abra offline (no se puede hacer login sin red).
  if (navigator.onLine) return null;
  const copia = getLocal()?.getItem(CLAVE_TOKEN_OFFLINE);
  if (copia) getStorage()?.setItem(CLAVE_TOKEN, copia);
  return copia ?? null;
}

// Decodifica el payload del JWT sin verificar firma (el backend ya la verifica).
export function payloadToken() {
  const token = obtenerToken();
  if (!token) return null;
  try {
    const cuerpo = token.split(".")[1];
    if (!cuerpo) return null;
    return JSON.parse(atob(cuerpo.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export function rolUsuario() {
  return payloadToken()?.rol || null;
}

export function esAdmin() {
  return rolUsuario() === "admin";
}

export function esSuperAdmin() {
  return !!payloadToken()?.superadmin;
}

export function guardarToken(token) {
  getStorage()?.setItem(CLAVE_TOKEN, token);
  getLocal()?.setItem(CLAVE_TOKEN_OFFLINE, token);
}

export function cerrarSesion() {
  getStorage()?.removeItem(CLAVE_TOKEN);
  getLocal()?.removeItem(CLAVE_TOKEN_OFFLINE);
  location.reload();
}

// Saca el cuerpo de la petición en algo que se pueda guardar en IndexedDB.
async function extraerCuerpo(opciones) {
  const cuerpo = opciones?.body;
  if (!cuerpo) return { datos: null, ficheros: [] };
  if (typeof FormData !== "undefined" && cuerpo instanceof FormData) {
    const datos = {};
    const ficheros = [];
    for (const [campo, valor] of cuerpo.entries()) {
      if (typeof File !== "undefined" && valor instanceof File) {
        ficheros.push({ campo, blob: valor.slice(0, valor.size, valor.type), nombre: valor.name || "foto.jpg" });
      } else if (typeof Blob !== "undefined" && valor instanceof Blob) {
        ficheros.push({ campo, blob: valor, nombre: "foto.jpg" });
      } else {
        datos[campo] = valor;
      }
    }
    return { datos: Object.keys(datos).length ? datos : null, ficheros };
  }
  if (typeof cuerpo === "string") {
    try {
      return { datos: JSON.parse(cuerpo), ficheros: [] };
    } catch {
      return { datos: null, ficheros: [] };
    }
  }
  return { datos: null, ficheros: [] };
}

function respuestaJson(datos, estado = 202) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { "Content-Type": "application/json", "X-Filanex-Cola": "1" },
  });
}

// Instala el wrapper una sola vez, antes de renderizar la app.
export function instalarFetchConSesion() {
  if (window.__fetchConSesion) return;
  window.__fetchConSesion = true;
  const nativo = window.fetch.bind(window);
  window.fetch = async (recurso, opciones = {}) => {
    const url = typeof recurso === "string" ? recurso : recurso?.url ?? "";
    const metodo = String(opciones.method ?? (typeof recurso === "object" ? recurso.method : "") ?? "GET").toUpperCase();
    const token = obtenerToken();
    if (token && url.startsWith("/api")) {
      const headers = new Headers(opciones.headers ?? (typeof recurso === "object" ? recurso.headers : undefined));
      if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
      opciones = { ...opciones, headers };
    }

    try {
      const resp = await nativo(recurso, opciones);
      // Sesión caducada o inválida: fuera el token y a la pantalla de login.
      if (resp.status === 401 && url.startsWith("/api") && !url.startsWith("/api/auth/")) {
        getStorage()?.removeItem(CLAVE_TOKEN);
        location.reload();
      }
      return resp;
    } catch (error) {
      // Sin red. Los envíos de la propia cola vuelven a fallar hacia arriba;
      // ella ya sabe qué hacer.
      if (opciones.__cola || metodo === "GET" || !url.startsWith("/api")) throw error;

      const regla = reglaOffline(metodo, url);
      if (!regla) {
        throw new Error("Sin conexión: esta operación necesita internet. Inténtalo cuando vuelva la red.");
      }

      const { datos, ficheros } = await extraerCuerpo(opciones);
      const sintetica = await encolar({ metodo, url, cuerpo: datos, ficheros, regla });
      return respuestaJson(sintetica);
    }
  };
}
