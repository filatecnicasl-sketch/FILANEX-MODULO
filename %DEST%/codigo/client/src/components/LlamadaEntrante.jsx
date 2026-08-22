import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { euros } from "./ui.jsx";
import { IconTelefono } from "./icons.jsx";

// Popup global de telefonía: escucha los eventos SSE de la centralita
// (webhook /api/telefonia/evento) y muestra la llamada entrante con la
// ficha del contacto reconocido por su número.
export default function LlamadaEntrante() {
  const [aviso, setAviso] = useState(null); // { llamada, contacto, resumen }
  const timerRef = useRef(null);

  useEffect(() => {
    const fuente = new EventSource("/api/telefonia/stream");
    fuente.onmessage = (e) => {
      try {
        const datos = JSON.parse(e.data);
        if (datos.tipo !== "llamada") return;
        const { llamada } = datos;
        clearTimeout(timerRef.current);
        if (llamada.estado === "sonando" || llamada.estado === "en-curso") {
          setAviso(datos);
        } else if (llamada.estado === "perdida") {
          setAviso((a) =>
            a && a.llamada._id === llamada._id
              ? { ...a, llamada: { ...a.llamada, estado: "perdida" } }
              : a
          );
          timerRef.current = setTimeout(() => setAviso(null), 8000);
        } else {
          // atendida/colgada: se cierra solo a los pocos segundos.
          timerRef.current = setTimeout(() => setAviso(null), 3000);
        }
      } catch {
        // evento mal formado: se ignora
      }
    };
    return () => {
      fuente.close();
      clearTimeout(timerRef.current);
    };
  }, []);

  if (!aviso) return null;
  const { llamada, contacto, resumen } = aviso;
  const sonando = llamada.estado === "sonando";
  const perdida = llamada.estado === "perdida";
  const destino = contacto?.tipo === "proveedor" ? "/proveedores" : "/clientes";

  return (
    <div className="fixed bottom-5 right-5 z-[90] w-[340px] no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div
          className={`px-4 py-3 flex items-center gap-3 ${
            perdida ? "bg-rose-500" : sonando ? "bg-accent" : "bg-emerald-500"
          } text-white`}
        >
          <span className={`flex items-center justify-center w-9 h-9 rounded-full bg-white/20 ${sonando ? "animate-pulse" : ""}`}>
            <IconTelefono size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">
              {perdida
                ? "Llamada perdida"
                : sonando
                  ? llamada.direccion === "saliente"
                    ? "Llamando…"
                    : "Llamada entrante"
                  : "En curso"}
            </p>
            <p className="text-[13px] font-semibold tracking-wide opacity-95 num">{llamada.numero}</p>
          </div>
          <button
            onClick={() => setAviso(null)}
            className="text-white/80 hover:text-white text-lg leading-none px-1"
            title="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-3">
          {contacto ? (
            <>
              <p className="text-[15px] font-bold text-slate-800 truncate">{contacto.nombre}</p>
              <p className="text-xs text-slate-500 mb-2">
                {contacto.tipo === "cliente" ? "Cliente" : "Proveedor"}
                {contacto.telefono ? ` · ${contacto.telefono}` : ""}
              </p>
              {contacto.tipo === "cliente" && resumen && (
                <div className="grid grid-cols-3 gap-2 text-center mb-2.5">
                  <div className="rounded-lg bg-slate-50 border border-slate-100 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Pendiente</p>
                    <p className={`text-[13px] font-bold num ${resumen.pendienteCobro > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {euros(resumen.pendienteCobro ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-100 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Facturas</p>
                    <p className="text-[13px] font-bold num text-slate-700">{resumen.facturasPendientes ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-100 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Órdenes</p>
                    <p className="text-[13px] font-bold num text-slate-700">{resumen.ordenesAbiertas ?? 0}</p>
                  </div>
                </div>
              )}
              <Link
                to={destino}
                onClick={() => setAviso(null)}
                className="block text-center text-[12.5px] font-semibold text-accent hover:underline"
              >
                Ver ficha del {contacto.tipo}
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Número no registrado.{" "}
              <Link to="/clientes" onClick={() => setAviso(null)} className="text-accent font-semibold hover:underline">
                Crear cliente
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
