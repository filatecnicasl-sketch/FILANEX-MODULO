import { useEffect, useState } from "react";
import EditorLineas, { lineaVacia } from "../../components/EditorLineas.jsx";
import SelectorContacto from "../../components/SelectorContacto.jsx";
import BuscadorEntidad from "../../components/BuscadorEntidad.jsx";
import { enterComoTab } from "../../utils/enter-tab.js";
import { ESTADOS_OS, aFechaInput } from "./datos.js";

const campo = "input w-full";

const DIRECCION_VACIA = { calle: "", cp: "", ciudad: "", provincia: "" };

// Dirección de intervención precargada de la ficha del cliente.
const direccionDeCliente = (c) => ({
  calle: c?.direccion?.calle ?? "",
  cp: c?.direccion?.cp ?? "",
  ciudad: c?.direccion?.ciudad ?? "",
  provincia: c?.direccion?.provincia ?? "",
});

// Etiqueta del aparato en el selector: "AP-000001 · HP Pavilion 15 · S/N ABC123".
const etiquetaAparato = (a) =>
  [a?.codigo, [a?.marca, a?.modelo].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

// Orden de servicio completa (alta y edición): aparato, cliente, servicio en
// tienda o a domicilio, avería y diagnóstico, accesorios/estado/garantía,
// fechas, líneas (MO/material) y presupuesto del que nace. La recepción
// rápida sigue existiendo para el pase exprés.
export default function FormOrdenServicio({ orden, onCerrar, onGuardada }) {
  const editando = Boolean(orden?._id);
  const [aparatos, setAparatos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(() => ({
    aparatoId: orden?.aparato?._id ?? orden?.aparato ?? "",
    clienteId: orden?.cliente?._id ?? orden?.cliente ?? "",
    telefono: orden?.telefono ?? "",
    tipoServicio: orden?.tipoServicio ?? "tienda",
    direccionIntervencion: { ...DIRECCION_VACIA, ...(orden?.direccionIntervencion ?? {}) },
    averia: orden?.averia ?? "",
    diagnostico: orden?.diagnostico ?? "",
    accesorios: orden?.accesorios ?? "",
    estadoFisico: orden?.estadoFisico ?? "",
    garantia: orden?.garantia ?? "sin_garantia",
    garantiaHasta: orden?.garantiaHasta ? aFechaInput(orden.garantiaHasta) : "",
    fechaEntrada: aFechaInput(orden?.fechaEntrada ?? new Date()),
    fechaEntregaPrevista: orden?.fechaEntregaPrevista ? aFechaInput(orden.fechaEntregaPrevista) : "",
    notasInternas: orden?.notasInternas ?? "",
    estado: orden?.estado ?? "recepcion",
    presupuesto: orden?.presupuesto?._id ?? orden?.presupuesto ?? "",
  }));
  const [presupuestos, setPresupuestos] = useState([]); // abiertos del cliente (vinculables)
  const [lineas, setLineas] = useState(() =>
    orden?.lineas?.length ? orden.lineas.map((l) => ({ ...l })) : [{ ...lineaVacia(), tipo: "mano_obra", descuento: 0 }]
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const poner = (c, v) => setForm((f) => ({ ...f, [c]: v }));
  const ponerDireccion = (c, v) =>
    setForm((f) => ({ ...f, direccionIntervencion: { ...f.direccionIntervencion, [c]: v } }));

  useEffect(() => {
    fetch("/api/servicio/aparatos").then((r) => (r.ok ? r.json() : [])).then(setAparatos).catch(() => setAparatos([]));
    fetch("/api/clientes").then((r) => (r.ok ? r.json() : [])).then(setClientes).catch(() => setClientes([]));
  }, []);

  // Presupuestos abiertos del cliente elegido (se excluye esta orden para
  // poder conservar el que ya tiene vinculado).
  useEffect(() => {
    if (!form.clienteId) {
      setPresupuestos([]);
      return;
    }
    let vivo = true;
    const extra = editando ? `&excluirOrden=${orden._id}` : "";
    fetch(`/api/servicio/presupuestos-abiertos?cliente=${form.clienteId}${extra}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => vivo && setPresupuestos(Array.isArray(lista) ? lista : []))
      .catch(() => vivo && setPresupuestos([]));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.clienteId]);

  // Al elegir aparato en una orden nueva: arrastra su cliente (con su
  // teléfono) y copia accesorios, estado físico y garantía del alta del
  // aparato, sin pisar lo que ya se haya escrito a mano. Si el cliente
  // cambia, se descarta el presupuesto elegido (sería de otro cliente).
  function elegirAparato(id) {
    const a = aparatos.find((x) => x._id === id);
    setForm((f) => {
      const siguiente = { ...f, aparatoId: id };
      if (!editando && a) {
        const clienteDelAparato = a.cliente
          ? clientes.find((c) => String(c._id) === String(a.cliente))
          : null;
        if (clienteDelAparato && String(f.clienteId ?? "") !== String(clienteDelAparato._id)) {
          siguiente.clienteId = clienteDelAparato._id;
          siguiente.telefono = clienteDelAparato.telefono ?? f.telefono;
          siguiente.presupuesto = "";
        }
        if (!f.accesorios && a.accesorios) siguiente.accesorios = a.accesorios;
        if (!f.estadoFisico && a.estadoFisico) siguiente.estadoFisico = a.estadoFisico;
        if (!f.garantiaHasta && a.garantiaHasta) siguiente.garantiaHasta = aFechaInput(a.garantiaHasta);
      }
      return siguiente;
    });
  }

  function elegirCliente(id) {
    const c = clientes.find((x) => x._id === id);
    setForm((f) => ({
      ...f,
      clienteId: id,
      telefono: c?.telefono ?? f.telefono,
      presupuesto: "",
      // A domicilio: la intervención se hace por defecto en la dirección del cliente.
      direccionIntervencion:
        f.tipoServicio === "domicilio" && !f.direccionIntervencion.calle
          ? direccionDeCliente(c)
          : f.direccionIntervencion,
    }));
  }

  function ponerTipoServicio(tipo) {
    setForm((f) => {
      const siguiente = { ...f, tipoServicio: tipo };
      if (tipo === "domicilio" && !f.direccionIntervencion.calle) {
        const c = clientes.find((x) => x._id === f.clienteId);
        if (c?.direccion) siguiente.direccionIntervencion = direccionDeCliente(c);
      }
      return siguiente;
    });
  }

  // Carga las líneas del presupuesto elegido en el editor de la orden.
  function cargarLineasPresupuesto() {
    const p = presupuestos.find((x) => String(x._id) === String(form.presupuesto));
    if (!p) return;
    const nuevas = (p.lineas ?? []).filter((l) => l.descripcion).map((l) => ({ ...l }));
    if (nuevas.length === 0) return;
    setLineas((ls) => {
      const actuales = ls.filter((l) => l.descripcion);
      if (actuales.length > 0 && !window.confirm(`La orden ya tiene ${actuales.length} línea(s). ¿Añadir las ${nuevas.length} del presupuesto ${p.serieNumero} al final?`)) {
        return ls;
      }
      return [...actuales, ...nuevas];
    });
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const aparato = aparatos.find((a) => a._id === form.aparatoId);
      if (!editando && !aparato) throw new Error("Elige el aparato");
      const cliente = clientes.find((c) => c._id === form.clienteId);
      const cuerpo = {
        cliente: cliente?._id ?? null,
        clienteNombre: cliente?.nombre,
        telefono: form.telefono.trim() || undefined,
        tipoServicio: form.tipoServicio,
        direccionIntervencion:
          form.tipoServicio === "domicilio"
            ? {
                calle: form.direccionIntervencion.calle.trim() || undefined,
                cp: form.direccionIntervencion.cp.trim() || undefined,
                ciudad: form.direccionIntervencion.ciudad.trim() || undefined,
                provincia: form.direccionIntervencion.provincia.trim() || undefined,
              }
            : editando
              ? null
              : undefined,
        averia: form.averia.trim() || undefined,
        diagnostico: form.diagnostico.trim() || undefined,
        accesorios: form.accesorios.trim() || undefined,
        estadoFisico: form.estadoFisico.trim() || undefined,
        garantia: form.garantia,
        garantiaHasta: form.garantia === "en_garantia" && form.garantiaHasta ? form.garantiaHasta : null,
        fechaEntrada: form.fechaEntrada || undefined,
        fechaEntregaPrevista: form.fechaEntregaPrevista || undefined,
        notasInternas: form.notasInternas.trim() || undefined,
        lineas: lineas
          .filter((l) => l.descripcion)
          .map((l) => ({
            descripcion: l.descripcion,
            tipo: l.tipo === "material" ? "material" : "mano_obra",
            cantidad: Number(l.cantidad) || 0,
            precioUnitario: Number(l.precioUnitario) || 0,
            descuento: Number(l.descuento) || 0,
            iva: Number(l.iva) || 0,
          })),
        presupuesto: form.presupuesto || null,
      };
      if (editando) cuerpo.estado = form.estado;
      else cuerpo.aparato = aparato._id; // el PUT no admite cambiar el aparato
      const r = await fetch(editando ? `/api/servicio/ordenes/${orden._id}` : "/api/servicio/ordenes", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo guardar la orden");
      onGuardada(datos);
    } catch (e2) {
      setError(e2.message);
      setGuardando(false);
    }
  }

  const presupuestoElegido = presupuestos.find((p) => String(p._id) === String(form.presupuesto));
  const numeroPresupuesto = presupuestoElegido?.serieNumero ?? (form.presupuesto ? orden?.presupuestoNumero : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="modal-panel w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              {editando ? `Orden ${orden.numero}` : "Nueva orden de servicio"}
            </h2>
            <p className="text-sm text-slate-400">
              {editando
                ? `${orden.aparatoDescripcion ?? "aparato"} · ${orden.clienteNombre ?? "sin cliente"}`
                : "Todos los datos de la reparación."}
            </p>
          </div>
          <button onClick={onCerrar} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <form onSubmit={guardar} onKeyDown={enterComoTab} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Aparato *</label>
              {editando ? (
                // El aparato de una orden no se puede cambiar una vez creada.
                <input
                  className={`${campo} opacity-60 cursor-not-allowed`}
                  value={`${etiquetaAparato(orden.aparato)}${orden.aparato?.numeroSerie ? ` · S/N ${orden.aparato.numeroSerie}` : ""}` || orden.aparatoDescripcion || ""}
                  disabled
                  readOnly
                />
              ) : (
                <BuscadorEntidad
                  opciones={aparatos.map((a) => ({
                    _id: a._id,
                    nombre: etiquetaAparato(a),
                    secundario: [a.numeroSerie ? `S/N ${a.numeroSerie}` : null, a.clienteNombre]
                      .filter(Boolean)
                      .join(" · "),
                  }))}
                  valorId={form.aparatoId}
                  onElegir={(op) => elegirAparato(op?._id ?? "")}
                  placeholder="Buscar por código, marca, modelo o S/N…"
                  required
                />
              )}
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Cliente</label>
              <SelectorContacto
                tipo="cliente"
                contactos={clientes}
                valor={form.clienteId}
                onChange={elegirCliente}
                onCreado={(c) => setClientes((cs) => [...cs, c])}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Teléfono</label>
              <input className={campo} value={form.telefono} onChange={(e) => poner("telefono", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Tipo de servicio</label>
              <div className="inline-flex w-full rounded-lg overflow-hidden border border-white/10 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => ponerTipoServicio("tienda")}
                  className={`flex-1 px-3 py-2 transition-colors ${
                    form.tipoServicio === "tienda" ? "bg-accent/15 text-accent" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  En tienda
                </button>
                <button
                  type="button"
                  onClick={() => ponerTipoServicio("domicilio")}
                  className={`flex-1 px-3 py-2 transition-colors ${
                    form.tipoServicio === "domicilio" ? "bg-teal-400/15 text-teal-300" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  A domicilio
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Fecha de entrada</label>
              <input type="date" className={campo} value={form.fechaEntrada} onChange={(e) => poner("fechaEntrada", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Entrega estimada</label>
              <input type="date" className={campo} value={form.fechaEntregaPrevista} onChange={(e) => poner("fechaEntregaPrevista", e.target.value)} />
            </div>
          </div>

          {form.tipoServicio === "domicilio" && (
            <fieldset className="rounded-xl border border-teal-400/30 bg-teal-400/5 p-3">
              <legend className="text-xs uppercase tracking-wider text-teal-300 px-1">Dirección de la intervención</legend>
              <div className="space-y-2">
                <input
                  placeholder="Calle y número"
                  className={campo}
                  value={form.direccionIntervencion.calle}
                  onChange={(e) => ponerDireccion("calle", e.target.value)}
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <input
                    placeholder="Código postal"
                    className={campo}
                    value={form.direccionIntervencion.cp}
                    onChange={(e) => ponerDireccion("cp", e.target.value)}
                  />
                  <input
                    placeholder="Ciudad"
                    className={campo}
                    value={form.direccionIntervencion.ciudad}
                    onChange={(e) => ponerDireccion("ciudad", e.target.value)}
                  />
                  <input
                    placeholder="Provincia"
                    className={`${campo} col-span-2 sm:col-span-1`}
                    value={form.direccionIntervencion.provincia}
                    onChange={(e) => ponerDireccion("provincia", e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          )}

          <div>
            <label className="text-sm text-slate-400 block mb-1">Avería</label>
            <textarea
              className={`${campo} resize-none`}
              rows={2}
              value={form.averia}
              onChange={(e) => poner("averia", e.target.value)}
              placeholder="Síntoma descrito por el cliente"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1">Diagnóstico</label>
            <textarea
              className={`${campo} resize-none`}
              rows={2}
              value={form.diagnostico}
              onChange={(e) => poner("diagnostico", e.target.value)}
              placeholder="Diagnóstico / trabajo realizado"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Accesorios que trae</label>
              <input
                className={campo}
                value={form.accesorios}
                onChange={(e) => poner("accesorios", e.target.value)}
                placeholder="Cargador, funda, mando…"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Estado físico</label>
              <input
                className={campo}
                value={form.estadoFisico}
                onChange={(e) => poner("estadoFisico", e.target.value)}
                placeholder="Golpes, arañazos, pantalla…"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Garantía</label>
              <select className={campo} value={form.garantia} onChange={(e) => poner("garantia", e.target.value)}>
                <option value="sin_garantia">Sin garantía</option>
                <option value="en_garantia">En garantía</option>
              </select>
            </div>
            {form.garantia === "en_garantia" && (
              <div>
                <label className="text-sm text-slate-400 block mb-1">Garantía hasta</label>
                <input type="date" className={campo} value={form.garantiaHasta} onChange={(e) => poner("garantiaHasta", e.target.value)} />
              </div>
            )}
            {editando && (
              <div>
                <label className="text-sm text-slate-400 block mb-1">Estado</label>
                <select className={campo} value={form.estado} onChange={(e) => poner("estado", e.target.value)}>
                  {ESTADOS_OS.map((e2) => (
                    <option key={e2.clave} value={e2.clave}>{e2.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Presupuesto del que nace la orden (abierto, del cliente). Al
              vincularlo queda aceptado y se pueden cargar sus líneas. */}
          {(presupuestos.length > 0 || form.presupuesto) && (
            <fieldset className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
              <legend className="text-xs uppercase tracking-wider text-violet-300 px-1">
                Presupuesto
                {numeroPresupuesto && (
                  <span className="ml-1.5 inline-block rounded-full border bg-violet-100 text-violet-700 border-violet-200 text-[0.625rem] font-semibold px-1.5 py-px align-middle normal-case tracking-normal">
                    {numeroPresupuesto}
                  </span>
                )}
              </legend>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[220px]">
                  <select
                    className={campo}
                    value={form.presupuesto}
                    onChange={(e) => poner("presupuesto", e.target.value)}
                  >
                    <option value="">Sin presupuesto</option>
                    {presupuestos.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.serieNumero} · {new Date(p.fecha).toLocaleDateString("es-ES")} · {p.total?.toFixed(2)} €
                      </option>
                    ))}
                    {/* El vinculado puede no salir en la lista (p.ej. ya facturado) */}
                    {form.presupuesto && !presupuestoElegido && (
                      <option value={form.presupuesto}>
                        {orden?.presupuestoNumero ?? "Presupuesto vinculado"}
                      </option>
                    )}
                  </select>
                </div>
                {presupuestoElegido && (
                  <button
                    type="button"
                    onClick={cargarLineasPresupuesto}
                    className="btn-ghost !py-2 !px-3.5 text-xs whitespace-nowrap"
                  >
                    ⇩ Cargar sus líneas en la orden
                  </button>
                )}
              </div>
              {form.presupuesto && (
                <p className="text-[0.6875rem] text-violet-300/80 mt-1.5">
                  Al guardar, el presupuesto queda vinculado y aceptado; al facturar la orden se marca facturado.
                </p>
              )}
            </fieldset>
          )}

          <EditorLineas lineas={lineas} setLineas={setLineas} conTipo conDescuento />

          <div>
            <label className="text-sm text-slate-400 block mb-1">Notas internas</label>
            <textarea
              className={`${campo} resize-none`}
              rows={2}
              value={form.notasInternas}
              onChange={(e) => poner("notasInternas", e.target.value)}
              placeholder="No salen en los impresos"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary disabled:opacity-50">
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar orden"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
