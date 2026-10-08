import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { EstadoVacio, InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import { IconEditar, IconBorrar } from "../../components/icons.jsx";

const VACIO = {
  nombre: "", comercializadoraId: "", nif: "", telefono: "", email: "", contacto: "", notas: "",
};

export default function EnergiaCanalesPage() {
  const [lista, setLista] = useState(null);
  const [comercializadoras, setComercializadoras] = useState([]);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [q, setQ] = useState("");

  const filtrada = (lista ?? []).filter((c) =>
    coincideBusqueda(
      q,
      c.nombre,
      c.comercializadoraNombre,
      c.nif,
      c.telefono,
      c.email,
      c.contacto
    )
  );

  async function cargar() {
    try {
      const [r, rc] = await Promise.all([
        fetch("/api/energia/canales"),
        fetch("/api/energia/comercializadoras"),
      ]);
      const datos = await r.json();
      const coms = await rc.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setLista(datos);
      setComercializadoras(Array.isArray(coms) ? coms : []);
    } catch (e) {
      setError(e.message);
      setLista([]);
      setComercializadoras([]);
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
    setForm({
      nombre: c.nombre ?? "",
      comercializadoraId: c.comercializadora?._id ?? "",
      nif: c.nif ?? "",
      telefono: c.telefono ?? "",
      email: c.email ?? "",
      contacto: c.contacto ?? "",
      notas: c.notas ?? "",
    });
    setModal(true);
  }

  async function guardar(e) {
    e.preventDefault();
    const cuerpo = {
      nombre: form.nombre,
      comercializadora: form.comercializadoraId || null,
      nif: form.nif,
      telefono: form.telefono,
      email: form.email,
      contacto: form.contacto,
      notas: form.notas,
    };
    const r = await fetch(`/api/energia/canales${editando ? `/${editando._id}` : ""}`, {
      method: editando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const datos = await r.json();
    if (r.ok) {
      setModal(false);
      cargar();
    } else alert(datos.error || "Error al guardar");
  }

  async function borrar(c) {
    if (!window.confirm(`¿Borrar el canal ${c.nombre}?`)) return;
    const r = await fetch(`/api/energia/canales/${c._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  const poner = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <CabeceraPagina
      titulo="Canales de distribución"
      descripcion="Distribuidores o intermediarios por los que das de alta los suministros de cada comercializadora."
    >
      {error && <div className="panel px-4 py-3 text-sm text-rose-400 mb-3">{error}</div>}

      {lista === null ? (
        <div className="panel px-4 py-10 text-center text-slate-500">Cargando…</div>
      ) : lista.length === 0 && comercializadoras.length === 0 ? (
        <EstadoVacio
          titulo="Sin comercializadoras"
          descripcion="Primero da de alta al menos una comercializadora para poder crear sus canales de distribución."
          accion="Ir a comercializadoras"
          onAccion={() => (window.location.href = "/energia/comercializadoras")}
        />
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por nombre, comercializadora, contacto…" />
            <button onClick={abrirNuevo} className="btn-primary whitespace-nowrap">Nuevo canal</button>
          </div>

          <div className="panel overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Canal / distribuidor</th>
                  <th>Comercializadora</th>
                  <th>Contacto</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-slate-500 py-6">
                      Ningún canal coincide con la búsqueda.
                    </td>
                  </tr>
                )}
                {filtrada.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <p className="font-medium text-slate-200 whitespace-nowrap">{c.nombre}</p>
                      <p className="num text-xs text-slate-500 whitespace-nowrap">{c.nif ?? ""}</p>
                    </td>
                    <td className="text-slate-300">{c.comercializadoraNombre ?? c.comercializadora?.nombre ?? "—"}</td>
                    <td className="text-slate-300">
                      {c.contacto || c.telefono || c.email ? (
                        <>
                          {c.contacto && <p>{c.contacto}</p>}
                          <p className="num text-xs text-slate-500 whitespace-nowrap">{c.telefono ?? ""} {c.email ?? ""}</p>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button onClick={() => abrirEdicion(c)} className="p-1.5 text-slate-400 hover:text-sky-400" title="Editar">
                        <IconEditar />
                      </button>
                      <button onClick={() => borrar(c)} className="p-1.5 text-slate-400 hover:text-rose-400" title="Borrar">
                        <IconBorrar />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <form
            className="panel max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <h2 className="text-lg font-bold text-white">
              {editando ? `Editar ${editando.nombre}` : "Nuevo canal de distribución"}
            </h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm text-slate-400">
                Nombre *
                <input value={form.nombre} onChange={poner("nombre")} className="input" autoFocus required />
              </label>
              <label className="text-sm text-slate-400">
                Comercializadora *
                <select
                  value={form.comercializadoraId}
                  onChange={poner("comercializadoraId")}
                  className="input"
                  required
                >
                  <option value="">— Selecciona —</option>
                  {comercializadoras.map((c) => (
                    <option key={c._id} value={c._id}>{c.nombre}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-400">
                NIF/CIF
                <input value={form.nif} onChange={poner("nif")} className="input" />
              </label>
              <label className="text-sm text-slate-400">
                Teléfono
                <input value={form.telefono} onChange={poner("telefono")} className="input" />
              </label>
              <label className="text-sm text-slate-400">
                Email
                <input value={form.email} onChange={poner("email")} className="input" type="email" />
              </label>
              <label className="text-sm text-slate-400">
                Persona de contacto
                <input value={form.contacto} onChange={poner("contacto")} className="input" />
              </label>
            </div>

            <label className="text-sm text-slate-400 block">
              Notas
              <textarea value={form.notas} onChange={poner("notas")} className="input" rows={2} />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
              <button type="submit" className="btn-primary">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </CabeceraPagina>
  );
}
