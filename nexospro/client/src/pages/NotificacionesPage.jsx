import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Badge } from "../components/ui.jsx";

function IconoCampana() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function Interruptor({ activo, onCambio }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onCambio(!activo)}
      className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 ${
        activo ? "bg-accent" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${
          activo ? "left-[21px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

function FilaAviso({ titulo, descripcion, activo, onCambio, children }) {
  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-line last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-slate-500 mt-0.5">{descripcion}</p>
        {children}
      </div>
      <Interruptor activo={activo} onCambio={onCambio} />
    </div>
  );
}

const TONO_AVISO = { vencida: "red", proxima: "amber", ocr: "cyan", agenda: "green" };
const ETIQUETA_AVISO = { vencida: "Vencida", proxima: "Próxima", ocr: "OCR", agenda: "Agenda" };

export default function NotificacionesPage() {
  const [prefs, setPrefs] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = () =>
    fetch("/api/notificaciones")
      .then((r) => r.json())
      .then((d) => {
        setPrefs(d.prefs);
        setAvisos(d.avisos ?? []);
      })
      .catch(() => setError("No se pudo conectar con la API."));

  useEffect(() => { cargar(); }, []);

  async function guardar() {
    setAviso(null);
    setError(null);
    setGuardando(true);
    try {
      const r = await fetch("/api/notificaciones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo guardar");
      setPrefs(d.prefs);
      await cargar();
      setAviso("Preferencias guardadas.");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <CabeceraPagina
        titulo="Notificaciones"
        descripcion="Avisos internos de vencimientos y de documentos pendientes de validar."
      >
        {prefs && (
          <button onClick={guardar} disabled={guardando} className="btn-primary">
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        )}
      </CabeceraPagina>

      {aviso && <p className="text-sm text-accent mb-4">{aviso}</p>}
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {!prefs ? null : (
        <>
          <div className="panel p-5 mb-5 max-w-3xl">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100 text-amber-600 shrink-0">
                <IconoCampana />
              </span>
              <div>
                <h2 className="text-white font-semibold leading-tight">Avisos activos</h2>
                <p className="text-xs text-slate-500 mt-0.5">Qué quieres que el programa vigile por ti</p>
              </div>
            </div>

            <FilaAviso
              titulo="Facturas vencidas sin cobrar"
              descripcion="Avisa cuando una factura emitida supera su vencimiento sin estar cobrada del todo"
              activo={prefs.vencidas}
              onCambio={(v) => setPrefs({ ...prefs, vencidas: v })}
            />
            <FilaAviso
              titulo="Facturas próximas a vencer"
              descripcion="Avisa unos días antes del vencimiento para que puedas reclamar el cobro"
              activo={prefs.proximas}
              onCambio={(v) => setPrefs({ ...prefs, proximas: v })}
            >
              {prefs.proximas && (
                <label className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                  Avisar
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={prefs.diasProximas}
                    onChange={(e) => setPrefs({ ...prefs, diasProximas: e.target.value })}
                    className="input !w-20 !py-1 text-right num"
                  />
                  días antes del vencimiento
                </label>
              )}
            </FilaAviso>
            <FilaAviso
              titulo="Documentos OCR pendientes"
              descripcion="Avisa cuando Gemini ha registrado facturas o albaranes que esperan tu validación"
              activo={prefs.ocr}
              onCambio={(v) => setPrefs({ ...prefs, ocr: v })}
            />
            <FilaAviso
              titulo="Eventos de la agenda"
              descripcion="Avisa de los eventos y recordatorios de la agenda de facturación. No afecta a las citas de Taller ni Servicio Técnico"
              activo={prefs.agendaEventos}
              onCambio={(v) => setPrefs({ ...prefs, agendaEventos: v })}
            >
              {prefs.agendaEventos && (
                <label className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                  Avisar
                  <input
                    type="number"
                    min="1"
                    max="240"
                    value={prefs.minutosAgenda}
                    onChange={(e) => setPrefs({ ...prefs, minutosAgenda: e.target.value })}
                    className="input !w-20 !py-1 text-right num"
                  />
                  minutos antes del evento
                </label>
              )}
            </FilaAviso>
          </div>

          <div className="panel p-5 max-w-3xl">
            <h2 className="text-white font-semibold mb-3">Avisos ahora mismo</h2>
            {avisos.length === 0 ? (
              <p className="text-sm text-slate-500">Todo en orden: no hay avisos con las preferencias actuales.</p>
            ) : (
              <ul className="space-y-2">
                {avisos.map((a, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                    <Badge tono={TONO_AVISO[a.tipo] ?? "slate"}>{ETIQUETA_AVISO[a.tipo] ?? a.tipo}</Badge>
                    <span className="text-sm text-white flex-1">{a.texto}</span>
                    <Link to={a.enlace} className="text-xs text-accent font-semibold hover:underline shrink-0">
                      Ver
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}
