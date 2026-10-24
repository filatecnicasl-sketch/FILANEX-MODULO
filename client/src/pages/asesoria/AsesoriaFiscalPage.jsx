import { useEffect, useMemo, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio } from "../../components/ui.jsx";
import { fechaCorta } from "./datos.js";

export default function AsesoriaFiscalPage() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDatos(null);
    fetch(`/api/asesoria/fiscalidad?ano=${ano}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Error al cargar el calendario");
        setDatos(d);
      })
      .catch((e) => setError(e.message));
  }, [ano]);

  const porMes = useMemo(() => {
    if (!datos) return [];
    const meses = Array.from({ length: 12 }, () => []);
    for (const v of datos.vencimientos) {
      meses[new Date(v.fecha).getMonth()].push(v);
    }
    const nombres = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];
    return meses.map((items, i) => ({ mes: nombres[i], items }));
  }, [datos]);

  const hoy = new Date();
  const anos = [];
  for (let a = hoy.getFullYear() + 1; a >= hoy.getFullYear() - 2; a--) anos.push(a);

  return (
    <>
      <CabeceraPagina
        titulo="Calendario fiscal"
        descripcion="Vencimientos de los modelos de todos los clientes de la cartera."
      >
        <select className="input max-w-[140px]" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </CabeceraPagina>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      {datos && datos.vencimientos.length === 0 && (
        <EstadoVacio
          titulo="Sin obligaciones en este año"
          descripcion="Marca los modelos que presentas en la ficha de cada cliente de la cartera."
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {porMes.filter((m) => m.items.length > 0).map((m) => (
          <div key={m.mes} className="panel p-5">
            <h2 className="text-white font-semibold mb-3">{m.mes}</h2>
            <ul className="space-y-2">
              {m.items.map((v, i) => {
                const pasado = new Date(v.fecha) < hoy;
                return (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className={`truncate ${pasado ? "text-slate-500" : "text-slate-200"}`}>
                        {v.clienteNombre}
                      </p>
                      <p className="text-xs text-slate-500">Modelo {v.modelo} · {v.nombreModelo}</p>
                    </div>
                    <Badge tono={pasado ? "slate" : "amber"}>{fechaCorta(v.fecha)}</Badge>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
