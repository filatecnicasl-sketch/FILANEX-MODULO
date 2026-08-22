import { useEffect, useState } from "react";
import { TIPOS_APARATO, nombreTipoAparato } from "./datos.js";
import SelectorContacto from "../../components/SelectorContacto.jsx";
import { coincideBusqueda, euros } from "../../components/ui.jsx";

const campo = "input w-full";
const normalizar = (s) => (s ?? "").toString().trim().toLowerCase();

// "2026-08-06" (fecha local, sin líos de zona horaria)
const aFechaInput = (d) => {
  const f = d instanceof Date ? d : new Date(d);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};

const DIRECCION_VACIA = { calle: "", cp: "", ciudad: "", provincia: "" };

/**
 * Recepción exprés del SAT: alta del aparato (si no existe) y apertura de la
 * orden de servicio en un solo paso. Si el aparato viene con cita, se busca
 * arriba y la recepción se rellena sola; al crearla, la cita queda realizada.
 */
export default function RecepcionRapidaServicio({ onCerrar, onCreada }) {
  const [clientes, setClientes] = useState([]);
  const [citas, setCitas] = useState([]);
  const [aparatos, setAparatos] = useState([]);
  const [buscaCita, setBuscaCita] = useState("");
  const [citaElegida, setCitaElegida] = useState(null);
  const [buscaAparato, setBuscaAparato] = useState("");
  const [aparatoId, setAparatoId] = useState("");
  const [modoNuevo, setModoNuevo] = useState(false);
  const [tipoServicio, setTipoServicio] = useState("tienda"); // "tienda" | "domicilio"
  const [direccion, setDireccion] = useState(DIRECCION_VACIA);
  const [form, setForm] = useState({
    tipo: "",
    marca: "",
    modelo: "",
    numeroSerie: "",
    clienteId: "",
    nombreCliente: "",
    telefono: "",
    averia: "",
    accesorios: "",
    estadoFisico: "",
    garantia: "sin_garantia",
    garantiaHasta: "",
  });
  const [presupuestos, setPresupuestos] = useState([]); // abiertos del cliente elegido
  const [presupuestoId, setPresupuestoId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => r.json())
      .then(setClientes)
      .catch(() => setClientes([]));
    fetch("/api/servicio/citas")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCitas)
      .catch(() => setCitas([]));
    fetch("/api/servicio/aparatos")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAparatos)
      .catch(() => setAparatos([]));
  }, []);

  // Al cambiar el cliente se buscan sus presupuestos abiertos (borrador,
  // enviado o aceptado y sin orden vinculada) para incluir uno en la orden.
  useEffect(() => {
    setPresupuestoId("");
    if (!form.clienteId) {
      setPresupuestos([]);
      return;
    }
    let vivo = true;
    fetch(`/api/servicio/presupuestos-abiertos?cliente=${form.clienteId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => {
        if (vivo) setPresupuestos(Array.isArray(lista) ? lista : []);
      })
      .catch(() => vivo && setPresupuestos([]));
    return () => {
      vivo = false;
    };
  }, [form.clienteId]);

  const hoy = aFechaInput(new Date());

  // Citas pendientes de recepcionar: las de hoy como acceso directo y el
  // buscador para cualquier otra (cliente, aparato, dirección, motivo…).
  const pendientes = citas.filter((c) => !["realizada", "cancelada"].includes(c.estado));
  const citasHoy = pendientes.filter((c) => aFechaInput(c.fecha) === hoy);
  const citasFiltradas = buscaCita.trim()
    ? pendientes
        .filter((c) =>
          coincideBusqueda(
            buscaCita,
            c.clienteNombre,
            c.telefono,
            c.aparatoDescripcion,
            c.direccion,
            c.motivo,
            c.hora,
            new Date(c.fecha).toLocaleDateString("es-ES")
          )
        )
        .slice(0, 8)
    : [];

  // Aparatos de la cartera: se filtran por S/N, marca, modelo, código o cliente.
  const aparatoElegido = aparatos.find((a) => String(a._id) === String(aparatoId)) ?? null;
  const aparatosFiltrados = buscaAparato.trim()
    ? aparatos
        .filter((a) =>
          coincideBusqueda(
            buscaAparato,
            a.numeroSerie,
            a.marca,
            a.modelo,
            a.codigo,
            a.clienteNombre,
            nombreTipoAparato(a.tipo)
          )
        )
        .slice(0, 8)
    : [];

  function actualizar(campoNombre, valor) {
    setForm((f) => ({ ...f, [campoNombre]: valor }));
  }

  const direccionDeCliente = (c) => ({
    calle: c?.direccion?.calle ?? "",
    cp: c?.direccion?.cp ?? "",
    ciudad: c?.direccion?.ciudad ?? "",
    provincia: c?.direccion?.provincia ?? "",
  });

  // Datos que la recepción hereda del aparato (editables antes de guardar).
  const precargasDeAparato = (a) => ({
    accesorios: a.accesorios ?? "",
    estadoFisico: a.estadoFisico ?? "",
    garantiaHasta: a.garantiaHasta ? aFechaInput(a.garantiaHasta) : "",
    garantia: a.garantiaHasta && aFechaInput(a.garantiaHasta) >= hoy ? "en_garantia" : "sin_garantia",
  });

  const clienteDeAparato = (a) =>
    clientes.find((x) => String(x._id) === String(a?.cliente)) ??
    clientes.find((x) => a?.clienteNombre && normalizar(x.nombre) === normalizar(a.clienteNombre));

  // Elegir un aparato existente precarga la recepción y su cliente. Si el
  // aparato no tiene cliente, se limpia el anterior para no ofrecer
  // presupuestos ni dirección de otro cliente.
  function elegirAparato(a) {
    setAparatoId(String(a._id));
    setModoNuevo(false);
    setBuscaAparato("");
    const cli = clienteDeAparato(a);
    setForm((f) => ({
      ...f,
      ...precargasDeAparato(a),
      clienteId: cli?._id ?? "",
      nombreCliente: cli?.nombre ?? a.clienteNombre ?? "",
      telefono: cli?.telefono ?? "",
    }));
    if (cli && tipoServicio === "domicilio") setDireccion(direccionDeCliente(cli));
  }

  function quitarAparato() {
    setAparatoId("");
  }

  // Elegir una cita rellena la recepción: aparato (si la cita lo trae
  // vinculado), cliente y avería (el motivo de la cita). Si la cita lleva
  // dirección, la visita es a domicilio y esa dirección se precarga.
  function elegirCita(c) {
    setCitaElegida(c);
    setBuscaCita("");
    const ap = c.aparato ? aparatos.find((a) => String(a._id) === String(c.aparato)) : null;
    const cli =
      clientes.find((x) => String(x._id) === String(c.cliente)) ??
      (ap ? clienteDeAparato(ap) : null) ??
      clientes.find((x) => normalizar(x.nombre) === normalizar(c.clienteNombre));
    if (ap) {
      setAparatoId(String(ap._id));
      setModoNuevo(false);
    }
    setForm((f) => ({
      ...f,
      ...(ap ? precargasDeAparato(ap) : {}),
      clienteId: cli?._id ?? "",
      nombreCliente: cli?.nombre ?? c.clienteNombre ?? ap?.clienteNombre ?? "",
      telefono: c.telefono || cli?.telefono || "",
      averia: c.motivo || f.averia,
    }));
    if (c.direccion) {
      setTipoServicio("domicilio");
      setDireccion({
        calle: c.direccion,
        cp: cli?.direccion?.cp ?? "",
        ciudad: cli?.direccion?.ciudad ?? "",
        provincia: cli?.direccion?.provincia ?? "",
      });
    } else if (cli && tipoServicio === "domicilio") {
      setDireccion(direccionDeCliente(cli));
    }
  }

  function quitarCita() {
    setCitaElegida(null);
  }

  // Al elegir cliente de la cartera se rellenan nombre y teléfono solos, y
  // en servicios a domicilio su dirección fiscal es la de la intervención.
  function elegirCliente(id) {
    const c = clientes.find((x) => String(x._id) === String(id));
    setForm((f) => ({
      ...f,
      clienteId: id || "",
      nombreCliente: c?.nombre ?? f.nombreCliente,
      telefono: c?.telefono ?? f.telefono,
    }));
    if (c && tipoServicio === "domicilio") setDireccion(direccionDeCliente(c));
  }

  function cambiarTipoServicio(v) {
    setTipoServicio(v);
    if (v === "domicilio" && form.clienteId) {
      const c = clientes.find((x) => String(x._id) === String(form.clienteId));
      if (c) setDireccion(direccionDeCliente(c));
    }
  }

  async function crear(e) {
    e.preventDefault();
    setError(null);
    if (!aparatoId && !form.numeroSerie.trim() && !form.marca.trim() && !form.modelo.trim()) {
      setError("Busca el aparato en la cartera o pulsa «Aparato nuevo» y rellena al menos marca, modelo o nº de serie.");
      return;
    }
    setGuardando(true);
    try {
      const dir = {
        calle: direccion.calle.trim() || undefined,
        cp: direccion.cp.trim() || undefined,
        ciudad: direccion.ciudad.trim() || undefined,
        provincia: direccion.provincia.trim() || undefined,
      };
      const r = await fetch("/api/servicio/recepcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aparatoId: aparatoId || undefined,
          tipo: !aparatoId && form.tipo ? form.tipo : undefined,
          marca: !aparatoId ? form.marca.trim() || undefined : undefined,
          modelo: !aparatoId ? form.modelo.trim() || undefined : undefined,
          numeroSerie: !aparatoId ? form.numeroSerie.trim() || undefined : undefined,
          clienteId: form.clienteId || undefined,
          nombreCliente: form.nombreCliente.trim() || undefined,
          telefono: form.telefono.trim() || undefined,
          tipoServicio,
          // Sin dirección el backend usa la fiscal del cliente (si la tiene).
          direccionIntervencion:
            tipoServicio === "domicilio" && Object.values(dir).some(Boolean) ? dir : undefined,
          averia: form.averia.trim(),
          accesorios: form.accesorios.trim() || undefined,
          estadoFisico: form.estadoFisico.trim() || undefined,
          garantia: form.garantia,
          garantiaHasta: form.garantiaHasta || undefined,
          presupuestoId: presupuestoId || undefined,
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo crear la recepción");
      // La cita que origina la recepción queda realizada automáticamente.
      if (citaElegida) {
        await fetch(`/api/servicio/citas/${citaElegida._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: "realizada" }),
        }).catch(() => {});
      }
      onCreada(datos);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-1">Recepción rápida</h2>
        <p className="text-sm text-slate-400 mb-5">
          Alta exprés del aparato y apertura de la orden de servicio en un paso.
        </p>

        <form onSubmit={crear} className="space-y-4">
          {/* Entrada por cita: las de hoy como acceso rápido y buscador para el resto */}
          {!citaElegida ? (
            <div className="rounded-xl border border-sky-300 bg-sky-50 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
                ¿Viene con cita?
              </p>
              {citasHoy.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {citasHoy.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => elegirCita(c)}
                      className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm text-sky-800 hover:bg-sky-100 transition"
                    >
                      <span className="font-semibold">{c.hora}</span>
                      {c.aparatoDescripcion && <span className="font-bold"> · {c.aparatoDescripcion}</span>}
                      {c.clienteNombre && <span className="text-sky-600"> · {c.clienteNombre}</span>}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  type="search"
                  className={campo}
                  value={buscaCita}
                  onChange={(e) => setBuscaCita(e.target.value)}
                  placeholder="Buscar otra cita por cliente, aparato, dirección, motivo…"
                />
                {citasFiltradas.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {citasFiltradas.map((c) => (
                      <li key={c._id}>
                        <button
                          type="button"
                          onClick={() => elegirCita(c)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition"
                        >
                          <span className="text-slate-500">
                            {new Date(c.fecha).toLocaleDateString("es-ES")} {c.hora}
                          </span>
                          {c.aparatoDescripcion && <span className="font-bold text-slate-800"> · {c.aparatoDescripcion}</span>}
                          {c.clienteNombre && <span className="text-slate-600"> · {c.clienteNombre}</span>}
                          {c.motivo && <span className="block text-xs text-slate-400 truncate">{c.motivo}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {buscaCita.trim() && citasFiltradas.length === 0 && (
                  <p className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">
                    Sin citas pendientes que coincidan.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-sky-300 bg-sky-50 px-3 py-2">
              <p className="text-sm text-sky-800">
                Cita del {new Date(citaElegida.fecha).toLocaleDateString("es-ES")} {citaElegida.hora}
                {citaElegida.aparatoDescripcion && <span className="font-bold"> · {citaElegida.aparatoDescripcion}</span>}
                {citaElegida.clienteNombre && <span> · {citaElegida.clienteNombre}</span>}
                <span className="text-sky-600"> — se marcará realizada al crear la recepción</span>
              </p>
              <button type="button" onClick={quitarCita} className="text-sky-700 hover:text-sky-900 text-sm ml-3">
                × Quitar
              </button>
            </div>
          )}

          {/* Aparato: se busca en la cartera o se da de alta al vuelo */}
          <div>
            <label className="text-sm text-slate-400 block mb-1">Aparato *</label>
            {aparatoElegido ? (
              <div className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/5 px-3 py-2">
                <p className="text-sm text-slate-200">
                  <span className="font-semibold text-white">{nombreTipoAparato(aparatoElegido.tipo)}</span>
                  {[aparatoElegido.marca, aparatoElegido.modelo].filter(Boolean).length > 0 && (
                    <span> · {[aparatoElegido.marca, aparatoElegido.modelo].filter(Boolean).join(" ")}</span>
                  )}
                  {aparatoElegido.numeroSerie && (
                    <span className="text-slate-400"> · S/N {aparatoElegido.numeroSerie}</span>
                  )}
                  {aparatoElegido.codigo && <span className="text-slate-500"> · {aparatoElegido.codigo}</span>}
                  {aparatoElegido.clienteNombre && (
                    <span className="block text-xs text-slate-500">{aparatoElegido.clienteNombre}</span>
                  )}
                </p>
                <button type="button" onClick={quitarAparato} className="text-slate-400 hover:text-white text-sm ml-3 shrink-0">
                  × Cambiar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="search"
                    className={campo}
                    value={buscaAparato}
                    onChange={(e) => setBuscaAparato(e.target.value)}
                    placeholder="Buscar por nº de serie, marca, modelo, código o cliente…"
                  />
                  {buscaAparato.trim() && (
                    <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {aparatosFiltrados.map((a) => (
                        <li key={a._id}>
                          <button
                            type="button"
                            onClick={() => elegirAparato(a)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition"
                          >
                            <span className="font-semibold text-slate-800">{nombreTipoAparato(a.tipo)}</span>
                            {[a.marca, a.modelo].filter(Boolean).length > 0 && (
                              <span className="text-slate-700"> · {[a.marca, a.modelo].filter(Boolean).join(" ")}</span>
                            )}
                            {a.numeroSerie && <span className="text-slate-500"> · S/N {a.numeroSerie}</span>}
                            <span className="block text-xs text-slate-400 truncate">
                              {[a.codigo, a.clienteNombre].filter(Boolean).join(" · ")}
                            </span>
                          </button>
                        </li>
                      ))}
                      {aparatosFiltrados.length === 0 && (
                        <li className="px-3 py-2 text-sm text-slate-500">Sin aparatos que coincidan.</li>
                      )}
                    </ul>
                  )}
                </div>
                {!modoNuevo ? (
                  <button
                    type="button"
                    onClick={() => setModoNuevo(true)}
                    className="text-xs font-semibold text-accent hover:underline underline-offset-2"
                  >
                    + No está en la lista: aparato nuevo
                  </button>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-white/10 p-3">
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Tipo</label>
                      <select
                        className={campo}
                        value={form.tipo}
                        onChange={(e) => actualizar("tipo", e.target.value)}
                      >
                        <option value="">Sin indicar</option>
                        {TIPOS_APARATO.map((t) => (
                          <option key={t.clave} value={t.clave}>
                            {t.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Marca</label>
                      <input className={campo} value={form.marca} onChange={(e) => actualizar("marca", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Modelo</label>
                      <input className={campo} value={form.modelo} onChange={(e) => actualizar("modelo", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400 block mb-1">Nº de serie</label>
                      <input
                        className={campo}
                        value={form.numeroSerie}
                        onChange={(e) => actualizar("numeroSerie", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Cliente existente</label>
              <SelectorContacto
                tipo="cliente"
                contactos={clientes.map((c) => ({
                  _id: c._id,
                  nombre: c.nombre,
                  secundario: [c.nif, c.telefono].filter(Boolean).join(" · ") || undefined,
                }))}
                valor={form.clienteId}
                onChange={elegirCliente}
                onCreado={(c) => setClientes((cs) => [...cs, c])}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Nombre cliente</label>
              <input
                className={campo}
                value={form.nombreCliente}
                onChange={(e) => actualizar("nombreCliente", e.target.value)}
                disabled={!!form.clienteId}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Teléfono</label>
              <input className={campo} value={form.telefono} onChange={(e) => actualizar("telefono", e.target.value)} />
            </div>
          </div>

          {/* Dónde se hace el servicio: en tienda o desplazándose al cliente */}
          <div>
            <label className="text-sm text-slate-400 block mb-1">Lugar del servicio</label>
            <div className="flex gap-2">
              {[
                ["tienda", "En tienda"],
                ["domicilio", "A domicilio"],
              ].map(([v, nombre]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => cambiarTipoServicio(v)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    tipoServicio === v
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-white/10 text-slate-400 hover:border-white/25"
                  }`}
                >
                  {nombre}
                </button>
              ))}
            </div>
          </div>

          {tipoServicio === "domicilio" && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Dirección de la intervención
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-sm text-slate-400 block mb-1">Calle</label>
                  <input
                    className={campo}
                    value={direccion.calle}
                    onChange={(e) => setDireccion((d) => ({ ...d, calle: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">CP</label>
                  <input
                    className={campo}
                    value={direccion.cp}
                    onChange={(e) => setDireccion((d) => ({ ...d, cp: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Ciudad</label>
                  <input
                    className={campo}
                    value={direccion.ciudad}
                    onChange={(e) => setDireccion((d) => ({ ...d, ciudad: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="text-sm text-slate-400 block mb-1">Provincia</label>
                  <input
                    className={campo}
                    value={direccion.provincia}
                    onChange={(e) => setDireccion((d) => ({ ...d, provincia: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Presupuesto abierto del cliente: se incluye en la orden y sus
              líneas se cargan solas; el presupuesto queda aceptado. */}
          {form.clienteId && presupuestos.length > 0 && (
            <div className="rounded-xl border border-violet-300 bg-violet-50 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                Este cliente tiene {presupuestos.length === 1 ? "un presupuesto abierto" : `${presupuestos.length} presupuestos abiertos`}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPresupuestoId("")}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    !presupuestoId
                      ? "border-violet-500 bg-violet-600 text-white font-semibold"
                      : "border-violet-300 bg-white text-violet-800 hover:bg-violet-100"
                  }`}
                >
                  Sin presupuesto
                </button>
                {presupuestos.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => setPresupuestoId(p._id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      presupuestoId === p._id
                        ? "border-violet-500 bg-violet-600 text-white font-semibold"
                        : "border-violet-300 bg-white text-violet-800 hover:bg-violet-100"
                    }`}
                  >
                    <span className="font-bold">{p.serieNumero}</span>
                    <span> · {new Date(p.fecha).toLocaleDateString("es-ES")}</span>
                    <span className="num"> · {euros(p.total)}</span>
                  </button>
                ))}
              </div>
              {presupuestoId && (
                <p className="text-xs text-violet-600">
                  Se vinculará a la orden y sus líneas se cargarán en ella; el presupuesto quedará aceptado.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="text-sm text-slate-400 block mb-1">Avería / síntoma descrito por el cliente *</label>
            <textarea
              className={`${campo} resize-none`}
              rows={2}
              value={form.averia}
              onChange={(e) => actualizar("averia", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="text-sm text-slate-400 block mb-1">Accesorios que trae</label>
              <input
                className={campo}
                value={form.accesorios}
                onChange={(e) => actualizar("accesorios", e.target.value)}
                placeholder="Cables, cargador, funda, mando…"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-slate-400 block mb-1">Estado físico</label>
              <input
                className={campo}
                value={form.estadoFisico}
                onChange={(e) => actualizar("estadoFisico", e.target.value)}
                placeholder="Golpes, arañazos, pantalla…"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="text-sm text-slate-400 block mb-1">Garantía</label>
              <select
                className={campo}
                value={form.garantia}
                onChange={(e) => actualizar("garantia", e.target.value)}
              >
                <option value="sin_garantia">Sin garantía</option>
                <option value="en_garantia">En garantía</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="text-sm text-slate-400 block mb-1">Garantía hasta</label>
              <input
                type="date"
                className={campo}
                value={form.garantiaHasta}
                onChange={(e) => actualizar("garantiaHasta", e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCerrar} className="btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primary disabled:opacity-50">
              {guardando ? "Creando…" : "Crear recepción"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
