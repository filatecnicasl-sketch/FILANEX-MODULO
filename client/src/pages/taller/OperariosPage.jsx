import { useCallback, useEffect, useRef, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio, euros } from "../../components/ui.jsx";
import { urlApiConSesion } from "../../lib/sesion.js";

const campo = "input w-full";
const VACIO = {
  nombre: "",
  especialidad: "",
  costeHora: "",
  telefono: "",
  email: "",
  situacion: "alta",
  fechaAlta: "",
  fechaBaja: "",
  notas: "",
};

const SITUACIONES = [
  { clave: "alta", nombre: "Alta" },
  { clave: "prueba", nombre: "Periodo de prueba" },
  { clave: "baja", nombre: "Baja" },
];
const NOMBRE_SITUACION = Object.fromEntries(SITUACIONES.map((s) => [s.clave, s.nombre]));
const TONO_SITUACION = { alta: "green", prueba: "amber", baja: "slate" };

// Date de Mongo → "2026-10-29" para los input type="date".
const aFechaInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

// "2026-08" → { desde: "2026-08-01", hasta: "2026-08-31" }
function rangoMes(mes) {
  const [anio, m] = mes.split("-").map(Number);
  const ultimo = new Date(anio, m, 0).getDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

const horas = (n) =>
  `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(Number(n) || 0)} h`;

// Operarios del taller: fichas con contacto, situación laboral y curriculum,
// más el informe de productividad (horas invertidas registradas en las OT vs
// horas de mano de obra facturadas en el periodo).
export default function OperariosPage() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { operario? }
  const [form, setForm] = useState(VACIO);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [informe, setInforme] = useState(null);
  const [subiendoCurriculum, setSubiendoCurriculum] = useState(false);
  const inputCurriculum = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/taller/operarios");
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setLista(datos);
    } catch (e) {
      setError(e.message);
      setLista([]);
    }
  }, []);

  const cargarInforme = useCallback(async () => {
    try {
      const { desde, hasta } = rangoMes(mes);
      const r = await fetch(`/api/taller/operarios/informe?desde=${desde}&hasta=${hasta}`);
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar el informe");
      setInforme(datos);
    } catch {
      setInforme(null);
    }
  }, [mes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    cargarInforme();
  }, [cargarInforme]);

  function abrirNuevo() {
    setForm(VACIO);
    setModal({});
  }

  function abrirEdicion(op) {
    setForm({
      nombre: op.nombre,
      especialidad: op.especialidad ?? "",
      costeHora: op.costeHora ?? "",
      telefono: op.telefono ?? "",
      email: op.email ?? "",
      situacion: op.situacion ?? "alta",
      fechaAlta: aFechaInput(op.fechaAlta),
      fechaBaja: aFechaInput(op.fechaBaja),
      notas: op.notas ?? "",
    });
    setModal({ operario: op });
  }

  async function guardar(e) {
    e.preventDefault();
    const r = await fetch(`/api/taller/operarios${modal.operario ? `/${modal.operario._id}` : ""}`, {
      method: modal.operario ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        costeHora: Number(form.costeHora) || 0,
        fechaAlta: form.fechaAlta || null,
        fechaBaja: form.fechaBaja || null,
      }),
    });
    const datos = await r.json();
    if (r.ok) {
      setModal(null);
      cargar();
      cargarInforme();
    } else alert(datos.error || "Error al guardar");
  }

  async function alternarActivo(op) {
    await fetch(`/api/taller/operarios/${op._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !op.activo }),
    });
    cargar();
  }

  async function borrar(op) {
    if (!window.confirm(`¿Borrar a ${op.nombre}?`)) return;
    const r = await fetch(`/api/taller/operarios/${op._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  // Curriculum: subir (PDF o imagen, sustituye al anterior) o quitar.
  async function subirCurriculum(e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo || !modal.operario) return;
    setSubiendoCurriculum(true);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      const r = await fetch(`/api/taller/operarios/${modal.operario._id}/curriculum`, {
        method: "POST",
        body: fd,
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo subir el curriculum");
      setModal({ ...modal, operario: { ...modal.operario, curriculum: datos } });
      cargar();
    } catch (e2) {
      alert(e2.message);
    } finally {
      setSubiendoCurriculum(false);
    }
  }

  async function quitarCurriculum() {
    if (!modal.operario?.curriculum) return;
    if (!window.confirm("¿Quitar el curriculum de este operario?")) return;
    const r = await fetch(`/api/taller/operarios/${modal.operario._id}/curriculum`, { method: "DELETE" });
    if (r.ok) {
      setModal({ ...modal, operario: { ...modal.operario, curriculum: null } });
      cargar();
    } else alert((await r.json()).error || "No se pudo quitar");
  }

  const aprovechamiento =
    informe && informe.invertidas > 0 ? Math.round((informe.facturadas.horas / informe.invertidas) * 100) : null;

  return (
    <>
      <CabeceraPagina
        titulo="Operarios"
        descripcion="Fichas de mecánicos y chapa/pintura, con el informe de horas invertidas vs facturadas."
      >
        <button onClick={abrirNuevo} className="btn-primary">
          Nuevo operario
        </button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* Fichas de operarios */}
        <div className="panel px-3.5 py-2">
          {!lista ? null : lista.length === 0 ? (
            <EstadoVacio
              titulo="Sin operarios"
              descripcion="Da de alta al personal del taller para registrar sus horas en las órdenes."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Especialidad</th>
                    <th>Contacto</th>
                    <th className="text-right">Coste/h</th>
                    <th>Situación</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((op) => (
                    <tr key={op._id} className={op.activo ? "" : "opacity-55"}>
                      <td className="font-semibold text-white">
                        {op.nombre}
                        {op.curriculum?.url && (
                          <a
                            href={urlApiConSesion(op.curriculum.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-1.5 text-[0.625rem] font-bold text-accent hover:underline align-middle"
                            title={`Ver curriculum (${op.curriculum.nombre ?? "archivo"})`}
                          >
                            CV
                          </a>
                        )}
                      </td>
                      <td className="text-slate-300">{op.especialidad ?? "—"}</td>
                      <td className="text-slate-300">
                        {op.telefono || op.email ? (
                          <>
                            {op.telefono && <span className="num block text-xs">{op.telefono}</span>}
                            {op.email && <span className="block text-xs text-slate-400">{op.email}</span>}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-right text-slate-300 num">{euros(op.costeHora)}</td>
                      <td>
                        <Badge tono={TONO_SITUACION[op.situacion ?? "alta"] ?? "slate"}>
                          {NOMBRE_SITUACION[op.situacion ?? "alta"]}
                        </Badge>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button
                          onClick={() => alternarActivo(op)}
                          className="text-xs text-slate-400 hover:text-white hover:underline mr-3"
                          title={op.activo ? "Desactivar (no sale en las órdenes)" : "Volver a activar"}
                        >
                          {op.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button onClick={() => abrirEdicion(op)} className="text-xs text-accent hover:underline mr-3">
                          Editar
                        </button>
                        <button onClick={() => borrar(op)} className="text-xs text-rose-400 hover:underline">
                          Borrar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[0.6875rem] text-slate-400 px-2 py-2">
            Las horas se registran dentro de cada orden de trabajo (sección «Tiempos de taller»).
          </p>
        </div>

        {/* Informe del mes */}
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h3 className="text-sm font-bold text-slate-700">Horas facturadas vs invertidas</h3>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="input !w-auto !py-1.5 text-sm"
            />
          </div>

          {!informe ? (
            <p className="text-sm text-slate-400 py-4 text-center">Cargando…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[0.65625rem] font-bold uppercase tracking-wider text-slate-500">Invertidas</p>
                  <p className="num text-lg font-bold text-slate-800">{horas(informe.invertidas)}</p>
                  <p className="text-[0.6875rem] text-slate-400 num">{euros(informe.costeInvertidas)} coste</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[0.65625rem] font-bold uppercase tracking-wider text-slate-500">Facturadas</p>
                  <p className="num text-lg font-bold text-slate-800">{horas(informe.facturadas.horas)}</p>
                  <p className="text-[0.6875rem] text-slate-400 num">{euros(informe.facturadas.importe)} facturado</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[0.65625rem] font-bold uppercase tracking-wider text-slate-500">Diferencia</p>
                  <p
                    className={`num text-lg font-bold ${
                      informe.facturadas.horas - informe.invertidas >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {horas(informe.facturadas.horas - informe.invertidas)}
                  </p>
                  <p className="text-[0.6875rem] text-slate-400">facturadas − invertidas</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[0.65625rem] font-bold uppercase tracking-wider text-slate-500">Aprovechamiento</p>
                  <p className="num text-lg font-bold text-slate-800">
                    {aprovechamiento == null ? "—" : `${aprovechamiento}%`}
                  </p>
                  <p className="text-[0.6875rem] text-slate-400">de las horas invertidas se facturan</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Operario</th>
                      <th className="text-right">Horas invertidas</th>
                      <th className="text-right">Coste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {informe.porOperario.map((x) => (
                      <tr key={String(x.operario)}>
                        <td className="text-slate-700">
                          {x.nombre}
                          {x.especialidad && <span className="text-slate-400 text-xs"> · {x.especialidad}</span>}
                        </td>
                        <td className="text-right num text-slate-700">{horas(x.horas)}</td>
                        <td className="text-right num text-slate-500">{euros(x.coste)}</td>
                      </tr>
                    ))}
                    {informe.porOperario.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center text-slate-400 py-4">
                          Sin operarios dados de alta
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[0.6875rem] text-slate-400 mt-2">
                «Facturadas» suma las líneas de mano de obra de las facturas emitidas en el mes.
              </p>
            </>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(null)}>
          <div
            className="modal-panel w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white mb-4">
              {modal.operario ? `Operario ${modal.operario.nombre}` : "Nuevo operario"}
            </h2>
            <form onSubmit={guardar} className="space-y-3">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Nombre *</label>
                <input
                  autoFocus
                  className={campo}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Especialidad</label>
                  <input
                    className={campo}
                    placeholder="Chapa, Pintura, Mecánica…"
                    value={form.especialidad}
                    onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Coste €/hora</label>
                  <input
                    type="number" min="0" step="0.5"
                    className={`${campo} text-right`}
                    value={form.costeHora}
                    onChange={(e) => setForm({ ...form, costeHora: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Teléfono</label>
                  <input
                    className={campo}
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    placeholder="600 000 000"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Email</label>
                  <input
                    className={campo}
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="operario@ejemplo.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Situación</label>
                  <select
                    className={campo}
                    value={form.situacion}
                    onChange={(e) => setForm({ ...form, situacion: e.target.value })}
                  >
                    {SITUACIONES.map((s) => (
                      <option key={s.clave} value={s.clave}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Fecha de alta</label>
                  <input
                    type="date"
                    className={campo}
                    value={form.fechaAlta}
                    onChange={(e) => setForm({ ...form, fechaAlta: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Fecha de baja</label>
                  <input
                    type="date"
                    className={campo}
                    value={form.fechaBaja}
                    onChange={(e) => setForm({ ...form, fechaBaja: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Notas importantes</label>
                <textarea
                  className={`${campo} min-h-[70px]`}
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  placeholder="Categoría profesional, convenio, avisos…"
                />
              </div>

              {/* Curriculum: solo al editar (necesita la ficha ya guardada) */}
              {modal.operario && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-300">Curriculum</p>
                  {modal.operario.curriculum?.url ? (
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={urlApiConSesion(modal.operario.curriculum.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-accent hover:underline truncate"
                        title={modal.operario.curriculum.nombre ?? "Ver curriculum"}
                      >
                        {modal.operario.curriculum.nombre ?? "Ver curriculum"}
                      </a>
                      <button
                        type="button"
                        onClick={quitarCurriculum}
                        className="text-xs text-rose-400 hover:underline shrink-0"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Sin curriculum adjunto.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => inputCurriculum.current?.click()}
                    disabled={subiendoCurriculum}
                    className="btn-ghost text-xs px-3 py-1.5"
                  >
                    {subiendoCurriculum
                      ? "Subiendo…"
                      : modal.operario.curriculum?.url
                        ? "Reemplazar"
                        : "Subir curriculum (PDF o foto)"}
                  </button>
                  <input
                    ref={inputCurriculum}
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={subirCurriculum}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="btn-ghost">
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
