import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio } from "../../components/ui.jsx";
import { IconImprimir } from "../../components/icons.jsx";
import { imprimirFicha } from "../../utils/imprimir.js";

const campo = "input w-full";
const VACIO = { matricula: "", marca: "", modelo: "", km: "", tipo: "cliente", clienteNombre: "", notas: "" };

export default function TallerVehiculosPage() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);

  async function cargar() {
    try {
      const r = await fetch("/api/taller/vehiculos");
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

  function abrirEdicion(v) {
    setEditando(v);
    setForm({
      matricula: v.matricula,
      marca: v.marca ?? "",
      modelo: v.modelo ?? "",
      km: v.km ?? "",
      tipo: v.tipo,
      clienteNombre: v.clienteNombre ?? "",
      notas: v.notas ?? "",
    });
    setModal(true);
  }

  async function guardar(e) {
    e.preventDefault();
    const cuerpo = {
      matricula: form.matricula,
      marca: form.marca || undefined,
      modelo: form.modelo || undefined,
      km: form.km ? Number(form.km) : undefined,
      tipo: form.tipo,
      clienteNombre: form.clienteNombre || undefined,
      notas: form.notas || undefined,
    };
    const r = await fetch(`/api/taller/vehiculos${editando ? `/${editando._id}` : ""}`, {
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

  async function borrar(v) {
    if (!window.confirm(`¿Borrar el vehículo ${v.matricula}?`)) return;
    const r = await fetch(`/api/taller/vehiculos/${v._id}`, { method: "DELETE" });
    const datos = await r.json();
    if (r.ok) cargar();
    else alert(datos.error || "No se pudo borrar");
  }

  return (
    <>
      <CabeceraPagina titulo="Vehículos" descripcion="Vehículos vinculados a clientes y flota de cortesía.">
        <button onClick={abrirNuevo} className="btn-primary">
          Nuevo vehículo
        </button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      <div className="panel px-3.5 py-2">
        {!lista ? null : lista.length === 0 ? (
          <EstadoVacio
            titulo="Sin vehículos"
            descripcion="Registra el primer vehículo o usa la Recepción rápida desde el panel del taller."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Vehículo</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th className="text-right">KM</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => (
                  <tr key={v._id}>
                    <td className="font-bold text-white whitespace-nowrap num">{v.matricula}</td>
                    <td className="text-slate-300">
                      {[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="text-slate-300">{v.clienteNombre ?? "—"}</td>
                    <td>
                      <Badge tono={v.tipo === "cortesia" ? "amber" : "slate"}>
                        {v.tipo === "cortesia" ? "Cortesía" : "Cliente"}
                      </Badge>
                    </td>
                    <td className="text-right text-slate-300 num">
                      {v.km != null ? `${v.km.toLocaleString("es-ES")} km` : "—"}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          imprimirFicha({
                            titulo: "Vehículo",
                            subtitulo: v.matricula,
                            campos: [
                              ["Matrícula", v.matricula],
                              ["Vehículo", [v.marca, v.modelo].filter(Boolean).join(" ")],
                              ["Cliente", v.clienteNombre],
                              ["Tipo", v.tipo === "cortesia" ? "Cortesía" : "Cliente"],
                              ["Bastidor", v.bastidor],
                              ["Color", v.color],
                              ["Combustible", v.combustible],
                              ["Año", v.anio],
                              ["Kilómetros", v.km != null ? `${v.km.toLocaleString("es-ES")} km` : undefined],
                            ],
                          })
                        }
                        title="Imprimir ficha"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors align-middle mr-2"
                      >
                        <IconImprimir />
                      </button>
                      <button
                        onClick={() => abrirEdicion(v)}
                        className="text-xs text-accent hover:underline mr-3"
                      >
                        Editar
                      </button>
                      <button onClick={() => borrar(v)} className="text-xs text-rose-400 hover:underline">
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
          <div className="modal-panel w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">
              {editando ? `Vehículo ${editando.matricula}` : "Nuevo vehículo"}
            </h2>
            <form onSubmit={guardar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Matrícula *</label>
                  <input
                    className={`${campo} uppercase`}
                    value={form.matricula}
                    onChange={(e) => setForm({ ...form, matricula: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Tipo</label>
                  <select
                    className={campo}
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  >
                    <option value="cliente">Cliente</option>
                    <option value="cortesia">Cortesía</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Marca</label>
                  <input className={campo} value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Modelo</label>
                  <input className={campo} value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">KM</label>
                  <input
                    type="number"
                    min="0"
                    className={campo}
                    value={form.km}
                    onChange={(e) => setForm({ ...form, km: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Cliente</label>
                  <input
                    className={campo}
                    value={form.clienteNombre}
                    onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Notas</label>
                <input className={campo} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
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
