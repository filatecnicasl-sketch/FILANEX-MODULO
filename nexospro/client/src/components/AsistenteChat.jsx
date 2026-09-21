import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// Asistente IA de ayuda (módulo "asistente"). Botón flotante + panel de chat.
// El backend responde con el manual del programa y la configuración real de
// la empresa, así que las respuestas son específicas y no genéricas.

// Preguntas sugeridas según la pantalla en la que está el usuario.
const SUGERENCIAS = [
  ["/taller/valoraciones", ["¿Cómo doy de alta una valoración desde el PDF de la compañía?", "¿Dónde configuro los precios por hora?", "¿Cómo paso una valoración a una orden?"]],
  ["/taller/agenda", ["¿Qué es una cita de peritaje?", "¿Cómo recepciono un vehículo?", "¿Cómo imprimo el justificante de cita?"]],
  ["/taller/ordenes", ["¿Cómo facturo una orden a la aseguradora?", "¿Por qué la orden imprime sin datos?", "¿Cómo añado líneas a la orden?"]],
  ["/taller/cortesia", ["¿Cómo reservo un coche de cortesía?", "¿Cómo imprimo el contrato de cesión?"]],
  ["/taller", ["¿Cuál es el flujo completo de un siniestro?", "¿Cómo se da de alta una aseguradora?"]],
  ["/tpv", ["¿Cómo abro la caja?", "¿Cómo pongo foto y color a las familias?", "¿Cómo imprimo una copia del último ticket?"]],
  ["/facturas", ["¿Cómo hago una factura rectificativa?", "¿Cómo envío la factura por email?", "¿Qué significa el estado de VeriFactu?"]],
  ["/configuracion", ["¿Cómo configuro las series de facturación?", "¿Cómo cambio los precios por hora del taller?", "¿Cómo configuro el correo saliente?"]],
  ["/formatos", ["¿Cómo funciona el editor de formatos?", "¿Cómo duplico un formato para una variante?"]],
  ["/asesoria", ["¿Cómo entran los documentos de mis clientes?", "¿Qué es la bandeja de revisión?"]],
];
const SUGERENCIAS_GENERALES = [
  "¿Cómo configuro las series de facturación?",
  "¿Cómo funciona el editor de formatos de impresión?",
  "No veo los cambios nuevos del programa, ¿qué hago?",
];

function sugerenciasPara(pathname) {
  const hit = SUGERENCIAS.find(([prefijo]) => pathname.startsWith(prefijo));
  return hit ? hit[1] : SUGERENCIAS_GENERALES;
}

// Formato ligero: **negrita** y saltos de línea; listas numeradas tal cual.
function TextoMensaje({ texto }) {
  const lineas = String(texto ?? "").split("\n");
  return (
    <div className="space-y-1">
      {lineas.map((linea, i) => {
        const partes = linea.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={j} className="font-semibold text-white">
              {p.slice(2, -2)}
            </strong>
          ) : (
            <span key={j}>{p}</span>
          )
        );
        return linea.trim() ? (
          <p key={i} className="leading-relaxed">
            {partes}
          </p>
        ) : (
          <div key={i} className="h-1.5" />
        );
      })}
    </div>
  );
}

export default function AsistenteChat() {
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [entrada, setEntrada] = useState("");
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState(null);
  const finRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, pensando, abierto]);

  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 50);
  }, [abierto]);

  async function enviar(texto) {
    const pregunta = String(texto ?? entrada).trim();
    if (!pregunta || pensando) return;
    setError(null);
    setEntrada("");
    const nuevos = [...mensajes, { rol: "usuario", texto: pregunta }];
    setMensajes(nuevos);
    setPensando(true);
    try {
      const r = await fetch("/api/asistente/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajes: nuevos, pagina: pathname }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(datos.error || "No se pudo obtener respuesta");
      setMensajes([...nuevos, { rol: "asistente", texto: datos.respuesta }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setPensando(false);
    }
  }

  function reiniciar() {
    setMensajes([]);
    setError(null);
    setEntrada("");
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        title="Asistente IA: pregúntame cómo hacer cualquier cosa"
        className="no-print fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-accent text-white pl-3.5 pr-4 py-3 shadow-lg shadow-accent/30 hover:brightness-110 transition"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3z" />
          <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
        </svg>
        <span className="text-sm font-semibold">Asistente</span>
      </button>

      {/* Panel de chat */}
      {abierto && (
        <div className="no-print fixed bottom-20 right-5 z-50 w-[min(24rem,calc(100vw-2.5rem))] h-[min(34rem,calc(100vh-7rem))] flex flex-col rounded-2xl border border-slate-700/60 bg-[#0d1626] shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-[#111c30]">
            <div>
              <p className="text-sm font-bold text-white">Asistente FILANEX</p>
              <p className="text-[0.6875rem] text-slate-400">Pregúntame cómo hacer cualquier cosa del programa</p>
            </div>
            <div className="flex items-center gap-1">
              {mensajes.length > 0 && (
                <button
                  type="button"
                  onClick={reiniciar}
                  title="Empezar una conversación nueva"
                  className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                    <path d="M3 4v5h5" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => setAbierto(false)}
                title="Cerrar"
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {mensajes.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 leading-relaxed">
                  Hola, soy el asistente del programa. Conozco todos los módulos y la configuración de tu empresa.
                  Algunas ideas:
                </p>
                <div className="flex flex-col gap-1.5">
                  {sugerenciasPara(pathname).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => enviar(s)}
                      className="text-left text-xs rounded-xl border border-slate-700/60 px-3 py-2 text-slate-300 hover:border-accent hover:text-white transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.map((m, i) =>
              m.rol === "usuario" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent/90 text-white text-sm px-3.5 py-2">
                    {m.texto}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-slate-800/70 border border-slate-700/50 text-sm text-slate-200 px-3.5 py-2.5">
                    <TextoMensaje texto={m.texto} />
                  </div>
                </div>
              )
            )}

            {pensando && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-slate-800/70 border border-slate-700/50 px-3.5 py-2.5 text-sm text-slate-400">
                  Pensando…
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </div>
            )}
            <div ref={finRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
            className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-700/50 bg-[#111c30]"
          >
            <input
              ref={inputRef}
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              placeholder="Escribe tu pregunta…"
              maxLength={2000}
              className="flex-1 rounded-xl bg-slate-900/80 border border-slate-700/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!entrada.trim() || pensando}
              title="Enviar"
              className="rounded-xl bg-accent p-2 text-white disabled:opacity-40 hover:brightness-110 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
