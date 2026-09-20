import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Avatar, EstadoVacio } from "../components/ui.jsx";
import { IconEditar, IconBorrar, IconImprimir } from "../components/icons.jsx";
import { imprimirFicha } from "../utils/imprimir.js";
import EnviarWhatsApp from "../components/EnviarWhatsApp.jsx";

const VACIO = {
  codigo: "", fechaAlta: "", nombre: "", nif: "", telefono: "", email: "",
  calle: "", ciudad: "", cp: "", provincia: "",
  iban: "", banco: "", bic: "",
  entregaCalle: "", entregaCiudad: "", entregaCp: "",
  esAdministracionPublica: false, whatsappAutorizado: false, notas: "",
};

const aFecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");
const aInputFecha = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

function FormCliente({ inicial, onGuardado, onCerrar, modulos = [] }) {
  const editando = Boolean(inicial?._id);
  const [form, setForm] = useState(() => {
    if (!editando) return VACIO;
    return {
      codigo: inicial.codigo ?? "",
      fechaAlta: aInputFecha(inicial.fechaAlta),
      nombre: inicial.nombre ?? "",
      nif: inicial.nif ?? "",
      telefono: inicial.telefono ?? "",
      email: inicial.email ?? "",
      calle: inicial.direccion?.calle ?? "",
      ciudad: inicial.direccion?.ciudad ?? "",
      cp: inicial.direccion?.cp ?? "",
      provincia: inicial.direccion?.provincia ?? "",
      iban: inicial.iban ?? "",
      banco: inicial.banco ?? "",
      bic: inicial.bic ?? "",
      entregaCalle: inicial.direccionEntrega?.calle ?? "",
      entregaCiudad: inicial.direccionEntrega?.ciudad ?? "",
      entregaCp: inicial.direccionEntrega?.cp ?? "",
      esAdministracionPublica: inicial.esAdministracionPublica ?? false,
      whatsappAutorizado: inicial.comunicaciones?.whatsapp?.autorizado ?? false,
      notas: inicial.notas ?? "",
    };
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("ficha");
  const [vehiculos, setVehiculos] = useState([]);
  const [cargandoVehiculos, setCargandoVehiculos] = useState(false);
  const [vehiculoActivo, setVehiculoActivo] = useState(null);
  const [historial, setHistorial] = useState({ ordenes: [], citas: [], valoraciones: [] });
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const tallerActivo = modulos.includes("taller");

  useEffect(() => {
    if (!tallerActivo || !editando || tab !== "vehiculos") return;
    let vivo = true;
    setCargandoVehiculos(true);
    fetch(`/api/taller/vehiculos?cliente=${inicial._id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((datos) => {
        if (!vivo) return;
        setVehiculos(Array.isArray(datos) ? datos : []);
      })
      .catch(() => setVehiculos([]))
      .finally(() => setCargandoVehiculos(false));
    return () => { vivo = false; };
  }, [tallerActivo, editando, tab, inicial._id]);

  async function verHistorial(v) {
    setVehiculoActivo(v);
    setCargandoHistorial(true);
    try {
      const mat = encodeURIComponent(v.matricula);
      const [ordenes, citas, valoraciones] = await Promise.all([
        fetch(`/api/taller/ordenes?matricula=${mat}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`/api/taller/citas?matricula=${mat}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`/api/taller/valoraciones?matricula=${mat}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);
      setHistorial({
        ordenes: Array.isArray(ordenes) ? ordenes : [],
        citas: Array.isArray(citas) ? citas : [],
        valoraciones: Array.isArray(valoraciones) ? valoraciones : [],
      });
    } catch {
      setHistorial({ ordenes: [], citas: [], valoraciones: [] });
    } finally {
      setCargandoHistorial(false);
    }
  }

  const poner = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    if (!form.nif.trim()) return setError("El NIF/CIF es obligatorio");
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = {
        nombre: form.nombre,
        nif: form.nif,
        telefono: form.telefono,
        email: form.email,
        codigo: form.codigo.trim() || undefined, // si va vacío, el servidor asigna el siguiente
        fechaAlta: form.fechaAlta || undefined,
        iban: form.iban,
        banco: form.banco,
        bic: form.bic,
        direccion: { calle: form.calle, ciudad: form.ciudad, cp: form.cp, provincia: form.provincia },
        direccionEntrega: { calle: form.entregaCalle, ciudad: form.entregaCiudad, cp: form.entregaCp },
        esAdministracionPublica: form.esAdministracionPublica,
        comunicaciones: {
          whatsapp: {
            autorizado: form.whatsappAutorizado,
            origen: "ficha_cliente",
          },
        },
        notas: form.notas,
      };
      const r = await fetch(editando ? `/api/clientes/${inicial._id}` : "/api/clientes", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
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
      <div className="modal-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">{editando ? `Editar ${inicial.nombre}` : "Nuevo cliente"}</h2>

        {editando && tallerActivo && (
          <div className="flex gap-1 mb-4 border-b border-slate-700 pb-1">
            <button
              type="button"
              onClick={() => setTab("ficha")}
              className={`px-3 py-1.5 text-sm font-medium rounded-t-lg ${
                tab === "ficha" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Ficha
            </button>
            <button
              type="button"
              onClick={() => setTab("vehiculos")}
              className={`px-3 py-1.5 text-sm font-medium rounded-t-lg ${
                tab === "vehiculos" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Vehículos
            </button>
          </div>
        )}

        <form onSubmit={guardar} className="space-y-5">
          {tab === "ficha" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Código</label>
                  <input
                    value={form.codigo}
                    onChange={poner("codigo")}
                    className="input"
                    placeholder={editando ? "" : "Se asigna solo"}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Fecha de alta</label>
                  <input type="date" value={form.fechaAlta} onChange={poner("fechaAlta")} className="input" />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Nombre / Razón social *</label>
                <input value={form.nombre} onChange={poner("nombre")} className="input" autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">NIF / CIF *</label>
                  <input value={form.nif} onChange={poner("nif")} className="input" />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Teléfono</label>
                  <input value={form.telefono} onChange={poner("telefono")} className="input" />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Email</label>
                <input type="email" value={form.email} onChange={poner("email")} className="input" />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Dirección</label>
                <input value={form.calle} onChange={poner("calle")} className="input" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Ciudad</label>
                  <input value={form.ciudad} onChange={poner("ciudad")} className="input" />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Código postal</label>
                  <input value={form.cp} onChange={poner("cp")} className="input" />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Provincia</label>
                  <input value={form.provincia} onChange={poner("provincia")} className="input" />
                </div>
              </div>

              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-500 pt-2">Datos bancarios</p>
              <div>
                <label className="text-sm text-slate-400 block mb-1">IBAN</label>
                <input value={form.iban} onChange={poner("iban")} placeholder="ES00 0000 0000 0000 0000 0000" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Banco</label>
                  <input value={form.banco} onChange={poner("banco")} className="input" />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">BIC / SWIFT</label>
                  <input value={form.bic} onChange={poner("bic")} className="input" />
                </div>
              </div>

              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-500 pt-2">Dirección de entrega</p>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Dirección de entrega</label>
                <input value={form.entregaCalle} onChange={poner("entregaCalle")} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Ciudad entrega</label>
                  <input value={form.entregaCiudad} onChange={poner("entregaCiudad")} className="input" />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">CP entrega</label>
                  <input value={form.entregaCp} onChange={poner("entregaCp")} className="input" />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.esAdministracionPublica}
                  onChange={(e) => setForm((f) => ({ ...f, esAdministracionPublica: e.target.checked }))}
                  className="accent-cyan-400 w-4 h-4"
                />
                Es Administración Pública (factura electrónica FACe)
              </label>

              <label className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.whatsappAutorizado}
                  onChange={(e) => setForm((f) => ({ ...f, whatsappAutorizado: e.target.checked }))}
                  className="accent-emerald-500 w-4 h-4 mt-0.5"
                />
                <span>
                  Autoriza comunicaciones por WhatsApp
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Guarda el consentimiento para confirmaciones, recordatorios y documentos.
                  </span>
                </span>
              </label>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Notas</label>
                <textarea value={form.notas} onChange={poner("notas")} rows={2} className="input" />
              </div>
            </>
          )}

          {tab === "vehiculos" && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300">Vehículos asignados</h3>
              {cargandoVehiculos ? (
                <p className="text-sm text-slate-500">Cargando…</p>
              ) : vehiculos.length === 0 ? (
                <p className="text-sm text-slate-500">Este cliente no tiene vehículos asignados.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {vehiculos.map((v) => (
                    <button
                      key={v._id}
                      type="button"
                      onClick={() => verHistorial(v)}
                      className={`text-left rounded-xl border px-3 py-2 transition ${
                        vehiculoActivo?._id === v._id
                          ? "border-accent bg-accent/10"
                          : "border-slate-700 hover:border-slate-500"
                      }`}
                    >
                      <p className="font-bold text-white num">{v.matricula}</p>
                      <p className="text-xs text-slate-400">{[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}</p>
                    </button>
                  ))}
                </div>
              )}

              {vehiculoActivo && (
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">
                      Historial de {vehiculoActivo.matricula}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setVehiculoActivo(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cerrar
                    </button>
                  </div>

                  {cargandoHistorial ? (
                    <p className="text-sm text-slate-500">Cargando historial…</p>
                  ) : (
                    <>
                      {historial.ordenes.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Órdenes de trabajo</p>
                          <ul className="space-y-1">
                            {historial.ordenes.map((o) => (
                              <li key={o._id} className="text-sm text-slate-300">
                                <span className="num text-slate-400">{o.numeroOrden || o._id.slice(-6)}</span> — {o.motivo || "Sin motivo"} — {o.estado}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {historial.citas.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Citas</p>
                          <ul className="space-y-1">
                            {historial.citas.map((c) => (
                              <li key={c._id} className="text-sm text-slate-300">
                                <span className="num text-slate-400">{aFecha(c.fecha)} {c.hora}</span> — {c.motivo || c.estado}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {historial.valoraciones.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Valoraciones</p>
                          <ul className="space-y-1">
                            {historial.valoraciones.map((val) => (
                              <li key={val._id} className="text-sm text-slate-300">
                                <span className="num text-slate-400">{val.numero}</span> — {val.compania || val.aseguradora?.nombre || "Sin compañía"} — {val.estado || "Pendiente"}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {historial.ordenes.length === 0 && historial.citas.length === 0 && historial.valoraciones.length === 0 && (
                        <p className="text-sm text-slate-500">No hay historial para este vehículo.</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={guardando || tab !== "ficha"} className="btn-primary">
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ClientesPage() {
  const [lista, setLista] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [form, setForm] = useState(null); // null | VACIO | cliente
  const [importando, setImportando] = useState(false);
  const [modulos, setModulos] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    fetch("/api/empresa")
      .then((r) => (r.ok ? r.json() : null))
      .then((e) => setModulos(e?.modulos ?? []))
      .catch(() => setModulos([]));
  }, []);

  async function cargar(busqueda = q) {
    try {
      const r = await fetch(`/api/clientes?q=${encodeURIComponent(busqueda)}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buscar(e) {
    e.preventDefault();
    cargar(q);
  }

  async function importarExcel(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setImportando(true);
    setError(null);
    setAviso(null);
    try {
      const fd = new FormData();
      fd.append("excel", f);
      const r = await fetch("/api/clientes/importar-excel", { method: "POST", body: fd });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo importar");
      let msg = `Importados ${datos.creados} de ${datos.total} clientes`;
      if (datos.duplicados > 0) msg += ` (${datos.duplicados} ya existían por NIF)`;
      if (datos.errores?.length > 0) msg += `. Errores: ${datos.errores[0]}`;
      setAviso(msg);
      await cargar("");
    } catch (err) {
      setError(err.message);
    } finally {
      setImportando(false);
    }
  }

  async function borrar(c) {
    if (!window.confirm(`¿Borrar el cliente "${c.nombre}"?`)) return;
    const r = await fetch(`/api/clientes/${c._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  return (
    <>
      <CabeceraPagina
        titulo="Clientes"
        contador={lista ? `${lista.length} registros` : null}
        descripcion="Gestiona tu cartera de clientes."
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={importarExcel}
        />
        <button onClick={() => window.print()} className="btn-ghost mr-2">Imprimir</button>
        <button onClick={() => inputRef.current?.click()} disabled={importando} className="btn-ghost mr-2">
          {importando ? "Importando…" : "Importar Excel"}
        </button>
        <button onClick={() => setForm(VACIO)} className="btn-primary">Nuevo cliente</button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}
      {aviso && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{aviso}</div>
      )}

      <form onSubmit={buscar} className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onInput={(e) => { if (!e.target.value) cargar(""); }}
          placeholder="Buscar por nombre, NIF o código…"
          className="input w-full md:w-96"
        />
      </form>

      <div className="panel px-3.5 py-2">
        {!lista ? null : lista.length === 0 ? (
          <EstadoVacio
            titulo="Sin clientes"
            descripcion="Crea el primero a mano o importa tu cartera desde un Excel."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Código</th>
                  <th>Nombre</th>
                  <th className="whitespace-nowrap">NIF/CIF</th>
                  <th className="whitespace-nowrap">Teléfono</th>
                  <th>Dirección</th>
                  <th className="whitespace-nowrap">Alta</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c._id}>
                    <td className="num text-[0.75rem] font-semibold text-slate-500 whitespace-nowrap">{c.codigo ?? "—"}</td>
                    <td className="max-w-[300px]">
                      <div className="flex items-center gap-3">
                        <Avatar nombre={c.nombre} />
                        <div className="min-w-0">
                          <p className="font-medium text-[#0f172a] truncate">
                            {c.nombre}
                            {c.esAdministracionPublica && (
                              <span className="ml-2 text-[0.625rem] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 align-middle">
                                FACe
                              </span>
                            )}
                          </p>
                          <p className="text-[0.6875rem] text-slate-400 truncate">{c.email || "Sin email"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="num text-[0.75rem] text-slate-500 whitespace-nowrap">{c.nif}</td>
                    <td className="num text-[0.75rem] text-slate-500 whitespace-nowrap">
                      {c.telefono ? (
                        <a href={`tel:${c.telefono}`} title="Llamar" className="hover:text-accent transition-colors">
                          {c.telefono}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="text-slate-500 max-w-[260px]">
                      {c.direccion?.calle || c.direccion?.ciudad ? (
                        <>
                          <span className="block truncate">{c.direccion?.calle || "—"}</span>
                          <span className="block text-[0.6875rem] text-slate-400 truncate">
                            {[c.direccion?.cp, c.direccion?.ciudad, c.direccion?.provincia].filter(Boolean).join(" · ")}
                          </span>
                        </>
                      ) : "—"}
                    </td>
                    <td className="text-[0.75rem] text-slate-500 whitespace-nowrap">{aFecha(c.fechaAlta)}</td>
                    <td className="text-right whitespace-nowrap">
                      <EnviarWhatsApp
                        telefono={c.telefono}
                        cliente={c._id}
                        clienteNombre={c.nombre}
                        tipo="cliente"
                        id={c._id}
                      />
                      <button
                        onClick={() =>
                          imprimirFicha({
                            titulo: "Cliente",
                            subtitulo: c.nombre,
                            campos: [
                              ["Código", c.codigo],
                              ["Fecha de alta", c.fechaAlta ? aFecha(c.fechaAlta) : undefined],
                              ["Nombre", c.nombre],
                              ["NIF/CIF", c.nif],
                              ["Teléfono", c.telefono],
                              ["Email", c.email],
                              ["Dirección", [c.direccion?.calle, c.direccion?.cp, c.direccion?.ciudad, c.direccion?.provincia].filter(Boolean).join(", ")],
                              ["Dirección de entrega", [c.direccionEntrega?.calle, c.direccionEntrega?.cp, c.direccionEntrega?.ciudad].filter(Boolean).join(", ")],
                              ["IBAN", c.iban],
                              ["Banco", c.banco],
                              ["BIC", c.bic],
                              ["Administración pública (FACe)", c.esAdministracionPublica ? "Sí" : undefined],
                              ["Notas", c.notas],
                            ],
                          })
                        }
                        title="Imprimir ficha"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors mr-1"
                      >
                        <IconImprimir />
                      </button>
                      <button
                        onClick={() => setForm(c)}
                        title="Editar"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors mr-1"
                      >
                        <IconEditar />
                      </button>
                      <button
                        onClick={() => borrar(c)}
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
        <FormCliente
          inicial={form._id ? form : null}
          onGuardado={() => { setForm(null); cargar(); }}
          onCerrar={() => setForm(null)}
          modulos={modulos}
        />
      )}
    </>
  );
}
