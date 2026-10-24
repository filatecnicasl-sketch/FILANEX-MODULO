import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { EstadoVacio, euros } from "../../components/ui.jsx";

export default function AsesoriaLibrosPage() {
  const [clientes, setClientes] = useState([]);
  const [cliente, setCliente] = useState("");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [libros, setLibros] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/asesoria/cartera")
      .then((r) => r.json())
      .then((lista) => {
        setClientes(lista);
        if (lista.length && !cliente) setCliente(lista[0]._id);
      })
      .catch(() => setError("No se pudo cargar la cartera"));
  }, []);

  useEffect(() => {
    if (!cliente) return;
    setLibros(null);
    fetch(`/api/asesoria/libros-iva?cliente=${cliente}&ano=${ano}`)
      .then(async (r) => {
        const datos = await r.json();
        if (!r.ok) throw new Error(datos.error || "Error al cargar los libros");
        setLibros(datos.trimestres);
      })
      .catch((e) => setError(e.message));
  }, [cliente, ano]);

  const clienteSel = clientes.find((c) => c._id === cliente);
  const anos = [];
  for (let a = new Date().getFullYear(); a >= new Date().getFullYear() - 4; a--) anos.push(a);

  return (
    <>
      <CabeceraPagina
        titulo="Libros de IVA"
        descripcion="Registro de facturas emitidas y recibidas por cliente y trimestre, listo para exportar a tu programa de contabilidad."
      >
        <a
          className={`btn-primary ${cliente ? "" : "opacity-50 pointer-events-none"}`}
          href={`/api/asesoria/libros-iva.csv?cliente=${cliente}&ano=${ano}`}
          download
        >
          Descargar CSV
        </a>
      </CabeceraPagina>

      <div className="flex flex-wrap gap-3 mb-6">
        <select className="input max-w-xs" value={cliente} onChange={(e) => setCliente(e.target.value)}>
          {clientes.map((c) => (
            <option key={c._id} value={c._id}>{c.nombre}</option>
          ))}
        </select>
        <select className="input max-w-[140px]" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      {clientes.length === 0 && (
        <EstadoVacio titulo="Sin clientes en la cartera" descripcion="Da de alta un cliente en «Cartera»." />
      )}

      {libros && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {libros.map((t) => {
              const soportado = t.recibidas.cuota + t.gastos.cuota;
              const resultado = t.emitidas.cuota - soportado;
              return (
                <div key={t.trimestre} className="panel p-5">
                  <p className="text-white font-bold mb-3">{t.trimestre}º trimestre</p>
                  <dl className="text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Emitidas ({t.emitidas.documentos})</dt>
                      <dd className="text-slate-300">{euros(t.emitidas.cuota)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Recibidas ({t.recibidas.documentos})</dt>
                      <dd className="text-slate-300">{euros(t.recibidas.cuota)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Gastos ({t.gastos.documentos})</dt>
                      <dd className="text-slate-300">{euros(t.gastos.cuota)}</dd>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-white/5">
                      <dt className="text-slate-400 font-semibold">Resultado</dt>
                      <dd className={`font-bold ${resultado >= 0 ? "text-amber-300" : "text-emerald-300"}`}>
                        {euros(resultado)}
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">
            Solo entran los documentos marcados como «revisado» o «contabilizado» de {clienteSel?.nombre}.
            El CSV usa punto y coma y decimales con coma, listo para Excel y para la importación de A3, Sage o Contasol.
          </p>
        </>
      )}
    </>
  );
}
