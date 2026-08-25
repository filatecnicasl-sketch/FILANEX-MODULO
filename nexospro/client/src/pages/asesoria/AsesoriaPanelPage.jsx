import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio, euros } from "../../components/ui.jsx";
import { fechaCorta, nombreEstadoDoc, nombreTipo, tonoEstadoDoc, tonoTipo } from "./datos.js";

export default function AsesoriaPanelPage() {
  const [panel, setPanel] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/asesoria/panel")
      .then(async (r) => {
        const datos = await r.json();
        if (!r.ok) throw new Error(datos.error || "Error al cargar el panel");
        setPanel(datos);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <>
        <CabeceraPagina
          titulo="Asesoría"
          descripcion="Cartera de clientes, documentación fiscal y calendario de obligaciones."
        />
        <EstadoVacio titulo="No se pudo cargar la asesoría" descripcion={error} />
      </>
    );
  }
  if (!panel) return null;

  const kpis = [
    { etiqueta: "Clientes en cartera", valor: panel.clientesActivos },
    { etiqueta: "Pendientes de revisar", valor: panel.pendientesRevision, alerta: panel.pendientesRevision > 0 },
    { etiqueta: "Solicitudes sin recibir", valor: panel.solicitudesPendientes, alerta: panel.solicitudesPendientes > 0 },
    { etiqueta: "Documentos del trimestre", valor: panel.documentosTrimestre },
    { etiqueta: `IVA repercutido ${panel.iva.trimestre}T`, valor: euros(panel.iva.repercutido) },
    { etiqueta: `IVA soportado ${panel.iva.trimestre}T`, valor: euros(panel.iva.soportado) },
    {
      etiqueta: "Resultado IVA previsto",
      valor: euros(panel.iva.resultado),
      alerta: panel.iva.resultado > 0,
    },
  ];

  return (
    <>
      <CabeceraPagina
        titulo="Asesoría"
        descripcion="Cartera de clientes, documentación fiscal y calendario de obligaciones."
      >
        <a href="/asesoria/cartera" className="btn-ghost">Cartera</a>
        <a href="/asesoria/documentos" className="btn-primary">Documentos</a>
      </CabeceraPagina>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        {kpis.map((k) => (
          <div key={k.etiqueta} className="panel px-4 py-4">
            <p className={`text-2xl font-extrabold ${k.alerta ? "text-amber-300" : "text-white"}`}>{k.valor}</p>
            <p className="text-xs text-slate-500 mt-1">{k.etiqueta}</p>
          </div>
        ))}
      </div>

      {(panel.alertas?.clientesSinMovimiento?.length > 0 || panel.alertas?.pocaConfianza > 0) && (
        <div className="panel p-5 mb-4 border border-amber-400/20">
          <h2 className="text-white font-semibold mb-3">Avisos</h2>
          <ul className="space-y-2 text-sm">
            {panel.alertas.pocaConfianza > 0 && (
              <li className="flex items-center justify-between gap-3">
                <span className="text-slate-300">
                  {panel.alertas.pocaConfianza} documento(s) pendientes con lectura de IA poco fiable.
                </span>
                <a href="/asesoria/documentos" className="text-xs text-accent hover:underline shrink-0">Revisar</a>
              </li>
            )}
            {panel.alertas.clientesSinMovimiento?.length > 0 && (
              <li className="flex items-start justify-between gap-3">
                <span className="text-slate-300">
                  Sin documentos en 30 días:{" "}
                  {panel.alertas.clientesSinMovimiento.map((c) => c.nombre).join(", ")}
                </span>
                <a href="/asesoria/solicitudes" className="text-xs text-accent hover:underline shrink-0">Pedir</a>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Próximos vencimientos (30 días)</h2>
            <a href="/asesoria/fiscalidad" className="text-xs text-accent hover:underline">Calendario completo</a>
          </div>
          {panel.proximosVencimientos.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Sin vencimientos en los próximos 30 días.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {panel.proximosVencimientos.map((v, i) => (
                <li key={i} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{v.clienteNombre}</p>
                    <p className="text-xs text-slate-500 truncate">
                      Modelo {v.modelo} · {v.nombreModelo}
                    </p>
                  </div>
                  <Badge tono="amber">{fechaCorta(v.fecha)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Últimos documentos</h2>
            <a href="/asesoria/documentos" className="text-xs text-accent hover:underline">Ver todos</a>
          </div>
          {panel.ultimosDocumentos.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Sin documentos todavía. Sube el primero desde «Documentos».
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {panel.ultimosDocumentos.map((d) => (
                <li key={d._id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">
                      {d.clienteAsesoria?.nombre ?? "—"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {nombreTipo(d.tipo)} · {d.tercero ?? "Sin tercero"} · {fechaCorta(d.fecha)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tono={tonoTipo(d.tipo)}>{d.tipo}</Badge>
                    <Badge tono={tonoEstadoDoc(d.estado)}>{nombreEstadoDoc(d.estado)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
