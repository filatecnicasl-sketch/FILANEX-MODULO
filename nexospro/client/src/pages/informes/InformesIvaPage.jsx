// Informes → IVA: resumen de IVA repercutido (ventas) y soportado (compras
// más la parte deducible de los tickets) entre fechas, con el resultado que
// anticipa el modelo 303 del trimestre.
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { FiltroFechas, useInforme, TablaInforme, Td, TdNum, BotonCSV, BotonImprimir, euros, textoPeriodo } from "./comun.jsx";
import { useFiltroInforme } from "./InformesVentasPage.jsx";

function TablaIva({ titulo, filas, total, nombre }) {
  return (
    <div className="panel p-5 flex-1 min-w-[280px]">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-white font-semibold">{titulo}</h2>
        <BotonCSV
          nombre={nombre}
          cabeceras={["Tipo", "Base", "Cuota"]}
          filas={filas.map((f) => [`${f.tipo} %`, f.base, f.cuota])}
        />
      </div>
      <TablaInforme
        cargando={false}
        columnas={[
          { etiqueta: "Tipo" },
          { etiqueta: "Base", num: true },
          { etiqueta: "Cuota", num: true },
        ]}
        filas={filas.map((f) => (
          <tr key={f.tipo} className="border-b border-line/60">
            <Td>{f.tipo} %</Td>
            <TdNum>{euros(f.base)}</TdNum>
            <TdNum fuerte>{euros(f.cuota)}</TdNum>
          </tr>
        ))}
        pie={
          <>
            <Td>TOTAL</Td>
            <TdNum fuerte>{euros(filas.reduce((s, f) => s + f.base, 0))}</TdNum>
            <TdNum fuerte>{euros(total)}</TdNum>
          </>
        }
        vacio="Sin movimientos en este periodo."
      />
    </div>
  );
}

export default function InformesIvaPage() {
  const { desde, hasta, atajo, cambiarFechas, aplicarAtajo } = useFiltroInforme();
  const { datos, error, cargando } = useInforme("/api/informes/iva", desde, hasta);

  const resultado = datos?.resultado ?? 0;
  const aPagar = resultado >= 0;

  return (
    <>
      <CabeceraPagina
        titulo="Resumen de IVA"
        descripcion="IVA repercutido y soportado entre fechas: la base del modelo 303 trimestral."
      />
      <FiltroFechas desde={desde} hasta={hasta} onCambio={cambiarFechas} atajo={atajo} onAtajo={aplicarAtajo} />

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      {cargando ? (
        <p className="text-sm text-slate-500 py-8 text-center">Cargando…</p>
      ) : datos ? (
        <>
          <div className="flex justify-end mb-3">
            <BotonImprimir
              titulo="Resumen de IVA"
              subtitulo={textoPeriodo(desde, hasta)}
              notaFinal="Orientativo para preparar el modelo 303: no incluye recargo de equivalencia ni operaciones especiales. Revísalo con tu asesor antes de presentar."
              secciones={[
                {
                  titulo: "IVA repercutido (ventas)",
                  columnas: [{ etiqueta: "Tipo" }, { etiqueta: "Base", num: true }, { etiqueta: "Cuota", num: true }],
                  filas: datos.repercutido.map((f) => [`${f.tipo} %`, euros(f.base), euros(f.cuota)]),
                  pie: ["TOTAL", euros(datos.repercutido.reduce((s, f) => s + f.base, 0)), euros(datos.totalRepercutido)],
                },
                {
                  titulo: "IVA soportado (compras)",
                  columnas: [{ etiqueta: "Tipo" }, { etiqueta: "Base", num: true }, { etiqueta: "Cuota", num: true }],
                  filas: datos.soportado.map((f) => [`${f.tipo} %`, euros(f.base), euros(f.cuota)]),
                  pie: ["TOTAL", euros(datos.soportado.reduce((s, f) => s + f.base, 0)), euros(datos.totalSoportado - datos.gastos.deducible)],
                },
                {
                  titulo: "Liquidación del periodo",
                  columnas: [{ etiqueta: "Concepto" }, { etiqueta: "Importe", num: true }],
                  filas: [
                    ["IVA repercutido", euros(datos.totalRepercutido)],
                    ["IVA soportado (facturas de compra)", `− ${euros(datos.totalSoportado - datos.gastos.deducible)}`],
                    ["IVA deducible de tickets", `− ${euros(datos.gastos.deducible)}`],
                  ],
                  pie: ["Resultado", resultado >= 0 ? `${euros(resultado)} a ingresar` : `${euros(-resultado)} a compensar`],
                },
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-5 mb-5">
            <TablaIva
              titulo="IVA repercutido (ventas)"
              filas={datos.repercutido}
              total={datos.totalRepercutido}
              nombre="iva-repercutido"
            />
            <TablaIva
              titulo="IVA soportado (compras)"
              filas={datos.soportado}
              total={datos.totalSoportado - datos.gastos.deducible}
              nombre="iva-soportado"
            />
          </div>

          <div className="panel p-5 max-w-3xl">
            <h2 className="text-white font-semibold mb-3">Liquidación del periodo</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">IVA repercutido</span>
                <span className="num text-white">{euros(datos.totalRepercutido)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">IVA soportado (facturas de compra)</span>
                <span className="num text-white">− {euros(datos.totalSoportado - datos.gastos.deducible)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">
                  IVA deducible de tickets
                  {datos.gastos.deducible < datos.gastos.cuota && (
                    <span className="text-xs text-slate-500"> (de {euros(datos.gastos.cuota)} soportado en tickets)</span>
                  )}
                </span>
                <span className="num text-white">− {euros(datos.gastos.deducible)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2 mt-2">
                <span className="font-semibold text-white">Resultado</span>
                <span className={`num font-bold text-lg ${aPagar ? "text-rose-400" : "text-emerald-400"}`}>
                  {aPagar ? `${euros(resultado)} a ingresar` : `${euros(-resultado)} a compensar`}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Orientativo para preparar el 303: no incluye recargo de equivalencia ni operaciones
              especiales. Revísalo con tu asesor antes de presentar.
            </p>
          </div>
        </>
      ) : null}
    </>
  );
}
