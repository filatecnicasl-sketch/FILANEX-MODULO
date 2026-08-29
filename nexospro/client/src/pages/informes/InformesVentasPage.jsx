// Informes → Ventas: por cliente (con desglose de IVA), por artículo,
// resumen por periodo y listado de documentos, todo entre fechas.
import { useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Badge } from "../../components/ui.jsx";
import {
  ATAJOS, FiltroFechas, useInforme, TablaInforme, Td, TdNum, BotonCSV,
  euros, fmtFecha, textoDesglose, rangoInicial,
} from "./comun.jsx";

const PESTANAS = [
  { clave: "cliente", etiqueta: "Por cliente" },
  { clave: "articulo", etiqueta: "Por artículo" },
  { clave: "resumen", etiqueta: "Resumen por periodo" },
  { clave: "documentos", etiqueta: "Documentos" },
];

const TONO_COBRO = { cobrada: "green", parcial: "amber", pendiente: "slate", anulada: "red" };

export function useFiltroInforme() {
  const [[desde, hasta], setRango] = useState(rangoInicial());
  const [atajo, setAtajo] = useState("ano");
  const cambiarFechas = (d, h) => {
    setRango([d, h]);
    setAtajo("");
  };
  const aplicarAtajo = (clave) => {
    setRango(ATAJOS.find((a) => a.clave === clave).rango());
    setAtajo(clave);
  };
  return { desde, hasta, atajo, cambiarFechas, aplicarAtajo };
}

export function Pestanas({ pestanas, activa, onCambio }) {
  return (
    <div className="flex gap-1 mb-4 border-b border-line">
      {pestanas.map((p) => (
        <button
          key={p.clave}
          type="button"
          onClick={() => onCambio(p.clave)}
          className={`text-sm px-4 py-2 border-b-2 -mb-px transition-colors ${
            activa === p.clave
              ? "border-accent text-white font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          {p.etiqueta}
        </button>
      ))}
    </div>
  );
}

function PorCliente({ desde, hasta }) {
  const { datos, error, cargando } = useInforme("/api/informes/ventas/por-cliente", desde, hasta);
  const filas = datos?.filas ?? [];
  const t = datos?.totales;
  return (
    <div className="panel p-5">
      <div className="flex justify-end mb-2">
        <BotonCSV
          nombre="ventas-por-cliente"
          cabeceras={["Cliente", "NIF", "Facturas", "Base", "IVA", "Total", "Pendiente de cobro", "Desglose IVA"]}
          filas={filas.map((f) => [f.nombre, f.nif, f.documentos, f.base, f.cuotaIva, f.total, f.pendiente, textoDesglose(f.iva)])}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <TablaInforme
        cargando={cargando}
        columnas={[
          { etiqueta: "Cliente" },
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
  const { datos, error, cargando } = useInforme("/api/informes/ventas/por-articulo", desde, hasta);
  const filas = datos?.filas ?? [];
  const t = datos?.totales;
  return (
    <div className="panel p-5">
      <div className="flex justify-end mb-2">
        <BotonCSV
          nombre="ventas-por-articulo"
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

export function ResumenPeriodo({ url, nombre, desde, hasta }) {
  const [agrupar, setAgrupar] = useState("mes");
  const { datos, error, cargando } = useInforme(`${url}?agrupar=${agrupar}`, desde, hasta);
  const filas = datos?.filas ?? [];
  const t = datos?.totales;
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex gap-1">
          {[["dia", "Por día"], ["mes", "Por mes"], ["trimestre", "Por trimestre"]].map(([c, e]) => (
            <button
              key={c}
              type="button"
              onClick={() => setAgrupar(c)}
              className={`text-xs px-3 py-1.5 rounded-lg border ${
                agrupar === c
                  ? "bg-accent/15 text-accent border-accent/30"
                  : "bg-white/5 text-slate-400 border-white/10 hover:text-slate-200"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        <BotonCSV
          nombre={nombre}
          cabeceras={["Periodo", "Documentos", "Base", "IVA", "Total"]}
          filas={filas.map((f) => [f.periodo, f.documentos, f.base, f.cuotaIva, f.total])}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <TablaInforme
        cargando={cargando}
        columnas={[
          { etiqueta: "Periodo" },
          { etiqueta: "Documentos", num: true },
          { etiqueta: "Base", num: true },
          { etiqueta: "IVA", num: true },
          { etiqueta: "Total", num: true },
        ]}
        filas={filas.map((f) => (
          <tr key={f.periodo} className="border-b border-line/60">
            <Td>{f.periodo}</Td>
            <TdNum>{f.documentos}</TdNum>
            <TdNum>{euros(f.base)}</TdNum>
            <TdNum>{euros(f.cuotaIva)}</TdNum>
            <TdNum fuerte>{euros(f.total)}</TdNum>
          </tr>
        ))}
        pie={t && (
          <>
            <Td>TOTALES</Td>
            <TdNum fuerte>{t.documentos}</TdNum>
            <TdNum fuerte>{euros(t.base)}</TdNum>
            <TdNum fuerte>{euros(t.cuotaIva)}</TdNum>
            <TdNum fuerte>{euros(t.total)}</TdNum>
          </>
        )}
      />
    </div>
  );
}

export function Documentos({ url, nombre, desde, hasta, tituloNumero }) {
  const { datos, error, cargando } = useInforme(url, desde, hasta);
  const filas = datos?.filas ?? [];
  const t = datos?.totales;
  return (
    <div className="panel p-5">
      <div className="flex justify-end mb-2">
        <BotonCSV
          nombre={nombre}
          cabeceras={[tituloNumero, "Fecha", "Contacto", "Base", "IVA", "Total", "Estado"]}
          filas={filas.map((f) => [f.numero, fmtFecha(f.fecha), f.contacto, f.base, f.cuotaIva, f.total, f.estadoPago])}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <TablaInforme
        cargando={cargando}
        columnas={[
          { etiqueta: tituloNumero },
          { etiqueta: "Fecha" },
          { etiqueta: "Contacto" },
          { etiqueta: "Base", num: true },
          { etiqueta: "IVA", num: true },
          { etiqueta: "Total", num: true },
          { etiqueta: "Estado" },
        ]}
        filas={filas.map((f) => (
          <tr key={f.id} className="border-b border-line/60">
            <Td>{f.numero}</Td>
            <Td>{fmtFecha(f.fecha)}</Td>
            <Td>{f.contacto}</Td>
            <TdNum>{euros(f.base)}</TdNum>
            <TdNum>{euros(f.cuotaIva)}</TdNum>
            <TdNum fuerte>{euros(f.total)}</TdNum>
            <Td><Badge tono={TONO_COBRO[f.estadoPago] ?? "slate"}>{f.estadoPago}</Badge></Td>
          </tr>
        ))}
        pie={t && (
          <>
            <Td>TOTALES</Td>
            <Td />
            <Td />
            <TdNum fuerte>{euros(t.base)}</TdNum>
            <TdNum fuerte>{euros(t.cuotaIva)}</TdNum>
            <TdNum fuerte>{euros(t.total)}</TdNum>
            <Td />
          </>
        )}
      />
    </div>
  );
}

export default function InformesVentasPage() {
  const { desde, hasta, atajo, cambiarFechas, aplicarAtajo } = useFiltroInforme();
  const [pestana, setPestana] = useState("cliente");
  return (
    <>
      <CabeceraPagina
        titulo="Informes de ventas"
        descripcion="Facturas emitidas entre fechas: por cliente, por artículo, por periodo y listado completo."
      />
      <FiltroFechas desde={desde} hasta={hasta} onCambio={cambiarFechas} atajo={atajo} onAtajo={aplicarAtajo} />
      <Pestanas pestanas={PESTANAS} activa={pestana} onCambio={setPestana} />
      {pestana === "cliente" && <PorCliente desde={desde} hasta={hasta} />}
      {pestana === "articulo" && <PorArticulo desde={desde} hasta={hasta} />}
      {pestana === "resumen" && (
        <ResumenPeriodo url="/api/informes/ventas/resumen" nombre="ventas-resumen" desde={desde} hasta={hasta} />
      )}
      {pestana === "documentos" && (
        <Documentos url="/api/informes/ventas/documentos" nombre="ventas-documentos" desde={desde} hasta={hasta} tituloNumero="Factura" />
      )}
    </>
  );
}
