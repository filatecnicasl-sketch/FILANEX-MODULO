import { useState } from "react";

const MEDIOS = [
  { clave: "telefono", nombre: "Teléfono" },
  { clave: "whatsapp", nombre: "WhatsApp" },
  { clave: "sms", nombre: "SMS" },
  { clave: "email", nombre: "Email" },
  { clave: "en_persona", nombre: "En persona" },
];

function fechaLocalInput(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Se abre al pasar una orden a «finalizado» (recoge el momento de la
// entrega, las fotos del vehículo terminado y si el cliente ya está
// avisado) y también desde las órdenes ya finalizadas, para marcar el
// aviso o corregir la fecha a posteriori.
export default function FinalizarOrdenModal({ orden, onCerrar, onFinalizada }) {
  // Si la orden ya está finalizada/entregada, el modal solo edita la entrega:
  // no se vuelve a tocar el estado (para no bajar una orden "entregada").
  const yaFinalizada = ["finalizado", "entregado"].includes(orden.estado);
  const [fecha, setFecha] = useState(() =>
    orden.entrega?.fecha ? fechaLocalInput(new Date(orden.entrega.fecha)) : fechaLocalInput()
  );
  const [fotos, setFotos] = useState(orden.entrega?.fotos ?? []);
  const [clienteAvisado, setClienteAvisado] = useState(!!orden.entrega?.clienteAvisado);
  const [avisoMedio, setAvisoMedio] = useState(orden.entrega?.avisoMedio ?? "telefono");
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function subirFotos(e) {
    const archivos = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!archivos.length) return;
    setSubiendo(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const a of archivos) fd.append("fotos", a);
      const r = await fetch(`/api/taller/ordenes/${orden._id}/entrega/fotos`, { method: "POST", body: fd });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudieron subir las fotos");
      setFotos(datos.fotos ?? []);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function quitarFoto(ruta) {
    const r = await fetch(`/api/taller/ordenes/${orden._id}/entrega/fotos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruta }),
    });
    const datos = await r.json();
    if (r.ok) setFotos(datos.fotos ?? []);
  }

  async function finalizar() {
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`/api/taller/ordenes/${orden._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(yaFinalizada ? {} : { estado: "finalizado" }),
          entrega: {
            fecha: fecha ? new Date(fecha).toISOString() : undefined,
            clienteAvisado,
            avisoMedio: clienteAvisado ? avisoMedio : undefined,
            fotos,
          },
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo guardar la entrega");
      onFinalizada();
    } catch (e2) {
      setError(e2.message);
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">
          {yaFinalizada ? "Entrega y aviso" : "Finalizar"} · {orden.numero} · {orden.matricula}
        </h2>
        <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Fecha de entrega</label>
            <input
              type="date"
              className="input"
              value={fecha.slice(0, 10)}
              onChange={(e) => setFecha(`${e.target.value}T${fecha.slice(11) || "09:00"}`)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Hora de entrega</label>
            <input
              type="time"
              className="input"
              value={fecha.slice(11)}
              onChange={(e) => setFecha(`${fecha.slice(0, 10)}T${e.target.value}`)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Fotos del vehículo terminado</label>
          <div className="flex flex-wrap gap-2">
            {fotos.map((f) => (
              <span key={f} className="relative group">
                <a href={f} target="_blank" rel="noreferrer">
                  <img src={f} alt="Foto de la entrega" className="h-16 w-16 object-cover rounded-lg border border-slate-600" />
                </a>
                <button
                  type="button"
                  onClick={() => quitarFoto(f)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-600 text-white text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Quitar foto"
                >
                  ✕
                </button>
              </span>
            ))}
            <label className="h-16 w-16 rounded-lg border border-dashed border-slate-600 flex items-center justify-center text-slate-400 hover:text-accent hover:border-accent cursor-pointer text-xs text-center leading-tight px-1">
              <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={subirFotos} disabled={subiendo} />
              {subiendo ? "Subiendo…" : "+ Fotos"}
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-500"
              checked={clienteAvisado}
              onChange={(e) => setClienteAvisado(e.target.checked)}
            />
            Cliente avisado para la recogida
          </label>
          {clienteAvisado && (
            <div className="mt-2 flex items-center gap-2 pl-6">
              <span className="text-xs text-slate-400">Avisado por</span>
              <select className="input !py-1.5 !w-auto text-sm" value={avisoMedio} onChange={(e) => setAvisoMedio(e.target.value)}>
                {MEDIOS.map((m) => (
                  <option key={m.clave} value={m.clave}>{m.nombre}</option>
                ))}
              </select>
              <span className="text-xs text-emerald-400">quedará constancia del aviso</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={finalizar} disabled={guardando || subiendo}>
            {guardando ? "Guardando…" : yaFinalizada ? "Guardar" : "Finalizar orden"}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
