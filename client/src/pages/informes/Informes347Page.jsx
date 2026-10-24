// Informes → Modelo 347: relación anual de clientes y proveedores con los
// que se han hecho operaciones por más de 3.005,06 € (base imponible sin
// IVA), con desglose trimestral, para preparar la declaración.
import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { TablaInforme, Td, TdNum, BotonCSV, BotonImprimir, euros } from "./comun.jsx";

function Tabla347({ titulo, nombre, filas, totalBase }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-white font-semibold">{titulo}</h2>
        <BotonCSV
          nombre={nombre}
          cabeceras={["NIF", "Nombre", "Facturas", "1T", "2T", "3T", "4T", "Base total"]}
          filas={filas.map((f) => [f.nif, f.nombre, f.documentos, ...f.trimestres, f.base])}
        />
      </div>
      <TablaInforme
        cargando={false}
        columnas={[
          { etiqueta: "NIF" },
          { etiqueta: "Nombre" },
          { etiqueta: "Fact.", num: true },
          { etiqueta: "1T", num: true },
          { etiqueta: "2T", num: true },
          { etiqueta: "3T", num: true },
          { etiqueta: "4T", num: true },
          { etiqueta: "Base total", num: true },
        ]}
        filas={filas.map((f) => (
          <tr key={f.nif + f.nombre} className="border-b border-line/60">
            <Td>{f.nif}</Td>
            <Td>{f.nombre}</Td>
            <TdNum>{f.documentos}</TdNum>
            {f.trimestres.map((t, i) => (
              <TdNum key={i}>{t ? euros(t) : "—"}</TdNum>
            ))}
            <TdNum fuerte>{euros(f.base)}</TdNum>
          </tr>
        ))}
        pie={
          <>
            <Td>TOTAL ({filas.length})</Td>
            <Td>{""}</Td>
            <TdNum>{""}</TdNum>
            <TdNum>{""}</TdNum>
            <TdNum>{""}</TdNum>
            <TdNum>{""}</TdNum>
            <TdNum>{""}</TdNum>
            <TdNum fuerte>{euros(totalBase)}</TdNum>
          </>
        }
        vacio="Nadie supera el umbral de 3.005,06 € este año."
      />
    </div>
  );
}

export default function Informes347Page() {
  const [anyo, setAnyo] = useState(new Date().getFullYear());
  const [todos, setTodos] = useState(false);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    fetch(`/api/informes/347?anyo=${anyo}&todos=${todos ? "1" : "0"}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No se pudo cargar el informe"))))
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [anyo, todos]);

  const anyoActual = new Date().getFullYear();

  return (
    <>
      <CabeceraPagina
        titulo="Modelo 347"
        descripcion="Operaciones con terceros superiores a 3.005,06 € en el año, con desglose trimestral (base imponible sin IVA)."
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnyo((a) => a - 1)}
            className="btn-ghost px-2.5 py-1.5"
            title="Año anterior"
          >
            ←
          </button>
          <span className="num text-white font-semibold w-14 text-center">{anyo}</span>
          <button
            type="button"
            onClick={() => setAnyo((a) => Math.min(anyoActual, a + 1))}
            disabled={anyo >= anyoActual}
            className="btn-ghost px-2.5 py-1.5 disabled:opacity-30"
            title="Año siguiente"
          >
            →
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
          <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} className="accent-accent" />
          Ver también los que no superan el umbral
        </label>
        {datos && (
          <div className="ml-auto">
            <BotonImprimir
              titulo={`Modelo 347 — ${datos.anyo}`}
              subtitulo="Operaciones con terceros superiores a 3.005,06 € (base imponible)"
              notaFinal="Listado orientativo para preparar el modelo 347: no incluye operaciones excludas (arrendamientos de local, seguros, agencias de viaje…). Revísalo con tu asesor antes de presentarlo."
              secciones={[
                {
                  titulo: "Clientes (ventas)",
                  columnas: [{ etiqueta: "NIF" }, { etiqueta: "Nombre" }, { etiqueta: "Base", num: true }],
                  filas: datos.clientes.filas.map((f) => [f.nif, f.nombre, euros(f.base)]),
                  pie: ["TOTAL", `${datos.clientes.filas.length} clientes`, euros(datos.clientes.totalBase)],
                },
                {
                  titulo: "Proveedores (compras)",
                  columnas: [{ etiqueta: "NIF" }, { etiqueta: "Nombre" }, { etiqueta: "Base", num: true }],
                  filas: datos.proveedores.filas.map((f) => [f.nif, f.nombre, euros(f.base)]),
                  pie: ["TOTAL", `${datos.proveedores.filas.length} proveedores`, euros(datos.proveedores.totalBase)],
                },
              ]}
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      {cargando ? (
        <p className="text-sm text-slate-500 py-8 text-center">Cargando…</p>
      ) : datos ? (
        <div className="space-y-5">
          <Tabla347
            titulo={`Clientes (${datos.clientes.filas.length})`}
            nombre={`347-clientes-${datos.anyo}`}
            filas={datos.clientes.filas}
            totalBase={datos.clientes.totalBase}
          />
          <Tabla347
            titulo={`Proveedores (${datos.proveedores.filas.length})`}
            nombre={`347-proveedores-${datos.anyo}`}
            filas={datos.proveedores.filas}
            totalBase={datos.proveedores.totalBase}
          />
        </div>
      ) : null}
    </>
  );
}
