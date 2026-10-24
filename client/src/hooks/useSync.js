import { useEffect, useState, useCallback } from "react";
import { procesarCola, contarPendientes } from "../lib/colaOffline.js";

// Estado de conexión y sincronización offline.
export function useSync() {
  const [online, setOnline] = useState(navigator.onLine);
  const [deCache, setDeCache] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  const refrescar = useCallback(async () => {
    try {
      setPendientes((await contarPendientes()).total);
    } catch {
      setPendientes(0);
    }
  }, []);

  const sincronizar = useCallback(async () => {
    if (!navigator.onLine) return;
    setSincronizando(true);
    try {
      await procesarCola();
    } finally {
      setSincronizando(false);
      await refrescar();
    }
  }, [refrescar]);

  useEffect(() => {
    const arriba = () => { setOnline(true); setDeCache(false); sincronizar(); };
    const abajo = () => setOnline(false);
    window.addEventListener("online", arriba);
    window.addEventListener("offline", abajo);

    const mensaje = (evento) => {
      if (evento.data?.tipo === "filanex:sin-conexion") setDeCache(true);
      if (evento.data?.tipo === "filanex:sync") sincronizar();
    };
    navigator.serviceWorker?.addEventListener("message", mensaje);

    refrescar();
    const intervalo = setInterval(refrescar, 5000);

    return () => {
      window.removeEventListener("online", arriba);
      window.removeEventListener("offline", abajo);
      navigator.serviceWorker?.removeEventListener("message", mensaje);
      clearInterval(intervalo);
    };
  }, [sincronizar, refrescar]);

  return {
    online,
    offline: !online,
    deCache,
    pendientes,
    sincronizando,
    sincronizar,
    refrescar,
  };
}
