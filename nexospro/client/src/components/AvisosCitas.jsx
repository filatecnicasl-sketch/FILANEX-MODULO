import { useEffect, useRef, useState } from "react";
import { payloadToken } from "../lib/sesion.js";

// Avisador de la agenda de facturación: mientras la app está abierta, vigila
// los eventos de hoy y avisa unos minutos antes
// con un aviso en pantalla, un sonido y, si el navegador lo permite, una
// notificación del sistema. La antelación se configura en Sistema →
// Notificaciones ("Eventos de la agenda").

const INTERVALO_MS = 30 * 1000;
const CLAVE_AVISADAS = "filanex-eventos-agenda-avisados";

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function leerAvisadas() {
  try {
    const datos = JSON.parse(window.localStorage.getItem(CLAVE_AVISADAS) ?? "{}");
    return datos.dia === hoyLocal() ? new Set(datos.ids ?? []) : new Set();
  } catch {
    return new Set();
  }
}

function guardarAvisadas(ids) {
  try {
    window.localStorage.setItem(CLAVE_AVISADAS, JSON.stringify({ dia: hoyLocal(), ids: [...ids] }));
  } catch {
    return;
  }
}

function sonar() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach((inicio) => {
      const osc = ctx.createOscillator();
      const ganancia = ctx.createGain();
      osc.frequency.value = 880;
      osc.type = "sine";
      ganancia.gain.setValueAtTime(0.001, ctx.currentTime + inicio);
      ganancia.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + inicio + 0.03);
      ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + 0.22);
      osc.connect(ganancia).connect(ctx.destination);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + 0.25);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    return;
  }
}

export default function AvisosCitas() {
  const [alertas, setAlertas] = useState([]);
  const avisadasRef = useRef(leerAvisadas());

  useEffect(() => {
    let cancelado = false;

    async function comprobar() {
      if (!payloadToken()) return; // sin sesión no hay nada que vigilar
      try {
        const rPrefs = await fetch("/api/notificaciones");
        if (!rPrefs.ok) return;
        const { prefs } = await rPrefs.json();
        if (!prefs?.agendaEventos) return;
        const antelacion = Math.max(1, Number(prefs.minutosAgenda) || 15);

        const dia = hoyLocal();
        const rCitas = await fetch(`/api/agenda/proximas?dia=${dia}`);
        if (!rCitas.ok) return;
        const citas = await rCitas.json();

        const ahora = Date.now();
        const nuevas = [];
        for (const cita of citas) {
          const inicio = new Date(`${dia}T${cita.hora}:00`).getTime();
          const restan = (inicio - ahora) / 60000;
          // Avisa dentro de la antelación y hasta 10 min después de la hora
          // (por si se abrió la app justo encima).
          if (restan <= antelacion && restan > -10 && !avisadasRef.current.has(cita._id)) {
            avisadasRef.current.add(cita._id);
            nuevas.push({ ...cita, restan: Math.max(0, Math.round(restan)) });
          }
        }
        if (nuevas.length === 0 || cancelado) return;
        guardarAvisadas(avisadasRef.current);
        sonar();
        setAlertas((actuales) => [...actuales, ...nuevas]);
        if (window.Notification?.permission === "granted") {
          for (const cita of nuevas) {
            const quien = cita.clienteNombre || cita.motivo || "Evento";
            new Notification(`Evento de agenda a las ${cita.hora}`, {
              body: `${quien}${cita.restan > 0 ? ` · en ${cita.restan} min` : " · ahora"}`,
            });
          }
        }
      } catch {
        return; // sin conexión u otro fallo: se reintenta en el siguiente ciclo
      }
    }

    comprobar();
    const temporizador = setInterval(comprobar, INTERVALO_MS);
    return () => {
      cancelado = true;
      clearInterval(temporizador);
    };
  }, []);

  if (alertas.length === 0) return null;

  const puedeNotificar = typeof window !== "undefined" && "Notification" in window;

  return (
    <div className="fixed top-4 right-4 z-[110] flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))]">
      {alertas.map((cita) => (
        <div
          key={cita._id}
          className="rounded-xl border border-accent/40 bg-slate-900/95 px-4 py-3 shadow-xl backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
                <path d="M13.7 20a2 2 0 0 1-3.4 0" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                Evento de agenda a las {cita.hora}
                <span className="ml-2 text-xs font-normal text-accent">
                  {cita.restan > 0 ? `en ${cita.restan} min` : "ahora"}
                </span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Agenda de facturación
                {cita.clienteNombre ? ` · ${cita.clienteNombre}` : ""}
                {cita.motivo ? ` · ${cita.motivo}` : ""}
              </p>
              {puedeNotificar && Notification.permission === "default" && (
                <button
                  type="button"
                  onClick={() => Notification.requestPermission()}
                  className="mt-2 text-[0.6875rem] font-semibold text-accent hover:underline"
                >
                  Activar avisos del navegador para verlos aunque estés en otra pestaña
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setAlertas((actuales) => actuales.filter((a) => a._id !== cita._id))}
              className="shrink-0 text-slate-500 hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
