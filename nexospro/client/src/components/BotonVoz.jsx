import { useEffect, useRef, useState } from "react";

// Botón de dictado de citas por voz.
// 1. Pulsa → el navegador transcribe lo que dices (Web Speech API, gratis).
// 2. El texto va a la IA (Gemini) que extrae fecha, hora, cliente, matrícula…
// 3. El formulario se rellena solo; el usuario revisa y guarda.
// Si el navegador no soporta reconocimiento de voz, el botón no se muestra.

const SR = typeof window !== "undefined"
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

export default function BotonVoz({ onResultado, className = "" }) {
  const [estado, setEstado] = useState("idle"); // idle | escuchando | pensando
  const [error, setError] = useState(null);
  const reconocimiento = useRef(null);

  useEffect(() => () => reconocimiento.current?.abort(), []);

  if (!SR) return null;

  function empezar() {
    setError(null);
    const rec = new SR();
    reconocimiento.current = rec;
    rec.lang = "es-ES";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = async (ev) => {
      const texto = ev.results?.[0]?.[0]?.transcript ?? "";
      setEstado("pensando");
      try {
        const r = await fetch("/api/agenda/interpretar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto }),
        });
        const datos = await r.json();
        if (!r.ok) throw new Error(datos.error || "No se entendió la cita");
        onResultado(datos, texto);
      } catch (e) {
        setError(e.message);
      } finally {
        setEstado("idle");
      }
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed") setError("Permite el micrófono en el navegador para dictar citas");
      else if (ev.error !== "aborted") setError("No se pudo escuchar. Inténtalo de nuevo");
      setEstado("idle");
    };
    rec.onend = () => setEstado((e) => (e === "escuchando" ? "idle" : e));

    setEstado("escuchando");
    rec.start();
  }

  function parar() {
    reconocimiento.current?.stop();
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={estado === "escuchando" ? parar : empezar}
        disabled={estado === "pensando"}
        title="Dictar la cita con la voz: «mañana a las 9, Juan García, 666123456, cambio de aceite del 1234BCD»"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          estado === "escuchando"
            ? "bg-rose-500 text-white animate-pulse"
            : estado === "pensando"
              ? "bg-amber-500/20 text-amber-300 cursor-wait"
              : "bg-teal-500/15 text-teal-300 hover:bg-teal-500/25"
        }`}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
        </svg>
        {estado === "escuchando" ? "Escuchando… toca para parar" : estado === "pensando" ? "Interpretando…" : "Dictar por voz"}
      </button>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </span>
  );
}
