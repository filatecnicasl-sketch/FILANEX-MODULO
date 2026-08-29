// Informes → Compras: por proveedor (con desglose de IVA), por artículo,
// resumen por periodo y listado de documentos, todo entre fechas.
import { useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import {
  FiltroFechas, useInforme, TablaInforme, Td, TdNum, BotonCSV,
  euros, textoDesglose,
} from "./comun.jsx";
import { useFiltroInforme, Pestanas, ResumenPeriodo, Documentos } from "./InformesVentasPage.jsx";

const PESTANAS = [
  { clave: "proveedor", etiqueta: "Por proveedor" },
  { clave: "articulo", etiqueta: "Por artículo" },
  { clave: "resumen", etiqueta: "Resumen por periodo" },
  { clave: "documentos", etiqueta: "Documentos" },
];

function PorProveedor({ desde, hasta }) {
  const { datos, error, cargando } = useInforme("/api/informes/compras/por-proveedor", desde, hasta);
  const filas = datos?.filas ?? [];
  const t = datos?.totales;
  return (
    <div className="panel p-5">
      <div className="flex justify-end mb-2">
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
      <div className="flex justify-end mb-2">
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

export default function InformesComprasPage() {
  const { desde, hasta, atajo, cambiarFechas, aplicarAtajo } = useFiltroInforme();
  const [pestana, setPestana] = useState("proveedor");
  return (
    <>
      <CabeceraPagina
        titulo="Informes de compras"
        descripcion="Facturas de proveedor validadas entre fechas: por proveedor, por artículo, por periodo y listado completo."
      />
      <FiltroFechas desde={desde} hasta={hasta} onCambio={cambiarFechas} atajo={atajo} onAtajo={aplicarAtajo} />
      <Pestanas pestanas={PESTANAS} activa={pestana} onCambio={setPestana} />
      {pestana === "proveedor" && <PorProveedor desde={desde} hasta={hasta} />}
      {pestana === "articulo" && <PorArticulo desde={desde} hasta={hasta} />}
      {pestana === "resumen" && (
        <ResumenPeriodo url="/api/informes/compras/resumen" nombre="compras-resumen" desde={desde} hasta={hasta} />
      )}
      {pestana === "documentos" && (
        <Documentos url="/api/informes/compras/documentos" nombre="compras-documentos" desde={desde} hasta={hasta} tituloNumero="Nº factura" />
      )}
    </>
  );
}
