import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { EstadoVacio, InputBusqueda, coincideBusqueda, euros } from "../../components/ui.jsx";
import { IconEditar, IconBorrar } from "../../components/icons.jsx";

const VACIO = {
  nombre: "", nif: "", telefono: "", email: "", contacto: "",
  calle: "", ciudad: "", cp: "",
  altaLuz: "", mensualLuz: "", anualLuz: "",
  altaGas: "", mensualGas: "", anualGas: "",
  notas: "",
};

const eurosSi = (v) => (Number(v) > 0 ? euros(Number(v)) : "—");

export default function EnergiaComercializadorasPage() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [q, setQ] = useState("");

  // Filtra por todos los campos visibles de la tabla.
  const filtrada = (lista ?? []).filter((c) =>
    coincideBusqueda(q, c.nombre, c.nif, c.telefono, c.email, c.contacto, c.ciudad)
  );

  async function cargar() {
    try {
      const r = await fetch("/api/energia/comercializadoras");
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

  function abrirEdicion(c) {
    setEditando(c);
    setForm({
      nombre: c.nombre ?? "",
      nif: c.nif ?? "",
      telefono: c.telefono ?? "",
      email: c.email ?? "",
      contacto: c.contacto ?? "",
      calle: c.calle ?? "",
      ciudad: c.ciudad ?? "",
      cp: c.cp ?? "",
      altaLuz: c.condiciones?.luz?.alta || "",
      mensualLuz: c.condiciones?.luz?.mensual || "",
      anualLuz: c.condiciones?.luz?.anual || "",
      altaGas: c.condiciones?.gas?.alta || "",
      mensualGas: c.condiciones?.gas?.mensual || "",
      anualGas: c.condiciones?.gas?.anual || "",
      notas: c.notas ?? "",
    });
    setModal(true);
  }

  async function guardar(e) {
    e.preventDefault();
    const cuerpo = {
      nombre: form.nombre,
      nif: form.nif,
      telefono: form.telefono,
      email: form.email,
      contacto: form.contacto,
      calle: form.calle,
      ciudad: form.ciudad,
      cp: form.cp,
      condiciones: {
        luz: { alta: form.altaLuz, mensual: form.mensualLuz, anual: form.anualLuz },
        gas: { alta: form.altaGas, mensual: form.mensualGas, anual: form.anualGas },
      },
      notas: form.notas,
    };
    const r = await fetch(`/api/energia/comercializadoras${editando ? `/${editando._id}` : ""}`, {
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
    if (!window.confirm(`¿Borrar la comercializadora ${c.nombre}?`)) return;
    const r = await fetch(`/api/energia/comercializadoras/${c._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  const poner = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <CabeceraPagina titulo="Comercializadoras" descripcion="Compañías con las que trabaja la agencia y sus condiciones de comisión.">
      {error && <div className="panel px-4 py-3 text-sm text-rose-400 mb-3">{error}</div>}

      {lista === null ? (
        <div className="panel px-4 py-10 text-center text-slate-500">Cargando…</div>
      ) : lista.length === 0 ? (
        <EstadoVacio
          titulo="Sin comercializadoras"
          descripcion="Da de alta la primera comercializadora con la que trabajes para poder registrar suministros y sus comisiones."
          accion="Nueva comercializadora"
          onAccion={abrirNueva}
        />
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por nombre, CIF, ciudad…" />
            <button onClick={abrirNueva} className="btn-primary whitespace-nowrap">Nueva comercializadora</button>
          </div>

          <div className="panel overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Comercializadora</th>
                  <th>Contacto</th>
                  <th>Comisión luz</th>
                  <th>Comisión gas</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-500 py-6">
                      Ninguna comercializadora coincide con la búsqueda.
                    </td>
                  </tr>
                )}
                {filtrada.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <p className="font-medium text-slate-200">{c.nombre}</p>
                      <p className="num text-xs text-slate-500">{c.nif ?? ""} {c.ciudad ? `· ${c.ciudad}` : ""}</p>
                    </td>
                    <td className="text-slate-300">
                      {c.contacto || c.telefono || c.email ? (
                        <>
                          {c.contacto && <p>{c.contacto}</p>}
                          <p className="num text-xs text-slate-500">{c.telefono ?? ""} {c.email ?? ""}</p>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num text-slate-300">
                      <p>Alta: {eurosSi(c.condiciones?.luz?.alta)}</p>
                      <p className="text-xs text-slate-500">
                        {eurosSi(c.condiciones?.luz?.mensual)}/mes · {eurosSi(c.condiciones?.luz?.anual)}/año
                      </p>
                    </td>
                    <td className="num text-slate-300">
                      <p>Alta: {eurosSi(c.condiciones?.gas?.alta)}</p>
                      <p className="text-xs text-slate-500">
                        {eurosSi(c.condiciones?.gas?.mensual)}/mes · {eurosSi(c.condiciones?.gas?.anual)}/año
                      </p>
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
            className="panel max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <h2 className="text-lg font-bold text-white">
              {editando ? `Editar ${editando.nombre}` : "Nueva comercializadora"}
            </h2>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm text-slate-400">
                Nombre *
                <input value={form.nombre} onChange={poner("nombre")} className="input" autoFocus required />
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
              <label className="text-sm text-slate-400">
                Ciudad
                <input value={form.ciudad} onChange={poner("ciudad")} className="input" />
              </label>
            </div>

            <div className="rounded-xl border border-slate-600/40 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-300">Condiciones de comisión (€)</p>

              <div>
                <p className="text-xs uppercase tracking-wider text-amber-300/80 mb-2">Luz</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className="text-sm text-slate-400">
                    Pago único por alta
                    <input value={form.altaLuz} onChange={poner("altaLuz")} className="input num" inputMode="decimal" placeholder="0,00" />
                  </label>
                  <label className="text-sm text-slate-400">
                    €/mes por contrato activo
                    <input value={form.mensualLuz} onChange={poner("mensualLuz")} className="input num" inputMode="decimal" placeholder="0,00" />
                  </label>
                  <label className="text-sm text-slate-400">
                    €/año recurrente
                    <input value={form.anualLuz} onChange={poner("anualLuz")} className="input num" inputMode="decimal" placeholder="0,00" />
                  </label>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-sky-300/80 mb-2">Gas</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className="text-sm text-slate-400">
                    Pago único por alta
                    <input value={form.altaGas} onChange={poner("altaGas")} className="input num" inputMode="decimal" placeholder="0,00" />
                  </label>
                  <label className="text-sm text-slate-400">
                    €/mes por contrato activo
                    <input value={form.mensualGas} onChange={poner("mensualGas")} className="input num" inputMode="decimal" placeholder="0,00" />
                  </label>
                  <label className="text-sm text-slate-400">
                    €/año recurrente
                    <input value={form.anualGas} onChange={poner("anualGas")} className="input num" inputMode="decimal" placeholder="0,00" />
                  </label>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Lo que dejes en blanco o a cero no genera comisión. Cada comercializadora puede tener condiciones distintas para luz y gas.
              </p>
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
