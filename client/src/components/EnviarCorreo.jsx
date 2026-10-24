import { useEffect, useState } from "react";

function IconoCorreo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

const ETIQUETAS = {
  "presupuesto-venta": "Presupuesto",
  "albaran-venta": "Albarán",
  "factura-venta": "Factura",
};

export default function EnviarCorreo({ email, clienteNombre, tipo, id, numero }) {
  const [abierto, setAbierto] = useState(false);
  const [para, setPara] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!abierto) return;
    const etiqueta = ETIQUETAS[tipo] || "Documento";
    setPara(email || "");
    setAsunto(`${etiqueta} ${numero || ""}`.trim());
    setMensaje(`Hola ${clienteNombre || ""}:\n\nAdjunto le enviamos el ${etiqueta.toLowerCase()} ${numero || ""}.\n\nQuedamos a su disposición.`.replace(/\s+/g, " ").replace(" :\n", ":\n"));
    setError(null);
    setResultado(null);
  }, [abierto, email, clienteNombre, tipo, numero]);

  async function enviar() {
    setEnviando(true);
    setError(null);
    setResultado(null);
    try {
      const respuesta = await fetch("/api/correo/enviar-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id, para, asunto, mensaje }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || "No se pudo enviar el correo");
      setResultado(`Enviado correctamente a ${datos.para || para}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Enviar por correo"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sky-500 hover:text-sky-400 hover:bg-sky-400/10 transition-colors align-middle"
      >
        <IconoCorreo />
      </button>
      {abierto && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setAbierto(false)}>
          <div className="modal-panel w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white">Enviar por correo</h2>
            <p className="text-xs text-slate-500 mt-1">Se adjuntará el PDF generado por FILANEX.</p>
            <div className="grid gap-4 mt-4">
              <div>
                <label className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Para</label>
                <input type="email" className="input w-full" value={para} onChange={(e) => setPara(e.target.value)} />
              </div>
              <div>
                <label className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Asunto</label>
                <input className="input w-full" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
              </div>
              <div>
                <label className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Mensaje</label>
                <textarea className="input w-full min-h-36" value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
              </div>
            </div>
            {resultado && <p className="text-sm text-emerald-400 mt-4">{resultado}</p>}
            {error && <p className="text-sm text-rose-400 mt-4">{error}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-ghost" onClick={() => setAbierto(false)}>Cerrar</button>
              {!resultado && (
                <button type="button" className="btn-primary" disabled={enviando || !para} onClick={enviar}>
                  {enviando ? "Enviando…" : "Enviar correo"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
