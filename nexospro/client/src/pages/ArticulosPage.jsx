import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import SelectorContacto from "../components/SelectorContacto.jsx";
import { Badge, EstadoVacio, euros } from "../components/ui.jsx";
import { IconArticulos, IconEditar, IconBorrar, IconImprimir } from "../components/icons.jsx";
import { imprimirFicha } from "../utils/imprimir.js";

const VACIO = {
  tipo: "articulo", codigo: "", descripcion: "", detalle: "", unidad: "ud",
  precioCompra: 0, precioVenta: 0, iva: 21, proveedor: "",
  referenciaProveedor: "", codigoBarras: "", familia: "", imagen: "",
  stock: 0, stockMinimo: 0,
};

// Sube una imagen al servidor y devuelve la ruta pública (/uploads/...).
async function subirImagen(archivo) {
  const fd = new FormData();
  fd.append("imagen", archivo);
  const r = await fetch("/api/articulos/imagen", { method: "POST", body: fd });
  const datos = await r.json();
  if (!r.ok) throw new Error(datos.error || "No se pudo subir la imagen");
  return datos.ruta;
}

function urlImagen(ruta) {
  if (!ruta) return null;
  if (ruta.startsWith("http")) return ruta;
  return ruta.startsWith("/") ? ruta : `/uploads/${ruta}`;
}

function SelectorImagen({ valor, onCambio }) {
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const src = urlImagen(valor);

  async function alElegir(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      onCambio(await subirImagen(archivo));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="w-16 h-16 rounded-xl bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
        {src ? (
          <img src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-slate-500 text-xs text-center px-1">Sin imagen</span>
        )}
      </span>
      <div className="space-y-1">
        <input ref={inputRef} type="file" accept="image/*" onChange={alElegir} className="hidden" />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="btn-ghost text-sm"
          >
            {subiendo ? "Subiendo…" : src ? "Cambiar imagen" : "Subir imagen"}
          </button>
          {src && (
            <button type="button" onClick={() => onCambio("")} className="btn-ghost text-sm text-rose-400">
              Quitar
            </button>
          )}
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  );
}

function FormArticulo({ inicial, proveedores, familias, onProveedorCreado, onGuardado, onCerrar }) {
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
          stock: Number(form.stock) || 0,
          stockMinimo: Number(form.stockMinimo) || 0,
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Stock actual</label>
              <input type="number" step="1" value={form.stock} onChange={poner("stock")} className="input" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Stock mínimo (aviso)</label>
              <input type="number" step="1" value={form.stockMinimo} onChange={poner("stockMinimo")} className="input" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Proveedor habitual</label>
              <SelectorContacto
                tipo="proveedor"
                contactos={proveedores}
                valor={form.proveedor}
                onChange={(id) => setForm((f) => ({ ...f, proveedor: id }))}
                onCreado={onProveedorCreado}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Código proveedor</label>
              <input value={form.referenciaProveedor} onChange={poner("referenciaProveedor")} className="input" placeholder="Ref. del proveedor" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Código de barras / QR</label>
              <input value={form.codigoBarras} onChange={poner("codigoBarras")} className="input" placeholder="Ej. 8412345678901" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Familia (TPV)</label>
              <input
                value={form.familia ?? ""}
                onChange={poner("familia")}
                className="input"
                placeholder="Ej. Bebidas, Panadería…"
                list="familias-tpv"
              />
              <datalist id="familias-tpv">
                {familias.map((f) => <option key={f} value={f} />)}
              </datalist>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1">Imagen para el TPV</label>
            <SelectorImagen valor={form.imagen ?? ""} onCambio={(ruta) => setForm((f) => ({ ...f, imagen: ruta }))} />
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

// Gestión de las familias del TPV: nombre, orden, color e imagen. Los
// artículos de esa familia heredan el color en la rejilla del terminal.
function ModalFamilias({ familias, nombresDeArticulos, onCambio, onCerrar }) {
  const [editando, setEditando] = useState(null); // familia | { nueva: true }
  const [error, setError] = useState(null);

  // Familias que existen como texto en artículos pero aún no tienen ficha.
  const sinFicha = nombresDeArticulos.filter((n) => !familias.some((f) => f.nombre === n));

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    const datos = {
      nombre: editando.nombre,
      orden: Number(editando.orden) || 0,
      color: editando.color ?? "",
      imagen: editando.imagen ?? "",
    };
    try {
      const r = await fetch(editando._id ? `/api/tpv/familias/${editando._id}` : "/api/tpv/familias", {
        method: editando._id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const resp = await r.json();
      if (!r.ok) throw new Error(resp.error || "No se pudo guardar");
      setEditando(null);
      onCambio();
    } catch (err) {
      setError(err.message);
    }
  }

  async function borrar(f) {
    if (!window.confirm(`¿Borrar la familia "${f.nombre}"? Los artículos conservarán el nombre.`)) return;
    const r = await fetch(`/api/tpv/familias/${f._id}`, { method: "DELETE" });
    if (r.ok) onCambio();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Familias del TPV</h2>
          <button onClick={onCerrar} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {error && <p className="text-sm text-rose-400 mb-3">{error}</p>}

        {editando ? (
          <form onSubmit={guardar} className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Nombre *</label>
              <input
                value={editando.nombre ?? ""}
                onChange={(e) => setEditando((f) => ({ ...f, nombre: e.target.value }))}
                className="input"
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-1">
                Debe coincidir con la «Familia (TPV)» que pongas en los artículos.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Orden</label>
                <input
                  type="number"
                  value={editando.orden ?? 0}
                  onChange={(e) => setEditando((f) => ({ ...f, orden: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editando.color || "#6366f1"}
                    onChange={(e) => setEditando((f) => ({ ...f, color: e.target.value }))}
                    className="w-12 h-10 rounded cursor-pointer bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setEditando((f) => ({ ...f, color: "" }))}
                    className="btn-ghost text-xs"
                  >
                    Automático
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Imagen de la familia</label>
              <SelectorImagen
                valor={editando.imagen ?? ""}
                onCambio={(ruta) => setEditando((f) => ({ ...f, imagen: ruta }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditando(null)} className="btn-ghost">Volver</button>
              <button type="submit" className="btn-primary">Guardar</button>
            </div>
          </form>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {familias.map((f) => (
                <div key={f._id} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
                  <span
                    className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: f.color || "#475569" }}
                  >
                    {f.imagen ? (
                      <img src={urlImagen(f.imagen)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      f.nombre.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-200 truncate">{f.nombre}</p>
                    <p className="text-xs text-slate-500">Orden {f.orden ?? 0}{f.color ? ` · ${f.color}` : ""}</p>
                  </div>
                  <button
                    onClick={() => setEditando({ ...f })}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10"
                    title="Editar"
                  >
                    <IconEditar />
                  </button>
                  <button
                    onClick={() => borrar(f)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-400/10"
                    title="Eliminar"
                  >
                    <IconBorrar />
                  </button>
                </div>
              ))}
              {!familias.length && (
                <p className="text-sm text-slate-500 text-center py-4">
                  Aún no hay familias configuradas. Las que uses en los artículos aparecerán igualmente, con color automático.
                </p>
              )}
            </div>

            {sinFicha.length > 0 && (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs text-amber-300 mb-2">
                  Estas familias existen en artículos pero no tienen ficha (usan color automático):
                </p>
                <div className="flex flex-wrap gap-2">
                  {sinFicha.map((n) => (
                    <button
                      key={n}
                      onClick={() => setEditando({ nombre: n, orden: 0, color: "", imagen: "" })}
                      className="px-2 py-1 rounded-lg bg-white/10 text-slate-200 text-xs hover:bg-white/20"
                    >
                      {n} — configurar
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setEditando({ nombre: "", orden: familias.length + 1, color: "", imagen: "" })}
              className="btn-primary w-full"
            >
              Nueva familia
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ArticulosPage() {
  const [lista, setLista] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  const [familiasTpv, setFamiliasTpv] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null); // null | {} | articulo
  const [verFamilias, setVerFamilias] = useState(false);

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

  async function cargarFamilias() {
    try {
      const r = await fetch("/api/tpv/familias");
      if (r.ok) setFamiliasTpv(await r.json());
    } catch { /* sin familias configuradas */ }
  }

  useEffect(() => {
    cargar("");
    cargarFamilias();
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

  const nombresFamilias = [
    ...new Set([
      ...familiasTpv.map((f) => f.nombre),
      ...(lista ?? []).map((a) => a.familia).filter(Boolean),
    ]),
  ].sort();

  return (
    <>
      <CabeceraPagina
        titulo="Artículos"
        contador={lista ? `${lista.length} artículos` : null}
        descripcion="Catálogo de productos y servicios para usar en tus documentos."
      >
        <button onClick={() => window.print()} className="btn-ghost mr-2">Imprimir</button>
        <button onClick={() => setVerFamilias(true)} className="btn-ghost mr-2">Familias TPV</button>
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
                  <th>Familia</th>
                  <th className="text-right whitespace-nowrap">Stock</th>
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
                {lista.map((a) => {
                  const sinStock = a.tipo !== "servicio" && (a.stock ?? 0) <= (a.stockMinimo ?? 0);
                  return (
                  <tr key={a._id}>
                    <td className="max-w-[380px]">
                      <div className="flex items-center gap-2.5">
                        {a.imagen ? (
                          <img
                            src={urlImagen(a.imagen)}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 text-violet-600 shrink-0">
                            <IconArticulos />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-[#0f172a] truncate">
                            {a.descripcion}
                            {a.origen === "ocr" && (
                              <span className="ml-2 text-[0.625rem] font-bold px-1.5 py-0.5 rounded bg-accent/10 text-accent align-middle">
                                AUTO
                              </span>
                            )}
                            {a.tipo === "servicio" && (
                              <span className="ml-2 text-[0.625rem] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 align-middle">
                                servicio
                              </span>
                            )}
                          </p>
                          <p className="num text-[0.6875rem] text-slate-400">{a.codigo ?? ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-slate-500 whitespace-nowrap">{a.familia || "—"}</td>
                    <td className="text-right whitespace-nowrap">
                      {a.tipo === "servicio" ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className={`num font-semibold ${sinStock ? "text-rose-500" : "text-[#0f172a]"}`}>
                          {a.stock ?? 0}
                          {sinStock && <span className="ml-1 text-[0.625rem] font-bold uppercase">bajo</span>}
                        </span>
                      )}
                    </td>
                    <td className="text-slate-500 whitespace-nowrap max-w-[140px] truncate">{a.referenciaProveedor ?? "—"}</td>
                    <td className="num text-[0.75rem] text-slate-500 whitespace-nowrap max-w-[140px] truncate">{a.codigoBarras ?? "—"}</td>
                    <td className="whitespace-nowrap max-w-[220px]">
                      {a.origenDocumentos?.length > 0 ? (
                        <span
                          className="num inline-flex items-center gap-1 text-[0.6875rem]"
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
                    <td className="num text-[0.75rem] text-slate-500">{a.iva}%</td>
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
                              ["Familia TPV", a.familia],
                              ["Stock actual", a.tipo === "servicio" ? undefined : `${a.stock ?? 0} ${a.unidad ?? "ud"}`],
                              ["Stock mínimo", a.tipo === "servicio" ? undefined : String(a.stockMinimo ?? 0)],
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <FormArticulo
          inicial={form._id ? form : null}
          proveedores={proveedores}
          familias={nombresFamilias}
          onProveedorCreado={(p) => setProveedores((ps) => [...ps, p])}
          onGuardado={() => { setForm(null); cargar(); }}
          onCerrar={() => setForm(null)}
        />
      )}

      {verFamilias && (
        <ModalFamilias
          familias={familiasTpv}
          nombresDeArticulos={[...new Set((lista ?? []).map((a) => a.familia).filter(Boolean))]}
          onCambio={cargarFamilias}
          onCerrar={() => setVerFamilias(false)}
        />
      )}
    </>
  );
}
