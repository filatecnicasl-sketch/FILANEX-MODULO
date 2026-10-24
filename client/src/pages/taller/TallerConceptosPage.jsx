import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { EstadoVacio } from "../../components/ui.jsx";

const campo = "input w-full";
const VACIO = { codigo: "", descripcion: "", seccion: "mo_chapa" };

const SECCIONES = {
  piezas: "Piezas sustituidas",
  mo_chapa: "Mano de obra chapa",
  mo_pintura: "M.O. pintura / material",
};

// Catálogo de conceptos de taller: operaciones con código corto que se
// teclean en las líneas de la orden/factura ("1" = Reparar…). La sección
// decide el bloque de la factura de taller en el impreso.
export default function TallerConceptosPage() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);

  async function cargar() {
    try {
      const r = await fetch("/api/taller/conceptos");
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

  function abrirNuevo() {
    setEditando(null);
    setForm(VACIO);
    setModal(true);
  }

  function abrirEdicion(c) {
    setEditando(c);
    setForm({ codigo: c.codigo, descripcion: c.descripcion, seccion: c.seccion });
    setModal(true);
  }

  async function guardar(e) {
    e.preventDefault();
    const r = await fetch(`/api/taller/conceptos${editando ? `/${editando._id}` : ""}`, {
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

  async function borrar(c) {
    if (!window.confirm(`¿Borrar el concepto ${c.codigo} · ${c.descripcion}?`)) return;
    const r = await fetch(`/api/taller/conceptos/${c._id}`, { method: "DELETE" });
    const datos = await r.json();
    if (r.ok) cargar();
    else alert(datos.error || "No se pudo borrar");
  }

  return (
    <>
      <CabeceraPagina
        titulo="Conceptos de taller"
        descripcion="Operaciones con código: en las líneas de la orden o factura tecleas el código y sale la descripción. La sección decide el bloque del impreso."
      >
        <button onClick={abrirNuevo} className="btn-primary">
          Nuevo concepto
        </button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      <div className="panel px-3.5 py-2">
        {!lista ? null : lista.length === 0 ? (
          <EstadoVacio titulo="Sin conceptos" descripcion="Crea el primer concepto con su código." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Bloque de la factura</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-bold text-slate-700 num">{c.codigo}</span>
                    </td>
                    <td className="text-slate-300">{c.descripcion}</td>
                    <td className="text-slate-300">{SECCIONES[c.seccion] ?? c.seccion}</td>
                    <td className="text-right whitespace-nowrap">
                      <button onClick={() => abrirEdicion(c)} className="text-xs text-accent hover:underline mr-3">
                        Editar
                      </button>
                      <button onClick={() => borrar(c)} className="text-xs text-rose-400 hover:underline">
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

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <div className="modal-panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">
              {editando ? `Concepto ${editando.codigo}` : "Nuevo concepto"}
            </h2>
            <form onSubmit={guardar} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Código *</label>
                  <input
                    className={campo}
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-slate-400 block mb-1">Descripción *</label>
                  <input
                    className={campo}
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Bloque de la factura</label>
                <select
                  className={campo}
                  value={form.seccion}
                  onChange={(e) => setForm({ ...form, seccion: e.target.value })}
                >
                  <option value="mo_chapa">Mano de obra chapa</option>
                  <option value="mo_pintura">Mano de obra pintura / material</option>
                  <option value="piezas">Piezas sustituidas</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
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
