// Informes → Tesorería: informe de conciliaciones bancarias.
import { useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import {
  FiltroFechas, useInforme, TablaInforme, Td, TdNum, BotonImprimir,
  euros, textoPeriodo,
} from "./comun.jsx";
import { Pestanas, useFiltroInforme } from "./InformesVentasPage.jsx";

const PESTANAS = [
  { clave: "conciliaciones", etiqueta: "Conciliaciones bancarias" },
];

const ESTADOS = [
  { clave: "conciliado", etiqueta: "Conciliados" },
  { clave: "pendiente", etiqueta: "Pendientes (sin conciliar)" },
  { clave: "todos", etiqueta: "Todos" },
];

function InformeConciliaciones({ desde, hasta }) {
  const [estado, setEstado] = useState("conciliado");
  const { datos, error, cargando } = useInforme(
    `/api/tesoreria/extractos/informe-conciliaciones?formato=json&estado=${estado}`,
    desde,
    hasta
  );
  const filas = datos?.filas ?? [];
  const t = datos;
  const verPendientes = estado !== "conciliado";

  const descargarCSV = () => {
    const url = `/api/tesoreria/extractos/informe-conciliaciones?formato=csv&estado=${estado}${desde ? `&desde=${desde}` : ""}${hasta ? `&hasta=${hasta}` : ""}`;
    window.open(url, "_blank");
  };

  const columnasImpresion = [
    { etiqueta: "Fecha" }, { etiqueta: "Importe", num: true }, { etiqueta: "Concepto" },
    { etiqueta: "Estado" }, { etiqueta: "Tipo" }, { etiqueta: "Documento" }, { etiqueta: "Tercero" },
    { etiqueta: "Importe doc.", num: true }, { etiqueta: "Cuadra" },
    ...(verPendientes ? [{ etiqueta: "Motivo (si no conciliado)" }] : []),
  ];

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex gap-1">
          {ESTADOS.map((e) => (
            <button
              key={e.clave}
              type="button"
              onClick={() => setEstado(e.clave)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                estado === e.clave
                  ? "bg-accent text-white border-accent"
                  : "border-line text-slate-400 hover:text-slate-200"
              }`}
            >
              {e.etiqueta}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <BotonImprimir
            titulo="Conciliaciones bancarias"
            subtitulo={textoPeriodo(desde, hasta)}
            horizontal
            secciones={[{
              columnas: columnasImpresion,
              filas: filas.map((f) => [
                f.fecha ? new Date(f.fecha).toLocaleDateString("es-ES") : "—",
                euros(f.importe),
                f.concepto,
                f.conciliado ? "Conciliado" : "Pendiente",
                f.tipo,
                f.documento,
                f.tercero,
                f.importeDocumento || "—",
                f.cuadra === null ? "—" : f.cuadra ? "SÍ" : "NO",
                ...(verPendientes ? [f.motivo || ""] : []),
              ]),
              pie: [
                "TOTALES", "", "", "", "", "", "",
                `${filas.filter((f) => f.cuadra).length} de ${filas.length} cuadran`,
                "",
                ...(verPendientes ? [""] : []),
              ],
            }]}
          />
          <button onClick={descargarCSV} className="btn-ghost">
            Descargar CSV
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {t && (
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="panel px-4 py-3">
            <p className="text-slate-500">Movimientos</p>
            <p className="text-xl font-semibold text-white">{t.total}</p>
          </div>
          <div className="panel px-4 py-3">
            <p className="text-slate-500">Cargos</p>
            <p className="text-xl font-semibold text-rose-400">{euros(t.totalCargos)}</p>
          </div>
          <div className="panel px-4 py-3">
            <p className="text-slate-500">Ingresos</p>
            <p className="text-xl font-semibold text-emerald-400">{euros(t.totalIngresos)}</p>
          </div>
          {estado === "conciliado" ? (
            <div className="panel px-4 py-3">
              <p className="text-slate-500">Cuadran</p>
              <p className="text-xl font-semibold text-white">{filas.filter((f) => f.cuadra).length} / {filas.length}</p>
            </div>
          ) : (
            <div className="panel px-4 py-3">
              <p className="text-slate-500">Sin conciliar</p>
              <p className="text-xl font-semibold text-amber-400">{t.totalPendientes}</p>
            </div>
          )}
        </div>
      )}

      <TablaInforme
        cargando={cargando}
        columnas={[
          { etiqueta: "Fecha" },
          { etiqueta: "Importe", num: true },
          { etiqueta: "Concepto" },
          { etiqueta: "Estado" },
          { etiqueta: "Tipo" },
          { etiqueta: "Documento / Tercero" },
          { etiqueta: "Importe doc.", num: true },
          { etiqueta: "Cuadra" },
          ...(verPendientes ? [{ etiqueta: "Motivo" }] : []),
        ]}
        filas={filas.map((f) => (
          <tr key={`${f.fecha}-${f.importe}-${f.concepto}`} className="border-b border-line/60 align-top">
            <Td>{f.fecha ? new Date(f.fecha).toLocaleDateString("es-ES") : "—"}</Td>
            <TdNum className={f.importe < 0 ? "text-rose-400" : "text-emerald-400"}>{euros(f.importe)}</TdNum>
            <Td><p className="max-w-xs truncate" title={f.concepto}>{f.concepto}</p></Td>
            <Td>
              {f.conciliado ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Conciliado</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Pendiente</span>
              )}
            </Td>
            <Td><span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">{f.tipo}</span></Td>
            <Td>
              <p className="text-white">{f.documento}</p>
              {f.tercero && <p className="text-xs text-slate-500">{f.tercero}</p>}
            </Td>
            <TdNum>{f.importeDocumento || "—"}</TdNum>
            <Td>
              {f.cuadra === null ? (
                <span className="text-slate-500">—</span>
              ) : f.cuadra ? (
                <span className="text-emerald-400 text-sm font-medium">SÍ</span>
              ) : (
                <span className="text-rose-400 text-sm font-medium">NO</span>
              )}
            </Td>
            {verPendientes && (
              <Td>
                {!f.conciliado && <p className="max-w-sm text-xs text-slate-400">{f.motivo}</p>}
              </Td>
            )}
          </tr>
        ))}
        pie={t && (
          <>
            <Td fuerte>TOTALES</Td>
            <TdNum fuerte>{euros(t.totalIngresos - t.totalCargos)}</TdNum>
            <Td />
            <Td />
            <Td />
            <Td />
            <Td />
            <Td fuerte>
              {estado === "conciliado" ? `${filas.filter((f) => f.cuadra).length} / ${filas.length}` : `${t.totalPendientes} pend.`}
            </Td>
            {verPendientes && <Td />}
          </>
        )}
      />
    </div>
  );
}

export default function InformesTesoreriaPage() {
  const [pestana, setPestana] = useState("conciliaciones");
  const { desde, hasta, atajo, anyo, cambiarFechas, aplicarAtajo, cambiarAnyo } = useFiltroInforme();

  return (
    <>
      <CabeceraPagina
        titulo="Informes de tesorería"
        descripcion="Conciliaciones bancarias y movimientos vinculados a documentos."
      />

      <Pestanas pestanas={PESTANAS} activa={pestana} onCambio={setPestana} />

      <FiltroFechas
        desde={desde}
        hasta={hasta}
        onCambio={cambiarFechas}
        atajo={atajo}
        onAtajo={aplicarAtajo}
        anyo={anyo}
        onAnyo={cambiarAnyo}
      />

      {pestana === "conciliaciones" && <InformeConciliaciones desde={desde} hasta={hasta} />}
    </>
  );
}
