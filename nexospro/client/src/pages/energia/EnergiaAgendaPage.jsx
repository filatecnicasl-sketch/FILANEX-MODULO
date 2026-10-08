import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";

const fmtFecha = (f) =>
  f ? new Date(f).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtEuro = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n ?? 0);

// Color de la chapa de meses: 7 aún hay margen, 10 es llama ya.
function tonoMeses(meses) {
  if (meses >= 10) return "bg-rose-100 text-rose-700 border-rose-200";
  if (meses >= 9) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function tonoAviso(aviso) {
  if (aviso === 1) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (aviso === 2) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-rose-100 text-rose-700 border-rose-200";
}

function Fila({ izquierda, chapas, derecha, telefono }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-slate-800 truncate">{izquierda}</p>
        <p className="text-xs text-slate-500 num truncate">{derecha}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {telefono && <span className="text-xs text-slate-500 num whitespace-nowrap">{telefono}</span>}
        {chapas}
      </div>
    </li>
  );
}

function Chapa({ tono, children, title }) {
  return (
    <span
      title={title}
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${tono}`}
    >
      {children}
    </span>
  );
}

// Agenda automática del canal: suministros a 7-10 meses del alta (llamar para
// renovar), contratos con fecha de fin próxima y estudios sin respuesta.
export default function EnergiaAgendaPage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/energia/alertas")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error al cargar la agenda"))))
      .then(setDatos)
      .catch((e) => {
        setError(e.message);
        setDatos({ renovaciones: [], porAntiguedad: [], estudiosSinRespuesta: [], total: 0 });
      });
  }, []);

  const vacio =
    datos &&
    datos.total === 0 &&
    datos.renovaciones.length === 0 &&
    datos.porAntiguedad.length === 0 &&
    datos.estudiosSinRespuesta.length === 0 &&
    (datos.anomalias?.length ?? 0) === 0;

  const fmtCo2 = (kg) =>
    kg >= 1000 ? `${(kg / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} t CO2e` : `${Number(kg ?? 0).toLocaleString("es-ES")} kg CO2e`;

  return (
    <CabeceraPagina
      titulo="Agenda"
      descripcion="Lo que hay que hacer hoy: suministros a punto de cumplir 7-10 meses desde el alta, contratos por renovar y estudios sin respuesta."
    >
      {error && <div className="panel px-4 py-3 text-sm text-rose-400 mb-3">{error}</div>}

      {datos === null ? (
        <div className="panel px-4 py-10 text-center text-slate-500">Cargando…</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Renovar por antigüedad: 7-10 meses desde el alta */}
          <div className="panel p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">Llamar para renovar</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {datos.porAntiguedad.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Suministros con 7 a 10 meses desde el alta: la ventana para renovar el contrato antes
              de que cumpla el año.
            </p>
            {datos.porAntiguedad.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                Ningún suministro está en la ventana de renovación. Se llenará solo según la fecha
                de alta de cada contrato.
              </p>
            ) : (
              <ul>
                {datos.porAntiguedad.map((s) => (
                  <Fila
                    key={s._id}
                    izquierda={s.clienteNombre ?? "Sin cliente"}
                    derecha={`${s.cups} · ${s.comercializadoraNombre ?? "—"} · aniversario ${fmtFecha(s.aniversario)}`}
                    telefono={s.telefono}
                    chapas={
                      <>
                        <Chapa tono={tonoMeses(s.meses)} title="Meses desde el alta del suministro">
                          {s.meses} meses
                        </Chapa>
                        <Chapa tono="bg-slate-100 text-slate-600 border-slate-200" title="Meses que faltan para el aniversario">
                          faltan {s.faltanMeses}
                        </Chapa>
                      </>
                    }
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Contratos por fecha de fin */}
          <div className="panel p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">Contratos por renovar</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {datos.renovaciones.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Contratos con fecha de fin en los próximos 2 meses. Se generan 3 avisos automáticos: a 2 meses, a 1 mes y a 15 días.
            </p>
            {datos.renovaciones.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                Ninguna fecha de fin próxima. Rellena el campo «Fin del contrato» en cada suministro
                para que avise.
              </p>
            ) : (
              <ul>
                {datos.renovaciones.map((s) => (
                  <Fila
                    key={s._id}
                    izquierda={s.clienteNombre ?? "Sin cliente"}
                    derecha={`${s.cups} · ${s.comercializadoraNombre ?? "—"} · fin ${fmtFecha(s.fechaFin)}`}
                    telefono={s.telefono}
                    chapas={
                      <>
                        <Chapa
                          tono={s.dias < 0 ? "bg-rose-100 text-rose-700 border-rose-200" : s.dias <= 30 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}
                          title="Días hasta el fin del contrato"
                        >
                          {s.dias < 0 ? "vencido" : `${s.dias} días`}
                        </Chapa>
                        {s.aviso && (
                          <Chapa tono={tonoAviso(s.aviso)} title="Aviso de renovación que toca">
                            {s.etiqueta}
                          </Chapa>
                        )}
                      </>
                    }
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Estudios sin respuesta */}
          <div className="panel p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">Estudios sin respuesta</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {datos.estudiosSinRespuesta.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Estudios enviados hace más de una semana que siguen sin contestar.
            </p>
            {datos.estudiosSinRespuesta.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                Ningún estudio pendiente de respuesta.
              </p>
            ) : (
              <ul>
                {datos.estudiosSinRespuesta.map((e) => (
                  <Fila
                    key={e._id}
                    izquierda={e.clienteNombre ?? "Sin cliente"}
                    derecha={`${e.comercializadoraNombre ?? "—"} · ahorro ofrecido ${fmtEuro(e.ahorroAnual)}/año`}
                    telefono={e.telefono}
                    chapas={
                      <Chapa tono="bg-amber-100 text-amber-700 border-amber-200" title="Días desde el envío">
                        {e.dias} días
                      </Chapa>
                    }
                  />
                ))}
              </ul>
            )}
            <Link to="/energia/estudios" className="inline-block mt-3 text-xs font-medium text-sky-700 hover:underline">
              Ir a los estudios
            </Link>
          </div>

          {/* Consumos anómalos: revisión de factura / llamada al cliente */}
          {datos.anomalias?.length > 0 && (
            <div className="panel p-5 lg:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-slate-800">Consumos anómalos</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {datos.anomalias.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                El último mes apuntado sube 25 % o más sobre su media: posible fuga, avería o cambio de
                actividad. Revisa la factura y llama al cliente.
              </p>
              <ul>
                {datos.anomalias.map((a) => (
                  <Fila
                    key={`${a._id}-${a.periodo}`}
                    izquierda={a.clienteNombre ?? "Sin cliente"}
                    derecha={`${a.cups} · ${a.periodo}: ${a.kwh.toLocaleString("es-ES")} kWh frente a una media de ${a.mediaKwh.toLocaleString("es-ES")}`}
                    telefono={a.telefono}
                    chapas={
                      <Chapa tono="bg-rose-100 text-rose-700 border-rose-200" title="Subida sobre la media de los 12 meses anteriores">
                        +{a.desviacionPct} %
                      </Chapa>
                    }
                  />
                ))}
              </ul>
            </div>
          )}

          {vacio && (
            <div className="lg:col-span-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Todo al día: no hay suministros en ventana de renovación, fechas de fin próximas, consumos
              anómalos ni estudios sin respuesta.
            </div>
          )}

          {datos.co2Kg > 0 && (
            <p className="lg:col-span-3 text-xs text-slate-500 text-center">
              Huella de CO2 estimada de la cartera (últimos 12 meses): <b className="text-slate-600">{fmtCo2(datos.co2Kg)}</b> — luz 0,19 y gas 0,202 kg CO2e/kWh, factores orientativos.
            </p>
          )}
        </div>
      )}
    </CabeceraPagina>
  );
}
