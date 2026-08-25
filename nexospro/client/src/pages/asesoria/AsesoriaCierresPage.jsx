import { useEffect, useMemo, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { EstadoVacio, InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";

const ESTADOS = [
  { clave: "pendiente_docs", nombre: "Falta documentación", clases: "bg-slate-500/10 text-slate-400 border-slate-500/30" },
  { clave: "en_revision", nombre: "En revisión", clases: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
  { clave: "listo", nombre: "Listo para presentar", clases: "bg-violet-500/10 text-violet-300 border-violet-500/30" },
  { clave: "presentado", nombre: "Presentado", clases: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
];
const estadoDe = (c) => ESTADOS.find((e) => e.clave === c) ?? ESTADOS[0];

export default function AsesoriaCierresPage() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [datos, setDatos] = useState(null);
  const [q, setQ] = useState("");
  const [menuCelda, setMenuCelda] = useState(null); // {clienteId, trimestre}
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);

  async function cargar() {
    try {
      const r = await fetch(`/api/asesoria/cierres?ano=${ano}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar los cierres");
      setDatos(d);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    setDatos(null);
    cargar();
  }, [ano]);

  const filtrados = useMemo(() => {
    if (!datos) return [];
    return datos.clientes.filter((c) => coincideBusqueda(q, c.cliente.nombre, c.cliente.nif));
  }, [datos, q]);

  async function cambiarEstado(clienteId, trimestre, estado) {
    setMenuCelda(null);
    const r = await fetch("/api/asesoria/cierres", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteAsesoria: clienteId, ano, trimestre, estado }),
    });
    if (!r.ok) {
      const d = await r.json();
      setError(d.error || "No se pudo cambiar el estado");
    }
    cargar();
  }

  async function pedirKit(clienteId, nombre) {
    const trimestre = Math.floor(new Date().getMonth() / 3) + 1;
    const r = await fetch("/api/asesoria/solicitudes/kit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteAsesoria: clienteId, ano: new Date().getFullYear(), trimestre }),
    });
    const d = await r.json();
    if (r.ok) {
      setAviso(
        d.creadas > 0
          ? `Pedidas ${d.creadas} solicitudes de cierre a ${nombre} (${d.periodo}).`
          : `${nombre} ya tenía pedida toda la documentación de cierre.`
      );
    } else {
      setError(d.error || "No se pudo crear el kit");
    }
    cargar();
  }

  const trimestreActual = Math.floor(new Date().getMonth() / 3) + 1;
  const anos = [];
  for (let a = new Date().getFullYear(); a >= new Date().getFullYear() - 4; a--) anos.push(a);

  return (
    <>
      <CabeceraPagina
        titulo="Cierres de trimestre"
        descripcion="El trabajo trimestral de un vistazo: con qué clientes puedes cerrar y con cuáles no."
      >
        <InputBusqueda value={q} onChange={setQ} placeholder="Buscar cliente…" />
        <select className="input max-w-[140px]" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </CabeceraPagina>

      {aviso && <p className="text-sm text-emerald-400 mb-3">{aviso}</p>}
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {datos && filtrados.length === 0 && (
        <EstadoVacio titulo="Sin clientes" descripcion="Da de alta clientes en «Cartera»." />
      )}

      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {ESTADOS.map((e) => (
          <span key={e.clave} className={`px-2.5 py-1 rounded-full border ${e.clases}`}>
            {e.nombre}
          </span>
        ))}
      </div>

      <div className="panel overflow-x-auto" onClick={() => setMenuCelda(null)}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-white/5">
              <th className="px-4 py-3 min-w-[220px]">Cliente</th>
              {[1, 2, 3, 4].map((t) => (
                <th key={t} className="px-4 py-3 min-w-[170px]">
                  {t}T
                  {datos?.ano === new Date().getFullYear() && t === trimestreActual && (
                    <span className="ml-1.5 text-amber-400">· en curso</span>
                  )}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Cierre</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((fila) => (
              <tr key={fila.cliente._id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="text-white font-medium truncate max-w-[240px]">{fila.cliente.nombre}</p>
                  <p className="text-xs text-slate-500">{fila.cliente.nif}</p>
                </td>
                {fila.trimestres.map((t) => {
                  const e = estadoDe(t.estado);
                  const abierto = menuCelda?.clienteId === fila.cliente._id && menuCelda?.trimestre === t.trimestre;
                  return (
                    <td key={t.trimestre} className="px-4 py-3 relative">
                      <button
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs ${e.clases}`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setMenuCelda(abierto ? null : { clienteId: fila.cliente._id, trimestre: t.trimestre });
                        }}
                      >
                        {e.nombre}
                        {t.pendientes > 0 && t.estado !== "presentado" && (
                          <span className="block mt-0.5 text-[10px] text-amber-300">
                            {t.pendientes} por revisar
                          </span>
                        )}
                      </button>
                      {abierto && (
                        <div
                          className="absolute z-20 mt-1 w-48 panel border border-white/10 rounded-xl p-1 shadow-xl"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          {ESTADOS.map((opcion) => (
                            <button
                              key={opcion.clave}
                              className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 rounded-lg"
                              onClick={() => cambiarEstado(fila.cliente._id, t.trimestre, opcion.clave)}
                            >
                              {opcion.nombre}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right">
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => pedirKit(fila.cliente._id, fila.cliente.nombre)}
                  >
                    Pedir documentación
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-4">
        Pulsa sobre un trimestre para cambiar su estado. «Pedir documentación» crea de una vez las cinco
        solicitudes habituales de cierre (extractos, nóminas, facturas y tickets) para ese cliente.
      </p>
    </>
  );
}
