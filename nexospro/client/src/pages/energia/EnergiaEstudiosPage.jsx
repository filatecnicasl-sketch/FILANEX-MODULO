import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import SelectorContacto from "../../components/SelectorContacto.jsx";
import { IconEditar, IconBorrar, IconCobros, IconDocumentos } from "../../components/icons.jsx";

const ESTADOS = {
  borrador: { label: "Borrador", tono: "bg-slate-400/10 text-slate-400 border-slate-400/30" },
  enviado: { label: "Enviado", tono: "bg-sky-400/10 text-sky-300 border-sky-400/30" },
  aceptado: { label: "Aceptado", tono: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30" },
  rechazado: { label: "Rechazado", tono: "bg-rose-400/10 text-rose-300 border-rose-400/30" },
};

function Badge({ tono, children }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tono}`}>
      {children}
    </span>
  );
}

const fmtEuro = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n ?? 0);

const VACIO = {
  suministroId: "", tipo: "luz", clienteId: "",
  comercializadoraActual: "", tarifaActual: "",
  consumoAnual: "", potenciaPunta: "", potenciaValle: "",
  precioEnergiaActual: "", precioPotenciaPuntaActual: "", precioPotenciaValleActual: "",
  costeAnualActual: "",
  comercializadoraId: "", tarifaPropuesta: "",
  precioEnergiaPropuesta: "", precioPotenciaPuntaPropuesta: "", precioPotenciaVallePropuesta: "",
  costeAnualPropuesta: "",
  notas: "",
};

// Coste anual a partir de los componentes (si los hay).
function coste(consumo, precioEnergia, pPunta, precioPunta, pValle, precioValle) {
  const e = (Number(consumo) || 0) * (Number(precioEnergia) || 0);
  const p1 = (Number(pPunta) || 0) * (Number(precioPunta) || 0);
  const p2 = (Number(pValle) || 0) * (Number(precioValle) || 0);
  return Math.round((e + p1 + p2) * 100) / 100;
}

// Estudios de ahorro: situación actual frente a propuesta. Si el cliente
// acepta, el programa abre solo el trámite de alta/cambio sobre el CUPS.
export default function EnergiaEstudiosPage() {
  const [lista, setLista] = useState(null);
  const [comercializadoras, setComercializadoras] = useState([]);
  const [suministros, setSuministros] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [params] = useSearchParams();

  const filtrada = (lista ?? []).filter((e) => {
    if (filtroEstado !== "todos" && e.estado !== filtroEstado) return false;
    return coincideBusqueda(q, e.cups, e.clienteNombre ?? e.cliente?.nombre, e.comercializadoraActual, e.comercializadoraNombre, e.tarifaActual);
  });

  const enCurso = (lista ?? []).filter((e) => ["borrador", "enviado"].includes(e.estado));
  const ahorroPotencial = enCurso.reduce((a, e) => a + Math.max(0, e.ahorroAnual ?? 0), 0);

  async function cargar() {
    try {
      const r = await fetch("/api/energia/estudios");
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
    fetch("/api/energia/comercializadoras")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setComercializadoras(Array.isArray(d) ? d : []))
      .catch(() => setComercializadoras([]));
    fetch("/api/energia/suministros")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSuministros(Array.isArray(d) ? d : []))
      .catch(() => setSuministros([]));
    fetch("/api/clientes")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setClientes(Array.isArray(d) ? d : []))
      .catch(() => setClientes([]));
  }, []);

  // ?nuevo=<suministroId> → abre el estudio precargado con los datos del CUPS.
  useEffect(() => {
    const nuevo = params.get("nuevo");
    if (!nuevo) return;
    fetch(`/api/energia/estudios/desde-suministro/${nuevo}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setEditando(null);
        setForm({
          ...VACIO,
          suministroId: d.suministro ?? "",
          tipo: d.tipo ?? "luz",
          clienteId: d.cliente ?? "",
          comercializadoraActual: d.comercializadoraActual ?? "",
          tarifaActual: d.tarifaActual ?? "",
          consumoAnual: d.consumoAnual || "",
          potenciaPunta: d.potenciaPunta || "",
          potenciaValle: d.potenciaValle || "",
        });
        setModal(true);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function abrirEdicion(e) {
    setEditando(e);
    setForm({
      suministroId: e.suministro ?? "",
      tipo: e.tipo ?? "luz",
      clienteId: e.cliente?._id ?? e.cliente ?? "",
      comercializadoraActual: e.comercializadoraActual ?? "",
      tarifaActual: e.tarifaActual ?? "",
      consumoAnual: e.consumoAnual || "",
      potenciaPunta: e.potenciaPunta || "",
      potenciaValle: e.potenciaValle || "",
      precioEnergiaActual: e.precioEnergiaActual || "",
      precioPotenciaPuntaActual: e.precioPotenciaPuntaActual || "",
      precioPotenciaValleActual: e.precioPotenciaValleActual || "",
      costeAnualActual: e.costeAnualActual || "",
      comercializadoraId: e.comercializadora ?? "",
      tarifaPropuesta: e.tarifaPropuesta ?? "",
      precioEnergiaPropuesta: e.precioEnergiaPropuesta || "",
      precioPotenciaPuntaPropuesta: e.precioPotenciaPuntaPropuesta || "",
      precioPotenciaVallePropuesta: e.precioPotenciaVallePropuesta || "",
      costeAnualPropuesta: e.costeAnualPropuesta || "",
      notas: e.notas ?? "",
    });
    setModal(true);
  }

  // Cálculo en vivo para la vista previa del modal.
  const costeActualCalc = coste(form.consumoAnual, form.precioEnergiaActual, form.potenciaPunta, form.precioPotenciaPuntaActual, form.potenciaValle, form.precioPotenciaValleActual);
  const costePropuestaCalc = coste(form.consumoAnual, form.precioEnergiaPropuesta, form.potenciaPunta, form.precioPotenciaPuntaPropuesta, form.potenciaValle, form.precioPotenciaVallePropuesta);
  const actualFinal = Number(form.costeAnualActual) > 0 ? Number(form.costeAnualActual) : costeActualCalc;
  const propuestaFinal = Number(form.costeAnualPropuesta) > 0 ? Number(form.costeAnualPropuesta) : costePropuestaCalc;
  const ahorro = Math.round((actualFinal - propuestaFinal) * 100) / 100;
  const ahorroPct = actualFinal > 0 ? Math.round((ahorro / actualFinal) * 1000) / 10 : 0;

  async function guardar(e) {
    e.preventDefault();
    const cuerpo = {
      suministro: form.suministroId || null,
      tipo: form.tipo,
      cliente: form.clienteId || null,
      comercializadoraActual: form.comercializadoraActual,
      tarifaActual: form.tarifaActual,
      consumoAnual: Number(form.consumoAnual) || 0,
      potenciaPunta: Number(form.potenciaPunta) || 0,
      potenciaValle: Number(form.potenciaValle) || 0,
      precioEnergiaActual: Number(form.precioEnergiaActual) || 0,
      precioPotenciaPuntaActual: Number(form.precioPotenciaPuntaActual) || 0,
      precioPotenciaValleActual: Number(form.precioPotenciaValleActual) || 0,
      costeAnualActual: Number(form.costeAnualActual) || undefined,
      comercializadora: form.comercializadoraId || null,
      tarifaPropuesta: form.tarifaPropuesta,
      precioEnergiaPropuesta: Number(form.precioEnergiaPropuesta) || 0,
      precioPotenciaPuntaPropuesta: Number(form.precioPotenciaPuntaPropuesta) || 0,
      precioPotenciaVallePropuesta: Number(form.precioPotenciaVallePropuesta) || 0,
      costeAnualPropuesta: Number(form.costeAnualPropuesta) || undefined,
      notas: form.notas,
    };
    const r = await fetch(`/api/energia/estudios${editando ? `/${editando._id}` : ""}`, {
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

  async function cambiarEstado(e, estado, texto) {
    if (!window.confirm(texto)) return;
    const r = await fetch(`/api/energia/estudios/${e._id}/estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const datos = await r.json();
    if (r.ok) {
      if (estado === "aceptado") alert("Estudio aceptado. Se ha abierto el trámite de cambio de comercializadora (lo tienes en Energía → Trámites).");
      cargar();
    } else alert(datos.error || "No se pudo cambiar el estado");
  }

  async function borrar(e) {
    if (!window.confirm("¿Borrar este estudio de ahorro?")) return;
    const r = await fetch(`/api/energia/estudios/${e._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  const poner = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const esLuz = form.tipo === "luz";

  return (
    <CabeceraPagina
      titulo="Estudios de ahorro"
      descripcion="Situación actual del cliente frente a tu propuesta. Si acepta, el trámite de cambio se abre solo."
    >
      {error && <div className="panel px-4 py-3 text-sm text-rose-400 mb-3">{error}</div>}

      {lista === null ? (
        <div className="panel px-4 py-10 text-center text-slate-500">Cargando…</div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por CUPS, cliente, comercializadora…" />
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="input w-auto">
              <option value="todos">Estado: todos</option>
              <option value="borrador">Borradores</option>
              <option value="enviado">Enviados</option>
              <option value="aceptado">Aceptados</option>
              <option value="rechazado">Rechazados</option>
            </select>
            <div className="ms-auto flex flex-wrap items-center gap-2">
              {enCurso.length > 0 && (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-300 text-sm whitespace-nowrap">
                  Ahorro potencial en curso: <b className="num">{fmtEuro(ahorroPotencial)}/año</b>
                </span>
              )}
              <button onClick={() => { setEditando(null); setForm(VACIO); setModal(true); }} className="btn-primary whitespace-nowrap">
                Nuevo estudio
              </button>
            </div>
          </div>

          <div className="panel overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Cliente / CUPS</th>
                  <th>Actual</th>
                  <th>Propuesta</th>
                  <th className="text-right">Coste año</th>
                  <th className="text-right">Ahorro</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-8">
                      {lista.length === 0
                        ? "Aún no hay estudios. Pídele la factura al cliente, impórtala en Suministros y abre el estudio desde allí (o créalo a mano con «Nuevo estudio»)."
                        : "Ningún estudio coincide con esos filtros."}
                    </td>
                  </tr>
                )}
                {filtrada.map((e) => (
                  <tr key={e._id}>
                    <td>
                      <p className="font-medium text-slate-200 whitespace-nowrap">{e.clienteNombre ?? e.cliente?.nombre ?? "Sin cliente"}</p>
                      {e.cups && <p className="num text-xs text-slate-500 whitespace-nowrap">{e.cups}</p>}
                    </td>
                    <td className="text-slate-300 text-sm whitespace-nowrap">
                      {e.comercializadoraActual || "—"}
                      {e.tarifaActual && <p className="text-xs text-slate-500">{e.tarifaActual}</p>}
                    </td>
                    <td className="text-slate-300 text-sm whitespace-nowrap">
                      {e.comercializadoraNombre ?? "—"}
                      {e.tarifaPropuesta && <p className="text-xs text-slate-500">{e.tarifaPropuesta}</p>}
                    </td>
                    <td className="text-right num text-slate-300 whitespace-nowrap">
                      {fmtEuro(e.costeAnualActual)}
                      <p className="text-xs text-slate-500">→ {fmtEuro(e.costeAnualPropuesta)}</p>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <p className={`num font-semibold ${e.ahorroAnual > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {fmtEuro(e.ahorroAnual)}
                      </p>
                      <p className="text-xs text-slate-500 num">{e.ahorroPorcentaje}%</p>
                    </td>
                    <td><Badge tono={ESTADOS[e.estado].tono}>{ESTADOS[e.estado].label}</Badge></td>
                    <td className="text-right whitespace-nowrap">
                      {e.estado === "borrador" && (
                        <button
                          onClick={() => cambiarEstado(e, "enviado", "¿Marcar como enviado al cliente?")}
                          className="p-1.5 text-slate-400 hover:text-sky-400"
                          title="Marcar enviado"
                        >
                          <IconDocumentos />
                        </button>
                      )}
                      {e.estado === "enviado" && (
                        <button
                          onClick={() => cambiarEstado(e, "aceptado", "¿El cliente ACEPTA? Se abrirá el trámite de cambio de comercializadora automáticamente.")}
                          className="p-1.5 text-slate-400 hover:text-emerald-400"
                          title="Aceptado: abre el trámite"
                        >
                          <IconCobros />
                        </button>
                      )}
                      {["borrador", "enviado"].includes(e.estado) && (
                        <>
                          <button onClick={() => abrirEdicion(e)} className="p-1.5 text-slate-400 hover:text-sky-400" title="Editar">
                            <IconEditar />
                          </button>
                          <button onClick={() => borrar(e)} className="p-1.5 text-slate-400 hover:text-rose-400" title="Borrar">
                            <IconBorrar />
                          </button>
                        </>
                      )}
                      {e.estado === "aceptado" && (
                        <Link to="/energia/tramites" className="text-xs text-sky-400 hover:underline whitespace-nowrap" title="Ver el trámite abierto">
                          Ver trámite
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- Modal crear/editar estudio --- */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <form
            className="panel max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <h2 className="text-lg font-bold text-white">{editando ? "Editar estudio" : "Nuevo estudio de ahorro"}</h2>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm text-slate-400 sm:col-span-2">
                Suministro (CUPS)
                <select value={form.suministroId} onChange={poner("suministroId")} className="input">
                  <option value="">— Sin vincular (estudio sobre CUPS nuevo) —</option>
                  {suministros.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.cups} — {s.clienteNombre ?? "sin cliente"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-400">
                Tipo
                <select value={form.tipo} onChange={poner("tipo")} className="input">
                  <option value="luz">Luz</option>
                  <option value="gas">Gas</option>
                </select>
              </label>
            </div>

            {!form.suministroId && (
              <div className="text-sm text-slate-400 sm:w-1/2">
                Cliente
                <SelectorContacto
                  tipo="cliente"
                  contactos={clientes}
                  valor={form.clienteId}
                  onChange={(id) => setForm((f) => ({ ...f, clienteId: id ?? "" }))}
                />
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Situación actual */}
              <div className="rounded-xl border border-slate-600/40 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-300">Situación actual</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm text-slate-400">
                    Comercializadora
                    <input value={form.comercializadoraActual} onChange={poner("comercializadoraActual")} className="input" placeholder="La que tiene hoy" />
                  </label>
                  <label className="text-sm text-slate-400">
                    Tarifa
                    <input value={form.tarifaActual} onChange={poner("tarifaActual")} className="input" placeholder={esLuz ? "2.0TD…" : "RL.2…"} />
                  </label>
                  <label className="text-sm text-slate-400">
                    Consumo anual (kWh)
                    <input value={form.consumoAnual} onChange={poner("consumoAnual")} className="input num" inputMode="decimal" />
                  </label>
                  <label className="text-sm text-slate-400">
                    Precio energía (€/kWh)
                    <input value={form.precioEnergiaActual} onChange={poner("precioEnergiaActual")} className="input num" inputMode="decimal" />
                  </label>
                  {esLuz && (
                    <>
                      <label className="text-sm text-slate-400">
                        Potencia punta (kW)
                        <input value={form.potenciaPunta} onChange={poner("potenciaPunta")} className="input num" inputMode="decimal" />
                      </label>
                      <label className="text-sm text-slate-400">
                        Potencia valle (kW)
                        <input value={form.potenciaValle} onChange={poner("potenciaValle")} className="input num" inputMode="decimal" />
                      </label>
                      <label className="text-sm text-slate-400">
                        €/kW·año punta
                        <input value={form.precioPotenciaPuntaActual} onChange={poner("precioPotenciaPuntaActual")} className="input num" inputMode="decimal" />
                      </label>
                      <label className="text-sm text-slate-400">
                        €/kW·año valle
                        <input value={form.precioPotenciaValleActual} onChange={poner("precioPotenciaValleActual")} className="input num" inputMode="decimal" />
                      </label>
                    </>
                  )}
                  <label className="text-sm text-slate-400 col-span-2">
                    Coste anual actual (€) <span className="text-xs text-slate-500">— vacío = se calcula con los componentes</span>
                    <input value={form.costeAnualActual} onChange={poner("costeAnualActual")} className="input num" inputMode="decimal" placeholder={costeActualCalc > 0 ? String(costeActualCalc) : "De la factura real del cliente"} />
                  </label>
                </div>
              </div>

              {/* Propuesta */}
              <div className="rounded-xl border border-emerald-500/30 p-4 space-y-3">
                <p className="text-sm font-semibold text-emerald-300">Tu propuesta</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm text-slate-400">
                    Comercializadora *
                    <select value={form.comercializadoraId} onChange={poner("comercializadoraId")} className="input" required>
                      <option value="">— Elige —</option>
                      {comercializadoras.map((c) => (
                        <option key={c._id} value={c._id}>{c.nombre}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-slate-400">
                    Tarifa propuesta
                    <input value={form.tarifaPropuesta} onChange={poner("tarifaPropuesta")} className="input" />
                  </label>
                  <label className="text-sm text-slate-400">
                    Precio energía (€/kWh)
                    <input value={form.precioEnergiaPropuesta} onChange={poner("precioEnergiaPropuesta")} className="input num" inputMode="decimal" />
                  </label>
                  {esLuz && (
                    <>
                      <label className="text-sm text-slate-400">
                        €/kW·año punta
                        <input value={form.precioPotenciaPuntaPropuesta} onChange={poner("precioPotenciaPuntaPropuesta")} className="input num" inputMode="decimal" />
                      </label>
                      <label className="text-sm text-slate-400">
                        €/kW·año valle
                        <input value={form.precioPotenciaVallePropuesta} onChange={poner("precioPotenciaVallePropuesta")} className="input num" inputMode="decimal" />
                      </label>
                    </>
                  )}
                  <label className="text-sm text-slate-400 col-span-2">
                    Coste anual propuesta (€) <span className="text-xs text-slate-500">— vacío = se calcula</span>
                    <input value={form.costeAnualPropuesta} onChange={poner("costeAnualPropuesta")} className="input num" inputMode="decimal" placeholder={costePropuestaCalc > 0 ? String(costePropuestaCalc) : ""} />
                  </label>
                </div>
              </div>
            </div>

            {/* Vista previa del ahorro */}
            <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${ahorro > 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-600/40"}`}>
              <div className="text-sm text-slate-400">
                Coste anual: <b className="num text-slate-200">{fmtEuro(actualFinal)}</b> → <b className="num text-emerald-300">{fmtEuro(propuestaFinal)}</b>
              </div>
              <div className="text-right">
                <p className={`text-xl font-bold num ${ahorro > 0 ? "text-emerald-300" : "text-slate-300"}`}>
                  {ahorro > 0 ? `Ahorro ${fmtEuro(ahorro)}/año` : fmtEuro(ahorro)}
                </p>
                {actualFinal > 0 && <p className="text-xs text-slate-500 num">{ahorroPct}% sobre su factura actual</p>}
              </div>
            </div>

            <label className="text-sm text-slate-400 block">
              Notas
              <textarea value={form.notas} onChange={poner("notas")} className="input" rows={2} placeholder="Condiciones especiales, permanencia, observaciones para el cliente…" />
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
