import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { EstadoVacio, InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import { enterComoTab } from "../../utils/enter-tab.js";

const campo = "input w-full";
const VACIO = {
  nombre: "",
  nif: "",
  telefono: "",
  email: "",
  contacto: "",
  calle: "",
  ciudad: "",
  cp: "",
  precioHoraMO: "",
  dtoManoObra: "",
  dtoMateriales: "",
  dtoTotal: "",
  notas: "",
};

const pct = (v) => (Number(v) > 0 ? `${v} %` : "—");
const precio = (v) => (Number(v) > 0 ? `${Number(v).toLocaleString("es-ES")} €/h` : "—");

export default function TallerAseguradorasPage() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [q, setQ] = useState("");

  // Filtra por todos los campos visibles de la tabla.
  const filtrada = (lista ?? []).filter((a) =>
    coincideBusqueda(q, a.nombre, a.nif, a.telefono, a.email, a.contacto, a.ciudad)
  );

  async function cargar() {
    try {
      const r = await fetch("/api/taller/aseguradoras");
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

  function abrirNueva() {
    setEditando(null);
    setForm(VACIO);
    setModal(true);
  }

  function abrirEdicion(a) {
    setEditando(a);
    setForm({
      nombre: a.nombre ?? "",
      nif: a.nif ?? "",
      telefono: a.telefono ?? "",
      email: a.email ?? "",
      contacto: a.contacto ?? "",
      calle: a.calle ?? "",
      ciudad: a.ciudad ?? "",
      cp: a.cp ?? "",
      precioHoraMO: a.precioHoraMO || "",
      dtoManoObra: a.dtoManoObra || "",
      dtoMateriales: a.dtoMateriales || "",
      dtoTotal: a.dtoTotal || "",
      notas: a.notas ?? "",
    });
    setModal(true);
  }

  async function guardar(e) {
    e.preventDefault();
    const r = await fetch(`/api/taller/aseguradoras${editando ? `/${editando._id}` : ""}`, {
      method: editando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const datos = await r.json();
    if (r.ok) {
      setModal(false);
      cargar();
    } else alert(datos.error || "Error al guardar");
  }

  async function borrar(a) {
    if (!window.confirm(`¿Borrar la aseguradora ${a.nombre}?`)) return;
    const r = await fetch(`/api/taller/aseguradoras/${a._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  return (
    <>
      <CabeceraPagina
        titulo="Aseguradoras"
        descripcion="Compañías con sus condiciones negociadas: precio de hora y descuentos."
      >
        <button onClick={abrirNueva} className="btn-primary">
          Nueva aseguradora
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
            titulo="Sin aseguradoras"
            descripcion="Da de alta la primera compañía con el precio de hora y los descuentos pactados."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>NIF</th>
                  <th>Teléfono</th>
                  <th>Contacto</th>
                  <th className="text-right">Hora MO</th>
                  <th className="text-right">Dto. MO</th>
                  <th className="text-right">Dto. materiales</th>
                  <th className="text-right">Dto. total</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((a) => (
                  <tr key={a._id}>
                    <td className="font-semibold text-white">{a.nombre}</td>
                    <td className="text-slate-400 num">{a.nif ?? "—"}</td>
                    <td className="text-slate-300 num">{a.telefono ?? "—"}</td>
                    <td className="text-slate-400">{a.contacto ?? "—"}</td>
                    <td className="text-right text-slate-300 num">{precio(a.precioHoraMO)}</td>
                    <td className="text-right text-slate-300 num">{pct(a.dtoManoObra)}</td>
                    <td className="text-right text-slate-300 num">{pct(a.dtoMateriales)}</td>
                    <td className="text-right text-slate-300 num">{pct(a.dtoTotal)}</td>
                    <td className="text-right whitespace-nowrap">
                      <button onClick={() => abrirEdicion(a)} className="text-xs text-accent hover:underline mr-3">
                        Editar
                      </button>
                      <button onClick={() => borrar(a)} className="text-xs text-rose-400 hover:underline">
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-slate-500 py-8">
                      Sin resultados para «{q}».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <div
            className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white mb-4">
              {editando ? `Editar ${editando.nombre}` : "Nueva aseguradora"}
            </h2>
            <form onSubmit={guardar} onKeyDown={enterComoTab} className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-sm text-slate-400 block mb-1">Nombre *</label>
                  <input
                    className={campo}
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">NIF</label>
                  <input
                    className={`${campo} uppercase`}
                    value={form.nif}
                    onChange={(e) => setForm({ ...form, nif: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Teléfono</label>
                  <input
                    className={campo}
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Email</label>
                  <input
                    type="email"
                    className={campo}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Contacto / perito</label>
                  <input
                    className={campo}
                    value={form.contacto}
                    onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-sm text-slate-400 block mb-1">Calle</label>
                  <input
                    className={campo}
                    value={form.calle}
                    onChange={(e) => setForm({ ...form, calle: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Ciudad</label>
                  <input
                    className={campo}
                    value={form.ciudad}
                    onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">CP</label>
                  <input
                    className={campo}
                    value={form.cp}
                    onChange={(e) => setForm({ ...form, cp: e.target.value })}
                  />
                </div>
              </div>

              <fieldset className="rounded-xl border border-white/10 p-4">
                <legend className="text-xs uppercase tracking-wider text-slate-500 px-1">
                  Condiciones negociadas
                </legend>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">€/hora MO</label>
                    <input
                      type="number" min="0" step="0.01"
                      className={`${campo} text-right`}
                      value={form.precioHoraMO}
                      onChange={(e) => setForm({ ...form, precioHoraMO: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Dto. MO %</label>
                    <input
                      type="number" min="0" max="100" step="0.5"
                      className={`${campo} text-right`}
                      value={form.dtoManoObra}
                      onChange={(e) => setForm({ ...form, dtoManoObra: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Dto. materiales %</label>
                    <input
                      type="number" min="0" max="100" step="0.5"
                      className={`${campo} text-right`}
                      value={form.dtoMateriales}
                      onChange={(e) => setForm({ ...form, dtoMateriales: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Dto. total %</label>
                    <input
                      type="number" min="0" max="100" step="0.5"
                      className={`${campo} text-right`}
                      value={form.dtoTotal}
                      onChange={(e) => setForm({ ...form, dtoTotal: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <p className="text-[0.71875rem] text-slate-500 mt-2">
                  El descuento total, si tiene valor, sustituye a los de mano de obra y materiales.
                </p>
              </fieldset>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Notas</label>
                <textarea
                  className={`${campo} resize-none`}
                  rows={2}
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setModal(false)} className="btn-ghost">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
