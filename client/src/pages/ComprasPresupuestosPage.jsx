import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import FormDocumentoCompra from "../components/FormDocumentoCompra.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda, euros } from "../components/ui.jsx";
import { IconImprimir } from "../components/icons.jsx";
import { imprimirDocumento } from "../utils/imprimir.js";

const TONO = { pendiente: "amber", aceptado: "green", rechazado: "red" };
const NOMBRE = { pendiente: "Pendiente", aceptado: "Aceptado", rechazado: "Rechazado" };

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");
const aInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

// Desplegable de estado con aspecto de pill coloreada (referencia).
const CLASES_PILL_ESTADO = {
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  red: "bg-rose-100 text-rose-700 border-rose-200",
};
const ESTILO_FLECHA = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundPosition: "right 9px center",
};

export default function ComprasPresupuestosPage() {
  const [lista, setLista] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null); // { modo: "nuevo" | "editar", presupuesto? }

  // Filtra por todos los campos visibles de la tabla.
  const filtrada = (lista ?? []).filter((p) =>
    coincideBusqueda(
      q,
      p.numero,
      p.numeroPresupuestoProveedor,
      p.proveedor?.nombre,
      p.proveedor?.nif,
      fecha(p.fecha),
      NOMBRE[p.estado],
      euros(p.total),
      p.total,
      p.numeroPedido
    )
  );

  async function cargar() {
    try {
      const r = await fetch("/api/presupuestos-compra");
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
    const r = await fetch(`/api/presupuestos-compra/${p._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo cambiar el estado");
  }

  async function pasarAPedido(p) {
    if (!window.confirm(`¿Aceptar el presupuesto ${p.numero}? Se creará el pedido de compra.`)) return;
    const r = await fetch(`/api/presupuestos-compra/${p._id}/pasar-a-pedido`, { method: "POST" });
    const datos = await r.json();
    if (r.ok) {
      cargar();
      alert(`Pedido ${datos.pedido.numero} creado en Compras → Pedidos.`);
    } else alert(datos.error || "No se pudo convertir");
  }

  async function borrar(p) {
    if (!window.confirm(`¿Borrar el presupuesto ${p.numero}?`)) return;
    const r = await fetch(`/api/presupuestos-compra/${p._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  return (
    <>
      <CabeceraPagina
        titulo="Presupuestos de compra"
        descripcion="Ofertas recibidas de proveedores. Si aceptas una, se convierte en pedido."
      >
        <button onClick={() => window.print()} className="btn-ghost mr-2">
          Imprimir
        </button>
        <button onClick={() => setForm({ modo: "nuevo" })} className="btn-primary">
          Nuevo presupuesto
        </button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {lista?.length > 0 && (
        <div className="mb-3">
          <InputBusqueda value={q} onChange={setQ} />
        </div>
      )}

      <div className="panel px-3.5 py-2">
        {!lista ? null : lista.length === 0 ? (
          <EstadoVacio
            titulo="Sin presupuestos de compra"
            descripcion="Registra la primera oferta de un proveedor: si la aceptas, la pasarás a pedido con un clic."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Nº proveedor</th>
                  <th>Proveedor</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="text-right">Total</th>
                  <th>Pedido</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((p) => (
                  <tr key={p._id}>
                    <td className="font-bold text-white whitespace-nowrap num">{p.numero}</td>
                    <td className="text-slate-400 whitespace-nowrap num">{p.numeroPresupuestoProveedor ?? "—"}</td>
                    <td className="text-slate-300 max-w-[190px]">
                      <span className="block truncate" title={p.proveedor?.nombre}>{p.proveedor?.nombre ?? "—"}</span>
                    </td>
                    <td className="text-slate-400 num">{fecha(p.fecha)}</td>
                    <td>
                      {p.estado === "aceptado" ? (
                        <Badge tono={TONO.aceptado}>{NOMBRE.aceptado}</Badge>
                      ) : (
                        <select
                          value={p.estado}
                          onChange={(e) => cambiarEstado(p, e.target.value)}
                          className={`cursor-pointer appearance-none rounded-full border text-[0.6875rem] font-semibold pl-3 pr-7 py-1 bg-no-repeat focus:outline-none ${
                            CLASES_PILL_ESTADO[TONO[p.estado]] ?? CLASES_PILL_ESTADO.amber
                          }`}
                          style={ESTILO_FLECHA}
                        >
                          <option value="pendiente">{NOMBRE.pendiente}</option>
                          <option value="rechazado">{NOMBRE.rechazado}</option>
                        </select>
                      )}
                    </td>
                    <td className="text-right text-slate-300 whitespace-nowrap num">{euros(p.total)}</td>
                    <td className="whitespace-nowrap">
                      {p.numeroPedido ? (
                        <Badge tono="green">{p.numeroPedido}</Badge>
                      ) : p.estado === "pendiente" ? (
                        <button onClick={() => pasarAPedido(p)} className="text-xs text-amber-300 hover:underline">
                          Aceptar → pedido
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          imprimirDocumento({
                            tipo: "Presupuesto de compra",
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
                      {p.estado !== "aceptado" && (
                        <button
                          onClick={() => setForm({ modo: "editar", presupuesto: p })}
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
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-slate-500 py-8">
                      Sin resultados para «{q}».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form?.modo === "nuevo" && (
        <FormDocumentoCompra
          titulo="Nuevo presupuesto de compra"
          url="/api/presupuestos-compra"
          conNumeroProveedor
          etiquetaNumero="Nº presupuesto del proveedor"
          campoNumero="numeroPresupuestoProveedor"
          onGuardado={() => { setForm(null); cargar(); }}
          onCerrar={() => setForm(null)}
        />
      )}
      {form?.modo === "editar" && (
        <FormDocumentoCompra
          titulo={`Presupuesto ${form.presupuesto.numero}`}
          url={`/api/presupuestos-compra/${form.presupuesto._id}`}
          metodo="PUT"
          conNumeroProveedor
          etiquetaNumero="Nº presupuesto del proveedor"
          campoNumero="numeroPresupuestoProveedor"
          inicial={{
            proveedor: form.presupuesto.proveedor?._id ?? form.presupuesto.proveedor,
            fecha: aInput(form.presupuesto.fecha),
            numeroPresupuestoProveedor: form.presupuesto.numeroPresupuestoProveedor ?? "",
            notas: form.presupuesto.notas ?? "",
            lineas: form.presupuesto.lineas,
          }}
          onGuardado={() => { setForm(null); cargar(); }}
          onCerrar={() => setForm(null)}
        />
      )}
    </>
  );
}
