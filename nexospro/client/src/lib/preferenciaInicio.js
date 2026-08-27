import { payloadToken } from "./sesion.js";

const PREFIJO = "filanex-inicio";

function clave() {
  const usuario = payloadToken();
  if (!usuario?.sub) return null;
  return `${PREFIJO}:${usuario.tid ?? usuario.t ?? "empresa"}:${usuario.sub}`;
}

export function obtenerInicioDispositivo(valorPorDefecto = "panel") {
  try {
    const id = clave();
    return (id && window.localStorage.getItem(id)) || valorPorDefecto;
  } catch {
    return valorPorDefecto;
  }
}

export function guardarInicioDispositivo(inicio) {
  try {
    const id = clave();
    if (id) window.localStorage.setItem(id, inicio);
  } catch {
    return;
  }
}