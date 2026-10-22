import { useEffect, useState } from "react";
import { enModoSoporte } from "../lib/sesion.js";

// Aviso de mantenimiento programado: banner amarillo en la parte superior del
// programa, visible para todos los clientes desde que se despliega hasta la
// hora de fin de la ventana. Se puede cerrar (no vuelve a salir en ese
// navegador hasta el día siguiente) y desaparece solo al pasar la fecha.
const INICIO = new Date("2026-10-22T08:00:00");
const FIN = new Date("2026-10-24T15:00:00");
const CLAVE_VISTO = "filanex-mantenimiento-2026-10-24";

export default function AvisoMantenimiento() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // El soporte no necesita el aviso; y si ya está fuera de la ventana de
    // aviso (antes del inicio o pasada la hora de fin) no se muestra.
    if (enModoSoporte()) return;
    const ahora = new Date();
    if (ahora < INICIO || ahora >= FIN) return;
    // Cerrado hoy → no molestar más hasta mañana (el sábado vuelve a salir).
    if (localStorage.getItem(CLAVE_VISTO) === ahora.toDateString()) return;
    setVisible(true);
  }, []);

  function cerrar() {
    setVisible(false);
    localStorage.setItem(CLAVE_VISTO, new Date().toDateString());
  }

  if (!visible) return null;

  return (
    <div className="no-print bg-amber-100 border-b border-amber-300 text-amber-900">
      <div className="max-w-[100rem] mx-auto px-3 py-2 sm:px-6 flex items-start gap-3">
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 mt-0.5 text-amber-600" aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
        <p className="text-sm leading-relaxed">
          <b>Mantenimiento programado:</b> el próximo <b>sábado 24 de octubre, de 8:00 a 15:00</b>,
          realizaremos mejoras en el programa y puede que no esté disponible o funcione de forma
          intermitente durante esa franja. <b>No se perderá ningún dato.</b> Te recomendamos evitar
          tareas importantes (facturar, imprimir…) en esas horas. Gracias por tu paciencia.
        </p>
        <button
          type="button"
          onClick={cerrar}
          className="shrink-0 ml-auto self-center rounded-lg border border-amber-400 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200 transition-colors"
          title="Cerrar el aviso (no volverá a salir hoy)"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
