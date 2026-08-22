import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import FormDocumento from "../components/FormDocumento.jsx";
import { Badge, InputBusqueda, coincideBusqueda, euros } from "../components/ui.jsx";
import { IconImprimir, IconPdf } from "../components/icons.jsx";
import { imprimirDocumento } from "../utils/imprimir.js";
import { descargarPdf, imprimirDocumentoRapido } from "../utils/pdf.js";

const TONO = {
  borrador: "slate",
  enviado: "cyan",
  aceptado: "green",
  rechazado: "red",
  facturado: "amber",
};

export default function PresupuestosPage() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");

  // Filtra por todos los campos visibles de la tabla.
  const filtrada = presupuestos.filter((p) =>
    coincideBusqueda(
      q,
      p.serieNumero,
      p.cliente?.nombre,
      p.cliente?.nif,
      p.fecha ? new Date(p.fecha).toLocaleDateString("es-ES") : "",
      euros(p.total),
      p.total,
      p.estado
    )
  );

  async function cargar() {
    try {
      const [rp, rc] = await Promise.all([
        fetch("/api/presupuestos"),
        fetch("/api/clientes"),
      ]);
      setPresupuestos(await rp.json());
      setClientes(await rc.json());
    } catch {
      setError("No se pudo conectar con la API.");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function marcarEstado(id, estado) {
    await fetch(`/api/presupuestos/${id}/estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    await cargar();
  }

  async function facturar(id) {
    const r = await fetch(`/api/presupuestos/${id}/facturar`, { method: "POST" });
    if (r.ok) await cargar();
    else setError((await r.json()).error);
  }

  async function convertirAlbaran(id) {
    const r = await fetch(`/api/presupuestos/${id}/albaran`, { method: "POST" });
    if (r.ok) await cargar();
    else setError((await r.json()).error);
  }

  return (
    <>
      <CabeceraPagina
        titulo="Presupuestos"
        descripcion="Presupuestos a clientes: cuando se aceptan se convierten en factura con un clic."
      >
        <button onClick={() => window.print()} className="btn-ghost">
          Imprimir
        </button>
        <button
          onClick={() => setMostrarForm(true)}
          className="btn-primary"
        >
          Nuevo presupuesto
        </button>
      </CabeceraPagina>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {mostrarForm && (
        <FormDocumento
          titulo="Nuevo presupuesto"
          clientes={clientes}
          url="/api/presupuestos"
          onCreado={() => { setMostrarForm(false); cargar(); }}
          onCerrar={() => setMostrarForm(false)}
        />
      )}

      {presupuestos.length === 0 ? (
        <div className="panel p-8 text-center text-slate-500 text-sm">
          Sin presupuestos todavía.
        </div>
      ) : (
        <>
          <div className="mb-3">
            <InputBusqueda value={q} onChange={setQ} />
          </div>
        <div className="panel overflow-x-auto">
          <table className="tabla text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th className="px-3.5 py-3">Nº</th>
                <th className="px-3.5 py-3">Cliente</th>
                <th className="px-3.5 py-3">Fecha</th>
                <th className="px-3.5 py-3 text-right">Total</th>
                <th className="px-3.5 py-3">Estado</th>
                <th className="px-3.5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtrada.map((p) => (
                <tr key={p._id}>
                  <td className="px-3.5 py-3 text-white font-medium">{p.serieNumero}</td>
                  <td className="px-3.5 py-3 text-slate-300">{p.cliente?.nombre ?? "—"}</td>
                  <td className="px-3.5 py-3 text-slate-400">
                    {new Date(p.fecha).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-3.5 py-3 text-right text-white">{euros(p.total)}</td>
                  <td className="px-3.5 py-3"><Badge tono={TONO[p.estado]}>{p.estado}</Badge></td>
                  <td className="px-3.5 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => imprimirDocumentoRapido("presupuesto-venta", p._id)}
                      title="Imprimir"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle"
                    >
                      <IconImprimir />
                    </button>
                    <button
                      onClick={() => descargarPdf("presupuesto-venta", p._id, p.serieNumero)}
                      title="Descargar PDF"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle"
                    >
                      <IconPdf />
                    </button>
                    {["borrador", "enviado"].includes(p.estado) && (
                      <>
                        <button onClick={() => marcarEstado(p._id, "aceptado")}
                          className="text-xs bg-emerald-400/10 text-emerald-300 px-2 py-1 rounded-lg hover:bg-emerald-400/20">Aceptar</button>
                        <button onClick={() => marcarEstado(p._id, "rechazado")}
                          className="text-xs bg-red-400/10 text-red-300 px-2 py-1 rounded-lg hover:bg-red-400/20">Rechazar</button>
                      </>
                    )}
                    {p.estado !== "facturado" && !p.albaranVenta && (
                      <>
                        <button onClick={() => convertirAlbaran(p._id)}
                          className="text-xs bg-sky-400/10 text-sky-300 px-2 py-1 rounded-lg hover:bg-sky-400/20">→ Albarán</button>
                        <button onClick={() => facturar(p._id)}
                          className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-lg hover:bg-accent/20">→ Factura</button>
                      </>
                    )}
                    {p.albaranVenta && p.estado !== "facturado" && (
                      <Badge tono="sky">albarán creado</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {filtrada.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3.5 py-8 text-center text-slate-500">
                    Sin resultados para «{q}».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}
    </>
  );
}
