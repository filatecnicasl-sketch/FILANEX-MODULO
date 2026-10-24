import { useEffect, useMemo, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio, euros } from "../../components/ui.jsx";

function Fila({ etiqueta, valor, fuerte, tono }) {
  return (
    <div className="flex justify-between">
      <dt className={fuerte ? "text-slate-300 font-semibold" : "text-slate-500"}>{etiqueta}</dt>
      <dd className={`${fuerte ? "font-bold" : ""} ${tono ?? "text-slate-300"}`}>{valor}</dd>
    </div>
  );
}

export default function AsesoriaPrevisionPage() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [datos, setDatos] = useState(null);
  const [cliente, setCliente] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    setDatos(null);
    const params = new URLSearchParams({ ano });
    if (cliente) params.set("cliente", cliente);
    fetch(`/api/asesoria/prevision?${params}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Error al calcular la previsión");
        setDatos(d);
      })
      .catch((e) => setError(e.message));
  }, [ano, cliente]);

  const anos = [];
  for (let a = new Date().getFullYear(); a >= new Date().getFullYear() - 4; a--) anos.push(a);

  const trimestreActual = Math.floor(new Date().getMonth() / 3) + 1;
  const clientes = datos?.clientes ?? [];
  const nombres = useMemo(() => clientes.map((c) => c.cliente), [clientes]);

  return (
    <>
      <CabeceraPagina
        titulo="Previsión fiscal"
        descripcion="Modelo 303 (IVA) y 130 (pagos fraccionados) calculados con los documentos revisados de cada cliente."
      >
        <select className="input max-w-xs" value={cliente} onChange={(e) => setCliente(e.target.value)}>
          <option value="">Toda la cartera</option>
          {nombres.map((c) => (
            <option key={c._id} value={c._id}>{c.nombre}</option>
          ))}
        </select>
        <select className="input max-w-[140px]" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </CabeceraPagina>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      {datos && clientes.length === 0 && (
        <EstadoVacio
          titulo="Sin clientes en la cartera"
          descripcion="La previsión se calcula con los documentos revisados de cada cliente."
        />
      )}

      <div className="space-y-5">
        {clientes.map((c) => (
          <div key={c.cliente._id} className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <p className="text-white font-semibold">{c.cliente.nombre}</p>
                <p className="text-xs text-slate-500">{c.cliente.nif}</p>
              </div>
              <div className="flex gap-2">
                <Badge tono="sky">303</Badge>
                {c.presenta130 && <Badge tono="violet">130</Badge>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {c.trimestres.map((t) => {
                const esActual = datos.ano === new Date().getFullYear() && t.trimestre === trimestreActual;
                return (
                  <div
                    key={t.trimestre}
                    className={`rounded-xl border p-4 ${
                      esActual ? "border-accent/40 bg-accent/5" : "border-white/5 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-white">{t.trimestre}T</p>
                      {esActual && <Badge tono="amber">en curso</Badge>}
                    </div>
                    {t.documentos === 0 ? (
                      <p className="text-xs text-slate-600">Sin documentos revisados</p>
                    ) : (
                      <dl className="text-xs space-y-1.5">
                        <Fila etiqueta="IVA repercutido" valor={euros(t.iva.repercutido)} />
                        <Fila etiqueta="IVA soportado" valor={euros(t.iva.soportado)} />
                        <Fila
                          etiqueta="303 a pagar"
                          valor={euros(t.iva.cuota)}
                          fuerte
                          tono={t.iva.cuota > 0 ? "text-amber-300" : "text-emerald-300"}
                        />
                        {t.iva.aCompensar > 0 && (
                          <Fila etiqueta="A compensar después" valor={euros(t.iva.aCompensar)} />
                        )}
                        {t.irpf && (
                          <>
                            <div className="border-t border-white/5 my-1.5" />
                            <Fila etiqueta="Rendimiento acum." valor={euros(t.irpf.rendimiento)} />
                            <Fila etiqueta="Retenciones acum." valor={euros(t.irpf.retenciones)} />
                            <Fila
                              etiqueta="130 a pagar"
                              valor={euros(t.irpf.pagoTrimestre)}
                              fuerte
                              tono={t.irpf.pagoTrimestre > 0 ? "text-amber-300" : "text-emerald-300"}
                            />
                          </>
                        )}
                      </dl>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-4">
        Solo cuentan los documentos marcados como «revisado» o «contabilizado». El 303 aplica la compensación de
        cuotas negativas de trimestres anteriores; el 130 se calcula con el rendimiento acumulado del año,
        el 20 %, menos las retenciones soportadas y los pagos ya hechos.
      </p>
    </>
  );
}
