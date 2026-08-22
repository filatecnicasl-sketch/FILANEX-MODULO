// Sesión: token JWT en localStorage y wrapper global de fetch que añade la
// cabecera Authorization a todas las llamadas /api de la aplicación (las
// páginas usan fetch directo; así no hay que tocarlas una a una).
//
// El mismo wrapper es el que salva el trabajo cuando no hay conexión: si la
// llamada es de las que se pueden guardar para luego (taller, servicio,
// altas rápidas, borradores), se apunta en la cola y se devuelve una
// respuesta que deja seguir a la pantalla como si hubiera ido bien.
import { reglaOffline } from "./rutasOffline.js";
import { encolar } from "./colaOffline.js";

const CLAVE = "filanex-token";

export function obtenerToken() {
  return localStorage.getItem(CLAVE);
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

export function guardarToken(token) {
  localStorage.setItem(CLAVE, token);
}

export function cerrarSesion() {
  localStorage.removeItem(CLAVE);
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
        localStorage.removeItem(CLAVE);
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
