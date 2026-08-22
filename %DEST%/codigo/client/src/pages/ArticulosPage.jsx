import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio, euros } from "../components/ui.jsx";
import { IconArticulos, IconEditar, IconBorrar, IconImprimir } from "../components/icons.jsx";
import { imprimirFicha } from "../utils/imprimir.js";

const VACIO = {
  tipo: "articulo", codigo: "", descripcion: "", detalle: "", unidad: "ud",
  precioCompra: 0, precioVenta: 0, iva: 21, proveedor: "",
  referenciaProveedor: "", codigoBarras: "",
};

function FormArticulo({ inicial, proveedores, onGuardado, onCerrar }) {
  const editando = Boolean(inicial?._id);
  const [form, setForm] = useState({
    ...VACIO,
    ...(inicial ?? {}),
    proveedor: inicial?.proveedor?._id ?? inicial?.proveedor ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const poner = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    if (!form.descripcion.trim()) return setError("El nombre es obligatorio");
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(editando ? `/api/articulos/${inicial._id}` : "/api/articulos", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          precioCompra: Number(form.precioCompra) || 0,
          precioVenta: Number(form.precioVenta) || 0,
          iva: Number(form.iva) || 0,
          proveedor: form.proveedor || undefined,
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo guardar");
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">
          {editando ? `Editar ${inicial.codigo ?? "artículo"}` : "Nuevo artículo"}
        </h2>
        <form onSubmit={guardar} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Referencia (automática)</label>
              <input
                value={form.codigo}
                onChange={poner("codigo")}
                disabled={editando}
                placeholder="Se generará automáticamente"
                className="input disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Tipo</label>
              <select value={form.tipo} onChange={poner("tipo")} className="input">
                <option value="articulo">Artículo</option>
                <option value="servicio">Servicio</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1">Nombre *</label>
            <input value={form.descripcion} onChange={poner("descripcion")} className="input" autoFocus />
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1">Descripción</label>
            <textarea value={form.detalle} onChange={poner("detalle")} rows={2} className="input" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Unidad</label>
              <input value={form.unidad} onChange={poner("unidad")} className="input" placeholder="ud" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">P. coste</label>
              <input type="number" step="0.01" value={form.precioCompra} onChange={poner("precioCompra")} className="input" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Precio (sin IVA)</label>
              <input type="number" step="0.01" value={form.precioVenta} onChange={poner("precioVenta")} className="input" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Tipo IVA</label>
              <select value={form.iva} onChange={poner("iva")} className="input">
                {[0, 4, 10, 21].map((t) => <option key={t} value={t}>{t}%</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Proveedor habitual</label>
              <select value={form.proveedor} onChange={poner("proveedor")} className="input">
                <option value="">—</option>
                {proveedores.map((p) => <option key={p._id} value={p._id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Código proveedor</label>
              <input value={form.referenciaProveedor} onChange={poner("referenciaProveedor")} className="input" placeholder="Ref. del proveedor" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Código de barras / QR</label>
              <input value={form.codigoBarras} onChange={poner("codigoBarras")} className="input" placeholder="Ej. 8412345678901" />
            </div>
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ArticulosPage() {
  const [lista, setLista] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null); // null | {} | articulo

  async function cargar(busqueda = q) {
    try {
      const r = await fetch(`/api/articulos?q=${encodeURIComponent(busqueda)}`);
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setLista(datos);
    } catch (e) {
      setError(e.message);
      setLista([]);
    }
  }

  useEffect(() => {
    cargar("");
    fetch("/api/proveedores")
      .then((r) => (r.ok ? r.json() : []))
      .then(setProveedores)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buscar(e) {
    e.preventDefault();
    cargar(q);
  }

  async function borrar(a) {
    if (!window.confirm(`¿Borrar "${a.descripcion}"?`)) return;
    const r = await fetch(`/api/articulos/${a._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  return (
    <>
      <CabeceraPagina
        titulo="Artículos"
        contador={lista ? `${lista.length} artículos` : null}
        descripcion="Catálogo de productos y servicios para usar en tus documentos."
      >
        <button onClick={() => window.print()} className="btn-ghost mr-2">Imprimir</button>
        <button onClick={() => setForm(VACIO)} className="btn-primary">Nuevo artículo</button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      <form onSubmit={buscar} className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onInput={(e) => { if (!e.target.value) cargar(""); }}
          placeholder="Buscar por nombre, referencia o código…"
          className="input w-full md:w-96"
        />
      </form>

      <div className="panel px-3.5 py-2">
        {!lista ? null : lista.length === 0 ? (
          <EstadoVacio
            titulo="Catálogo vacío"
            descripcion="Crea el primer artículo a mano o deja que el OCR lo dé de alta al validar una factura de compra."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Artículo</th>
                  <th className="whitespace-nowrap">Cód. prov.</th>
                  <th className="whitespace-nowrap">Cód. barras/QR</th>
                  <th>Origen (documentos)</th>
                  <th className="whitespace-nowrap">Unidad</th>
                  <th className="text-right whitespace-nowrap">Precio</th>
                  <th className="whitespace-nowrap">IVA</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a._id}>
                    <td className="max-w-[380px]">
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 text-violet-600 shrink-0">
                          <IconArticulos />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-[#0f172a] truncate">
                            {a.descripcion}
                            {a.origen === "ocr" && (
                              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/10 text-accent align-middle">
                                AUTO
                              </span>
                            )}
                            {a.tipo === "servicio" && (
                              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 align-middle">
                                servicio
                              </span>
                            )}
                          </p>
                          <p className="num text-[11px] text-slate-400">{a.codigo ?? ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-slate-500 whitespace-nowrap max-w-[140px] truncate">{a.referenciaProveedor ?? "—"}</td>
                    <td className="num text-[12px] text-slate-500 whitespace-nowrap max-w-[140px] truncate">{a.codigoBarras ?? "—"}</td>
                    <td className="whitespace-nowrap max-w-[220px]">
                      {a.origenDocumentos?.length > 0 ? (
                        <span
                          className="num inline-flex items-center gap-1 text-[11px]"
                          title={a.origenDocumentos.join(" · ")}
                        >
                          <Badge tono="slate">{a.origenDocumentos[0]}</Badge>
                          {a.origenDocumentos.length > 1 && (
                            <Badge tono="slate">+{a.origenDocumentos.length - 1}</Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-slate-500">{a.unidad ?? "ud"}</td>
                    <td className="num text-right font-medium text-[#0f172a] whitespace-nowrap">{euros(a.precioVenta)}</td>
                    <td className="num text-[12px] text-slate-500">{a.iva}%</td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          imprimirFicha({
                            titulo: "Artículo",
                            subtitulo: `${a.codigo ?? ""} · ${a.descripcion}`,
                            campos: [
                              ["Código", a.codigo],
                              ["Descripción", a.descripcion],
                              ["Detalle", a.detalle],
                              ["Tipo", a.tipo === "servicio" ? "Servicio" : "Artículo"],
                              ["Referencia proveedor", a.referenciaProveedor],
                              ["Código de barras", a.codigoBarras],
                              ["Unidad", a.unidad],
                              ["Precio de coste", a.precioCompra ? euros(a.precioCompra) : undefined],
                              ["Precio de venta", a.precioVenta ? euros(a.precioVenta) : undefined],
                              ["IVA", `${a.iva}%`],
                              ["Proveedor habitual", a.proveedor?.nombre],
                              ["Alta automática (OCR)", a.origen === "ocr" ? "Sí" : undefined],
                            ],
                          })
                        }
                        title="Imprimir ficha"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors mr-1"
                      >
                        <IconImprimir />
                      </button>
                      <button
                        onClick={() => setForm(a)}
                        title="Editar"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors mr-1"
                      >
                        <IconEditar />
                      </button>
                      <button
                        onClick={() => borrar(a)}
                        title="Eliminar"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                      >
                        <IconBorrar />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <FormArticulo
          inicial={form._id ? form : null}
          proveedores={proveedores}
          onGuardado={() => { setForm(null); cargar(); }}
          onCerrar={() => setForm(null)}
        />
      )}
    </>
  );
}
