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

function InformeConciliaciones({ desde, hasta }) {
  const { datos, error, cargando } = useInforme(`/api/tesoreria/extractos/informe-conciliaciones?formato=json`, desde, hasta);
  const filas = datos?.filas ?? [];
  const t = datos;

  const descargarCSV = () => {
    const url = `/api/tesoreria/extractos/informe-conciliaciones?formato=csv${desde ? `&desde=${desde}` : ""}${hasta ? `&hasta=${hasta}` : ""}`;
    window.open(url, "_blank");
  };

  return (
    <div className="panel p-5">
      <div className="flex justify-end gap-2 mb-2">
        <BotonImprimir
          titulo="Conciliaciones bancarias"
          subtitulo={textoPeriodo(desde, hasta)}
          horizontal
          secciones={[{
            columnas: [
              { etiqueta: "Fecha" }, { etiqueta: "Importe", num: true }, { etiqueta: "Concepto" },
              { etiqueta: "Tipo" }, { etiqueta: "Documento" }, { etiqueta: "Tercero" },
              { etiqueta: "Importe doc.", num: true }, { etiqueta: "Cuadra" },
            ],
            filas: filas.map((f) => [
              f.fecha ? new Date(f.fecha).toLocaleDateString("es-ES") : "—",
              euros(f.importe),
              f.concepto,
              f.tipo,
              f.documento,
              f.tercero,
              f.importeDocumento || "—",
              f.cuadra === null ? "—" : f.cuadra ? "SÍ" : "NO",
            ]),
            pie: [
              "TOTALES", "", "", "", "", "",
              `${filas.filter((f) => f.cuadra).length} de ${filas.length} cuadran`,
              "",
            ],
          }]}
        />
        <button onClick={descargarCSV} className="btn-ghost">
          Descargar CSV
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {t && (
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="panel px-4 py-3">
            <p className="text-slate-500">Conciliaciones</p>
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
          <div className="panel px-4 py-3">
            <p className="text-slate-500">Cuadran</p>
            <p className="text-xl font-semibold text-white">{filas.filter((f) => f.cuadra).length} / {filas.length}</p>
          </div>
        </div>
      )}

      <TablaInforme
        cargando={cargando}
        columnas={[
          { etiqueta: "Fecha" },
          { etiqueta: "Importe", num: true },
          { etiqueta: "Concepto" },
          { etiqueta: "Tipo" },
          { etiqueta: "Documento / Tercero" },
          { etiqueta: "Importe doc.", num: true },
          { etiqueta: "Cuadra" },
        ]}
        filas={filas.map((f) => (
          <tr key={`${f.fecha}-${f.importe}-${f.concepto}`} className="border-b border-line/60 align-top">
            <Td>{f.fecha ? new Date(f.fecha).toLocaleDateString("es-ES") : "—"}</Td>
            <TdNum className={f.importe < 0 ? "text-rose-400" : "text-emerald-400"}>{euros(f.importe)}</TdNum>
            <Td><p className="max-w-xs truncate" title={f.concepto}>{f.concepto}</p></Td>
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
            <Td fuerte>{filas.filter((f) => f.cuadra).length} / {filas.length}</Td>
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
