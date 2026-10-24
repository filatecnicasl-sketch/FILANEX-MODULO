import { useState } from "react";

function IconoWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.4-4.7a8.5 8.5 0 1 1 16.1-4.1Z" />
      <path d="M8.2 7.8c.3-.5.6-.5.9-.5h.4l.7 1.8c.1.3 0 .5-.2.7l-.5.6c.8 1.7 2.1 2.8 3.8 3.5l.6-.7c.2-.2.4-.3.7-.2l1.8.8c.3.1.4.4.4.7-.1 1.1-.9 2-2 2.2-1.7.2-4.2-1-6-2.7-1.8-1.8-3.1-4.4-2.8-6.1.1-.4.2-.7.2-.8Z" />
    </svg>
  );
}

export default function EnviarWhatsApp({ telefono, cliente, clienteNombre, tipo, id, numero }) {
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/whatsapp/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono, cliente, clienteNombre, tipo, id, numero }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || "No se pudo preparar el WhatsApp");
      setEnviado(true);
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
        onClick={() => {
          setAbierto(true);
          setError(null);
          setEnviado(false);
        }}
        title="Enviar por WhatsApp"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-emerald-500 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors align-middle"
      >
        <IconoWhatsApp />
      </button>
      {abierto && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setAbierto(false)}>
          <div className="modal-panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white">Enviar por WhatsApp</h2>
            <p className="text-sm text-slate-400 mt-2">
              Se enviará una plantilla oficial de FILANEX a <strong className="text-white">{telefono || "sin teléfono"}</strong>.
            </p>
            {numero && <p className="text-sm text-slate-300 mt-2">Documento: {numero}</p>}
            <p className="text-xs text-slate-500 mt-3">
              Solo se enviará si la empresa tiene WhatsApp conectado, la plantilla está aprobada y el cliente ha autorizado esta comunicación.
            </p>
            {enviado && <p className="text-sm text-emerald-400 mt-4">Mensaje añadido a la cola de envío.</p>}
            {error && <p className="text-sm text-rose-400 mt-4">{error}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-ghost" onClick={() => setAbierto(false)}>Cerrar</button>
              {!enviado && (
                <button type="button" className="btn-primary" disabled={enviando || !telefono} onClick={enviar}>
                  {enviando ? "Preparando…" : "Confirmar envío"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}