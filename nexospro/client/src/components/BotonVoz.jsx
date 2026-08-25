import { useEffect, useRef, useState } from "react";

// Botón de dictado de citas.
// 1. Pulsa → el navegador transcribe lo que dices (Web Speech API, gratis).
// 2. El texto va a la IA (Gemini) que extrae fecha, hora, cliente, matrícula…
// 3. El formulario se rellena solo; el usuario revisa y guarda.
//
// En los navegadores que no traen reconocimiento de voz (Chrome/Firefox en
// iPhone, algunos Android y navegadores integrados) el botón NO se oculta:
// abre un cuadro de texto donde se puede dictar con el micrófono del teclado
// del móvil o escribir la cita a mano. La interpretación es la misma.

const SR = typeof window !== "undefined"
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

const EJEMPLO = "mañana a las 9, Juan García, 666123456, cambio de aceite del 1234BCD";

export default function BotonVoz({ onResultado, className = "" }) {
  const [estado, setEstado] = useState("idle"); // idle | escuchando | pensando
  const [error, setError] = useState(null);
  const [textoManual, setTextoManual] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const reconocimiento = useRef(null);

  useEffect(() => () => reconocimiento.current?.abort(), []);

  // Manda el texto (dictado o escrito) a la IA y rellena el formulario.
  async function interpretar(texto) {
    if (!texto.trim()) {
      setError("Di o escribe la cita antes de continuar");
      return;
    }
    setEstado("pensando");
    setError(null);
    try {
      const r = await fetch("/api/agenda/interpretar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se entendió la cita");
      onResultado(datos, texto);
      setEscribiendo(false);
      setTextoManual("");
    } catch (e) {
      setError(e.message);
    } finally {
      setEstado("idle");
    }
  }

  function empezar() {
    setError(null);
    const rec = new SR();
    reconocimiento.current = rec;
    rec.lang = "es-ES";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => interpretar(ev.results?.[0]?.[0]?.transcript ?? "");
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed") {
        setError("Permite el micrófono, o usa «Escribir» y dicta con el teclado");
      } else if (ev.error === "service-not-allowed" || ev.error === "language-not-supported") {
        // Algunos móviles no tienen el servicio: se ofrece el modo escrito.
        setEscribiendo(true);
      } else if (ev.error !== "aborted" && ev.error !== "no-speech") {
        setError("No se pudo escuchar. Prueba con «Escribir»");
      }
      setEstado("idle");
    };
    rec.onend = () => setEstado((e) => (e === "escuchando" ? "idle" : e));

    setEstado("escuchando");
    try {
      rec.start();
    } catch {
      setEstado("idle");
      setEscribiendo(true);
    }
  }

  function parar() {
    reconocimiento.current?.stop();
  }

  const pastilla = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition";

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 font-normal ${escribiendo ? "basis-full" : ""} ${className}`}>
      <button
        type="button"
        onClick={
          estado === "escuchando" ? parar : SR ? empezar : () => setEscribiendo((v) => !v)
        }
        disabled={estado === "pensando"}
        title={`Dictar la cita: «${EJEMPLO}»`}
        className={`${pastilla} ${
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
        {estado === "escuchando"
          ? "Escuchando… toca para parar"
          : estado === "pensando"
            ? "Interpretando…"
            : "Dictar por voz"}
      </button>

      {/* Alternativa siempre disponible: dictar con el teclado del móvil. */}
      {SR && !escribiendo && estado === "idle" && (
        <button
          type="button"
          onClick={() => setEscribiendo(true)}
          className="text-xs font-semibold text-slate-400 hover:text-slate-200"
        >
          o escribir
        </button>
      )}

      {error && <span className="text-xs text-rose-400 basis-full">{error}</span>}

      {escribiendo && (
        <div className="basis-full rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-2">
          <p className="text-xs text-slate-400">
            Dicta con el micrófono del teclado del móvil o escríbelo. Ejemplo: «{EJEMPLO}».
          </p>
          <textarea
            rows={3}
            className="input w-full text-sm"
            value={textoManual}
            onChange={(e) => setTextoManual(e.target.value)}
            placeholder="Di o escribe la cita…"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => interpretar(textoManual)}
              disabled={estado === "pensando"}
              className="btn-primary !py-1.5 !px-3.5 text-xs"
            >
              {estado === "pensando" ? "Interpretando…" : "Rellenar la cita"}
            </button>
            <button
              type="button"
              onClick={() => { setEscribiendo(false); setError(null); }}
              className="btn-ghost !py-1.5 !px-3.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
