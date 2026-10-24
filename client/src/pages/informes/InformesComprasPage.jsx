// Informes → Compras: por proveedor (con desglose de IVA), por artículo,
// resumen por periodo y listado de documentos, todo entre fechas.
import { useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import {
  FiltroFechas, useInforme, TablaInforme, Td, TdNum, BotonCSV, BotonImprimir,
  euros, textoDesglose, textoPeriodo,
} from "./comun.jsx";
import { useFiltroInforme, Pestanas, ResumenPeriodo, Documentos } from "./InformesVentasPage.jsx";

const PESTANAS = [
  { clave: "proveedor", etiqueta: "Por proveedor" },
  { clave: "articulo", etiqueta: "Por artículo" },
  { clave: "resumen", etiqueta: "Resumen por periodo" },
  { clave: "documentos", etiqueta: "Documentos" },
  { clave: "retenciones", etiqueta: "Retenciones IRPF" },
];

function PorProveedor({ desde, hasta }) {
  const { datos, error, cargando } = useInforme("/api/informes/compras/por-proveedor", desde, hasta);
  const filas = datos?.filas ?? [];
  const t = datos?.totales;
  return (
    <div className="panel p-5">
      <div className="flex justify-end gap-2 mb-2">
        <BotonImprimir
          titulo="Compras por proveedor"
          subtitulo={textoPeriodo(desde, hasta)}
          horizontal
          secciones={[{
            columnas: [
              { etiqueta: "Proveedor" }, { etiqueta: "NIF" }, { etiqueta: "Facturas", num: true },
              { etiqueta: "Base", num: true }, { etiqueta: "IVA", num: true }, { etiqueta: "Total", num: true },
              { etiqueta: "Pendiente", num: true }, { etiqueta: "Desglose IVA" },
            ],
            filas: filas.map((f) => [
              f.nombre, f.nif, f.documentos, euros(f.base), euros(f.cuotaIva), euros(f.total),
              f.pendiente > 0 ? euros(f.pendiente) : "—", textoDesglose(f.iva),
            ]),
            pie: ["TOTALES", "", t?.documentos, euros(t?.base), euros(t?.cuotaIva), euros(t?.total), euros(t?.pendiente), ""],
          }]}
        />
        <BotonCSV
          nombre="compras-por-proveedor"
          cabeceras={["Proveedor", "NIF", "Facturas", "Base", "IVA", "Total", "Pendiente de pago", "Desglose IVA"]}
          filas={filas.map((f) => [f.nombre, f.nif, f.documentos, f.base, f.cuotaIva, f.total, f.pendiente, textoDesglose(f.iva)])}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <TablaInforme
        cargando={cargando}
        columnas={[
          { etiqueta: "Proveedor" },
          { etiqueta: "Facturas", num: true },
          { etiqueta: "Base", num: true },
          { etiqueta: "IVA", num: true },
          { etiqueta: "Total", num: true },
          { etiqueta: "Pendiente", num: true },
        ]}
        filas={filas.map((f) => (
          <tr key={f.id} className="border-b border-line/60 align-top">
            <Td>
              <p className="text-white">{f.nombre}</p>
              <p className="text-xs text-slate-500">{f.nif}</p>
              <p className="text-xs text-slate-500 mt-1">{textoDesglose(f.iva)}</p>
            </Td>
            <TdNum>{f.documentos}</TdNum>
            <TdNum>{euros(f.base)}</TdNum>
            <TdNum>{euros(f.cuotaIva)}</TdNum>
            <TdNum fuerte>{euros(f.total)}</TdNum>
            <TdNum>{f.pendiente > 0 ? euros(f.pendiente) : "—"}</TdNum>
          </tr>
        ))}
        pie={t && (
          <>
            <Td>TOTALES</Td>
            <TdNum fuerte>{t.documentos}</TdNum>
            <TdNum fuerte>{euros(t.base)}</TdNum>
            <TdNum fuerte>{euros(t.cuotaIva)}</TdNum>
            <TdNum fuerte>{euros(t.total)}</TdNum>
            <TdNum fuerte>{euros(t.pendiente ?? 0)}</TdNum>
          </>
        )}
      />
    </div>
  );
}

function PorArticulo({ desde, hasta }) {
  const { datos, error, cargando } = useInforme("/api/informes/compras/por-articulo", desde, hasta);
  const filas = datos?.filas ?? [];
  const t = datos?.totales;
  return (
    <div className="panel p-5">
      <div className="flex justify-end gap-2 mb-2">
        <BotonImprimir
          titulo="Compras por artículo"
          subtitulo={textoPeriodo(desde, hasta)}
          secciones={[{
            columnas: [
              { etiqueta: "Artículo / servicio" }, { etiqueta: "Cantidad", num: true },
              { etiqueta: "Base", num: true }, { etiqueta: "IVA", num: true }, { etiqueta: "Total", num: true },
            ],
            filas: filas.map((f) => [f.descripcion, f.cantidad, euros(f.base), euros(f.cuotaIva), euros(f.total)]),
            pie: ["TOTALES", t?.cantidad, euros(t?.base), euros(t?.cuotaIva), euros(t?.total)],
          }]}
        />
        <BotonCSV
          nombre="compras-por-articulo"
          cabeceras={["Artículo / servicio", "Cantidad", "Base", "IVA", "Total"]}
          filas={filas.map((f) => [f.descripcion, f.cantidad, f.base, f.cuotaIva, f.total])}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <TablaInforme
        cargando={cargando}
        columnas={[
          { etiqueta: "Artículo / servicio" },
          { etiqueta: "Cantidad", num: true },
          { etiqueta: "Base", num: true },
          { etiqueta: "IVA", num: true },
          { etiqueta: "Total", num: true },
        ]}
        filas={filas.map((f) => (
          <tr key={f.descripcion} className="border-b border-line/60">
            <Td>{f.descripcion}</Td>
            <TdNum>{f.cantidad}</TdNum>
            <TdNum>{euros(f.base)}</TdNum>
            <TdNum>{euros(f.cuotaIva)}</TdNum>
            <TdNum fuerte>{euros(f.total)}</TdNum>
          </tr>
        ))}
        pie={t && (
          <>
            <Td>TOTALES</Td>
            <TdNum fuerte>{t.cantidad}</TdNum>
            <TdNum fuerte>{euros(t.base)}</TdNum>
            <TdNum fuerte>{euros(t.cuotaIva)}</TdNum>
            <TdNum fuerte>{euros(t.total)}</TdNum>
          </>
        )}
      />
    </div>
  );
}

// Retenciones de IRPF practicadas a proveedores, agrupadas por modelo
// (111 profesionales / 115 arrendamientos) para preparar la liquidación
// trimestral. Los datos salen de las facturas de compra validadas.
function Retenciones({ desde, hasta }) {
  const { datos, error, cargando } = useInforme("/api/informes/compras/retenciones", desde, hasta);
  const filas = datos?.filas ?? [];
  const m111 = datos?.porModelo?.["111"];
  const m115 = datos?.porModelo?.["115"];
  const total = datos?.totalRetencion ?? 0;
  return (
    <div className="panel p-5">
      <div className="flex justify-end gap-2 mb-2">
        <BotonImprimir
          titulo="Retenciones IRPF en compras"
          subtitulo={textoPeriodo(desde, hasta)}
          secciones={[
            {
              titulo: "Resumen por modelo",
              columnas: [
                { etiqueta: "Modelo" }, { etiqueta: "Concepto" }, { etiqueta: "Facturas", num: true },
                { etiqueta: "Base", num: true }, { etiqueta: "Retención", num: true },
              ],
              filas: [
                ["111", "Rendimientos de actividades profesionales", m111?.facturas ?? 0, euros(m111?.base), euros(m111?.retencion)],
                ["115", "Arrendamientos de inmuebles urbanos", m115?.facturas ?? 0, euros(m115?.base), euros(m115?.retencion)],
              ],
              pie: ["TOTAL", "", (m111?.facturas ?? 0) + (m115?.facturas ?? 0), euros((m111?.base ?? 0) + (m115?.base ?? 0)), euros(total)],
            },
            {
              titulo: "Detalle por proveedor",
              columnas: [
                { etiqueta: "Proveedor" }, { etiqueta: "NIF" }, { etiqueta: "Modelo" },
                { etiqueta: "Facturas", num: true }, { etiqueta: "Base", num: true }, { etiqueta: "Retención", num: true },
              ],
              filas: filas.map((f) => [f.nombre, f.nif, f.modelo, f.facturas, euros(f.base), euros(f.retencion)]),
            },
          ]}
        />
        <BotonCSV
          nombre="retenciones-irpf"
          cabeceras={["Proveedor", "NIF", "Modelo", "Facturas", "Base", "Retención"]}
          filas={filas.map((f) => [f.nombre, f.nif, f.modelo, f.facturas, f.base, f.retencion])}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <div className="rounded-xl border border-line bg-panel2/40 p-4">
          <p className="text-xs text-slate-500">Modelo 111 · Profesionales</p>
          <p className="text-lg font-semibold text-white">{euros(m111?.retencion)}</p>
          <p className="text-xs text-slate-500">
            {m111?.facturas ?? 0} facturas · base {euros(m111?.base)}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-panel2/40 p-4">
          <p className="text-xs text-slate-500">Modelo 115 · Arrendamientos</p>
          <p className="text-lg font-semibold text-white">{euros(m115?.retencion)}</p>
          <p className="text-xs text-slate-500">
            {m115?.facturas ?? 0} facturas · base {euros(m115?.base)}
          </p>
        </div>
      </div>
      <TablaInforme
        cargando={cargando}
        columnas={[
          { etiqueta: "Proveedor" },
          { etiqueta: "Modelo" },
          { etiqueta: "Facturas", num: true },
          { etiqueta: "Base", num: true },
          { etiqueta: "Retención", num: true },
        ]}
        filas={filas.map((f) => (
          <tr key={`${f.modelo}-${f.nif}-${f.nombre}`} className="border-b border-line/60">
            <Td>
              <p className="text-white">{f.nombre}</p>
              <p className="text-xs text-slate-500">{f.nif}</p>
            </Td>
            <Td>{f.modelo}</Td>
            <TdNum>{f.facturas}</TdNum>
            <TdNum>{euros(f.base)}</TdNum>
            <TdNum fuerte>{euros(f.retencion)}</TdNum>
          </tr>
        ))}
        pie={filas.length > 0 && (
          <>
            <Td>TOTAL A INGRESAR</Td>
            <Td />
            <TdNum fuerte>{filas.reduce((s, f) => s + f.facturas, 0)}</TdNum>
            <TdNum fuerte>{euros(filas.reduce((s, f) => s + f.base, 0))}</TdNum>
            <TdNum fuerte>{euros(total)}</TdNum>
          </>
        )}
      />
    </div>
  );
}

export default function InformesComprasPage() {
  const { desde, hasta, atajo, anyo, cambiarFechas, aplicarAtajo, cambiarAnyo } = useFiltroInforme();
  const [pestana, setPestana] = useState("proveedor");
  return (
    <>
      <CabeceraPagina
        titulo="Informes de compras"
        descripcion="Facturas de proveedor validadas entre fechas: por proveedor, por artículo, por periodo y listado completo."
      />
      <FiltroFechas desde={desde} hasta={hasta} onCambio={cambiarFechas} atajo={atajo} onAtajo={aplicarAtajo} anyo={anyo} onAnyo={cambiarAnyo} />
      <Pestanas pestanas={PESTANAS} activa={pestana} onCambio={setPestana} />
      {pestana === "proveedor" && <PorProveedor desde={desde} hasta={hasta} />}
      {pestana === "articulo" && <PorArticulo desde={desde} hasta={hasta} />}
      {pestana === "resumen" && (
        <ResumenPeriodo url="/api/informes/compras/resumen" nombre="compras-resumen" titulo="Compras" desde={desde} hasta={hasta} />
      )}
      {pestana === "documentos" && (
        <Documentos url="/api/informes/compras/documentos" nombre="compras-documentos" titulo="Facturas de compra" desde={desde} hasta={hasta} tituloNumero="Nº factura" />
      )}
      {pestana === "retenciones" && <Retenciones desde={desde} hasta={hasta} />}
    </>
  );
}
