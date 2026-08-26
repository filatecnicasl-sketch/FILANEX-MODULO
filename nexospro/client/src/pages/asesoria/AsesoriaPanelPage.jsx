import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { EstadoVacio, euros } from "../../components/ui.jsx";
import { fechaCorta, nombreEstadoDoc, nombreTipo, tonoEstadoDoc, tonoTipo } from "./datos.js";
import { IconClientes, IconLibro, IconNotificaciones, IconFacturaRecibida } from "../../components/icons.jsx";

const TONOS_TARJETA = {
  sky: { fondo: "bg-sky-50", borde: "border-sky-200", texto: "text-sky-700", icono: "bg-sky-100 text-sky-600" },
  emerald: { fondo: "bg-emerald-50", borde: "border-emerald-200", texto: "text-emerald-700", icono: "bg-emerald-100 text-emerald-600" },
  amber: { fondo: "bg-amber-50", borde: "border-amber-200", texto: "text-amber-700", icono: "bg-amber-100 text-amber-600" },
  rose: { fondo: "bg-rose-50", borde: "border-rose-200", texto: "text-rose-700", icono: "bg-rose-100 text-rose-600" },
  indigo: { fondo: "bg-indigo-50", borde: "border-indigo-200", texto: "text-indigo-700", icono: "bg-indigo-100 text-indigo-600" },
  violet: { fondo: "bg-violet-50", borde: "border-violet-200", texto: "text-violet-700", icono: "bg-violet-100 text-violet-600" },
};

function TarjetaGrande({ titulo, valor, detalle, tono, to, Icono, alerta }) {
  const t = TONOS_TARJETA[tono];
  return (
    <Link to={to} className="block group">
      <div className={`rounded-2xl border ${t.borde} ${t.fondo} p-5 transition-all duration-150 group-hover:shadow-md group-hover:-translate-y-0.5`}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{titulo}</p>
          <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${t.icono}`}>
            <Icono />
          </span>
        </div>
        <p className={`text-[1.875rem] leading-tight font-extrabold tracking-tight mt-3 tabular-nums ${alerta ? "text-rose-600" : t.texto}`}>
          {valor}
        </p>
        <p className="text-xs text-slate-500 mt-1.5">{detalle}</p>
      </div>
    </Link>
  );
}

function TarjetaContador({ etiqueta, valor, enlace, alerta }) {
  return (
    <Link to={enlace} className="block group">
      <div className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-150 group-hover:shadow-sm group-hover:-translate-y-0.5">
        <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-slate-400">{etiqueta}</p>
        <p className={`text-2xl font-extrabold tracking-tight mt-2 tabular-nums ${alerta ? "text-amber-600" : "text-slate-800"}`}>{valor}</p>
      </div>
    </Link>
  );
}

function BadgeClaro({ tono, children }) {
  const tonos = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    sky: "bg-sky-100 text-sky-700",
    slate: "bg-slate-100 text-slate-600",
    indigo: "bg-indigo-100 text-indigo-700",
    violet: "bg-violet-100 text-violet-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-medium ${tonos[tono] || tonos.slate}`}>
      {children}
    </span>
  );
}

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

  return (
    <>
      <CabeceraPagina
        titulo="Asesoría"
        descripcion="Cartera de clientes, documentación fiscal y calendario de obligaciones."
      >
        <Link to="/asesoria/cartera" className="btn-ghost">Cartera</Link>
        <Link to="/asesoria/documentos" className="btn-primary">Documentos</Link>
      </CabeceraPagina>

      {/* Tarjetas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <TarjetaGrande
          titulo="Clientes en cartera"
          valor={panel.clientesActivos}
          detalle="Empresas asesoradas"
          tono="sky"
          to="/asesoria/cartera"
          Icono={IconClientes}
        />
        <TarjetaGrande
          titulo="Documentos del trimestre"
          valor={panel.documentosTrimestre}
          detalle={`Trimestre ${panel.iva.trimestre} en curso`}
          tono="indigo"
          to="/asesoria/documentos"
          Icono={IconLibro}
        />
        <TarjetaGrande
          titulo="IVA repercutido"
          valor={euros(panel.iva.repercutido)}
          detalle={`Trimestre ${panel.iva.trimestre}`}
          tono="emerald"
          to="/asesoria/libros-iva"
          Icono={IconFacturaRecibida}
        />
        <TarjetaGrande
          titulo="Resultado IVA"
          valor={euros(panel.iva.resultado)}
          detalle={panel.iva.resultado > 0 ? "A ingresar" : "A compensar"}
          tono={panel.iva.resultado > 0 ? "amber" : "violet"}
          to="/asesoria/prevision"
          Icono={IconFacturaRecibida}
          alerta={panel.iva.resultado > 0}
        />
      </div>

      {/* Contadores secundarios */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <TarjetaContador
          etiqueta="Pendientes de revisar"
          valor={panel.pendientesRevision}
          enlace="/asesoria/documentos"
          alerta={panel.pendientesRevision > 0}
        />
        <TarjetaContador
          etiqueta="Solicitudes sin recibir"
          valor={panel.solicitudesPendientes}
          enlace="/asesoria/solicitudes"
          alerta={panel.solicitudesPendientes > 0}
        />
        <TarjetaContador
          etiqueta="IVA soportado"
          valor={euros(panel.iva.soportado)}
          enlace="/asesoria/libros-iva"
        />
        <TarjetaContador
          etiqueta="Cierres trimestre"
          valor={`${panel.iva.trimestre}T`}
          enlace="/asesoria/cierres"
        />
      </div>

      {/* Avisos */}
      {(panel.alertas?.clientesSinMovimiento?.length > 0 || panel.alertas?.pocaConfianza > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-6">
          <h2 className="text-sm font-semibold text-amber-800 mb-3">Avisos</h2>
          <ul className="space-y-2 text-sm">
            {panel.alertas.pocaConfianza > 0 && (
              <li className="flex items-center justify-between gap-3">
                <span className="text-amber-700">
                  {panel.alertas.pocaConfianza} documento(s) pendientes con lectura de IA poco fiable.
                </span>
                <Link to="/asesoria/documentos" className="text-xs text-amber-600 hover:underline shrink-0 font-medium">Revisar →</Link>
              </li>
            )}
            {panel.alertas.clientesSinMovimiento?.length > 0 && (
              <li className="flex items-start justify-between gap-3">
                <span className="text-amber-700">
                  Sin documentos en 30 días:{" "}
                  {panel.alertas.clientesSinMovimiento.map((c) => c.nombre).join(", ")}
                </span>
                <Link to="/asesoria/solicitudes" className="text-xs text-amber-600 hover:underline shrink-0 font-medium">Pedir →</Link>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-[0.875rem] font-semibold text-slate-800">Próximos vencimientos (30 días)</h2>
            <Link to="/asesoria/fiscalidad" className="text-xs text-accent hover:underline font-medium">Calendario →</Link>
          </div>
          {panel.proximosVencimientos.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">Sin vencimientos en los próximos 30 días.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {panel.proximosVencimientos.map((v, i) => (
                <li key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{v.clienteNombre}</p>
                    <p className="text-xs text-slate-400 truncate">
                      Modelo {v.modelo} · {v.nombreModelo}
                    </p>
                  </div>
                  <BadgeClaro tono="amber">{fechaCorta(v.fecha)}</BadgeClaro>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-[0.875rem] font-semibold text-slate-800">Últimos documentos</h2>
            <Link to="/asesoria/documentos" className="text-xs text-accent hover:underline font-medium">Ver todos →</Link>
          </div>
          {panel.ultimosDocumentos.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              Sin documentos todavía. Sube el primero desde «Documentos».
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {panel.ultimosDocumentos.map((d) => (
                <li key={d._id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {d.clienteAsesoria?.nombre ?? "—"}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {nombreTipo(d.tipo)} · {d.tercero ?? "Sin tercero"} · {fechaCorta(d.fecha)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <BadgeClaro tono={tonoTipo(d.tipo)}>{d.tipo}</BadgeClaro>
                    <BadgeClaro tono={tonoEstadoDoc(d.estado)}>{nombreEstadoDoc(d.estado)}</BadgeClaro>
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
