import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import FormDocumentoCompra from "../components/FormDocumentoCompra.jsx";
import { Badge, EstadoVacio, euros } from "../components/ui.jsx";
import { IconImprimir } from "../components/icons.jsx";
import { imprimirDocumento } from "../utils/imprimir.js";

const TONO = { borrador: "slate", confirmado: "cyan", recibido: "green", cancelado: "red" };
const NOMBRE = { borrador: "Borrador", confirmado: "Confirmado", recibido: "Recibido", cancelado: "Cancelado" };

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");
const aInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

// Desplegable de estado con aspecto de pill coloreada (referencia).
const CLASES_PILL_ESTADO = {
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  cyan: "bg-sky-100 text-sky-700 border-sky-200",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
  red: "bg-rose-100 text-rose-700 border-rose-200",
};
const ESTILO_FLECHA = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundPosition: "right 9px center",
};

export default function ComprasPedidosPage() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null); // { modo: "nuevo" | "editar", pedido? }

  async function cargar() {
    try {
      const r = await fetch("/api/pedidos-compra");
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setLista(datos);
    } catch (e) {
      setError(e.message);
      setLista([]);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function cambiarEstado(p, estado) {
    const r = await fetch(`/api/pedidos-compra/${p._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo cambiar el estado");
  }

  async function pasarAAlbaran(p) {
    if (!window.confirm(`¿Recibir mercancía del pedido ${p.numero}? Se creará el albarán de compra.`)) return;
    const r = await fetch(`/api/pedidos-compra/${p._id}/pasar-a-albaran`, { method: "POST" });
    const datos = await r.json();
    if (r.ok) {
      cargar();
      alert(`Albarán ${datos.albaran.numero} creado en Compras → Albaranes.`);
    } else alert(datos.error || "No se pudo convertir");
  }

  async function borrar(p) {
    if (!window.confirm(`¿Borrar el pedido ${p.numero}?`)) return;
    const r = await fetch(`/api/pedidos-compra/${p._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  return (
    <>
      <CabeceraPagina
        titulo="Pedidos de compra"
        descripcion="Pedidos que haces a proveedores. Al recibir la mercancía se pasan a albarán."
      >
        <button onClick={() => window.print()} className="btn-ghost mr-2">
          Imprimir
        </button>
        <button onClick={() => setForm({ modo: "nuevo" })} className="btn-primary">
          Nuevo pedido
        </button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      <div className="panel px-3.5 py-2">
        {!lista ? null : lista.length === 0 ? (
          <EstadoVacio
            titulo="Sin pedidos"
            descripcion="Crea el primer pedido a un proveedor: cuando llegue la mercancía lo pasarás a albarán con un clic."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Proveedor</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="text-right">Total</th>
                  <th>Albarán</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p._id}>
                    <td className="font-bold text-white whitespace-nowrap num">{p.numero}</td>
                    <td className="text-slate-300 max-w-[190px]">
                      <span className="block truncate" title={p.proveedor?.nombre}>{p.proveedor?.nombre ?? "—"}</span>
                    </td>
                    <td className="text-slate-400 num">{fecha(p.fecha)}</td>
                    <td>
                      {p.estado === "recibido" ? (
                        <Badge tono={TONO.recibido}>{NOMBRE.recibido}</Badge>
                      ) : (
                        <select
                          value={p.estado}
                          onChange={(e) => cambiarEstado(p, e.target.value)}
                          className={`cursor-pointer appearance-none rounded-full border text-[11px] font-semibold pl-3 pr-7 py-1 bg-no-repeat focus:outline-none ${
                            CLASES_PILL_ESTADO[TONO[p.estado]] ?? CLASES_PILL_ESTADO.slate
                          }`}
                          style={ESTILO_FLECHA}
                        >
                          {Object.keys(NOMBRE).map((e2) => (
                            <option key={e2} value={e2}>{NOMBRE[e2]}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="text-right text-slate-300 whitespace-nowrap num">{euros(p.total)}</td>
                    <td className="whitespace-nowrap">
                      {p.numeroAlbaran ? (
                        <Badge tono="green">{p.numeroAlbaran}</Badge>
                      ) : p.estado === "confirmado" || p.estado === "borrador" ? (
                        <button onClick={() => pasarAAlbaran(p)} className="text-xs text-amber-300 hover:underline">
                          Pasar a albarán
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          imprimirDocumento({
                            tipo: "Pedido de compra",
                            numero: p.numero,
                            fecha: p.fecha,
                            contraparte: p.proveedor,
                            quienContraparte: "Proveedor",
                            lineas: p.lineas,
                            notas: p.notas,
                          })
                        }
                        title="Imprimir"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle mr-2"
                      >
                        <IconImprimir />
                      </button>
                      {p.estado !== "recibido" && (
                        <button
                          onClick={() => setForm({ modo: "editar", pedido: p })}
                          className="text-xs text-accent hover:underline mr-3"
                        >
                          Editar
                        </button>
                      )}
                      <button onClick={() => borrar(p)} className="text-xs text-rose-400 hover:underline">
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form?.modo === "nuevo" && (
        <FormDocumentoCompra
          titulo="Nuevo pedido de compra"
          url="/api/pedidos-compra"
          onGuardado={() => { setForm(null); cargar(); }}
          onCerrar={() => setForm(null)}
        />
      )}
      {form?.modo === "editar" && (
        <FormDocumentoCompra
          titulo={`Pedido ${form.pedido.numero}`}
          url={`/api/pedidos-compra/${form.pedido._id}`}
          metodo="PUT"
          inicial={{
            proveedor: form.pedido.proveedor?._id ?? form.pedido.proveedor,
            fecha: aInput(form.pedido.fecha),
            notas: form.pedido.notas ?? "",
            lineas: form.pedido.lineas,
          }}
          onGuardado={() => { setForm(null); cargar(); }}
          onCerrar={() => setForm(null)}
        />
      )}
    </>
  );
}
