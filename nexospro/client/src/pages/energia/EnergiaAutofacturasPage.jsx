import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import { IconEditar, IconBorrar, IconCobros } from "../../components/icons.jsx";

const ESTADOS = {
  pendiente: { label: "Pendiente", tono: "bg-amber-400/10 text-amber-300 border-amber-400/30" },
  cobrada: { label: "Cobrada", tono: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30" },
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

function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

function fmtPeriodo(p) {
  if (!p) return "—";
  const [a, m] = p.split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("es-ES", { month: "short", year: "numeric" });
}

const VACIO = { comercializadoraId: "", numero: "", periodo: periodoActual(), fecha: "", base: "", ivaPorcentaje: "21", notas: "" };

// Autofacturas: la liquidación mensual que manda cada comercializadora con
// las comisiones del canal. Se concilia contra lo calculado por el programa:
// si la base no cuadra con las comisiones del mes, salta la diferencia.
export default function EnergiaAutofacturasPage() {
  const [lista, setLista] = useState(null);
  const [comercializadoras, setComercializadoras] = useState([]);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);

  const filtrada = (lista ?? []).filter((a) => {
    if (filtroPeriodo && a.periodo !== filtroPeriodo) return false;
    if (filtroEstado !== "todos" && a.estado !== filtroEstado) return false;
    return coincideBusqueda(q, a.comercializadoraNombre, a.numero, a.notas);
  });

  const conDiferencia = filtrada.filter((a) => Math.abs(a.diferencia ?? 0) >= 0.01);

  async function cargar() {
    try {
      const r = await fetch("/api/energia/autofacturas");
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
  }, []);

  function abrirEdicion(a) {
    setEditando(a);
    setForm({
      comercializadoraId: a.comercializadora ?? "",
      numero: a.numero ?? "",
      periodo: a.periodo ?? periodoActual(),
      fecha: a.fecha ? new Date(a.fecha).toISOString().slice(0, 10) : "",
      base: a.base ?? "",
      ivaPorcentaje: a.ivaPorcentaje ?? "21",
      notas: a.notas ?? "",
    });
    setModal(true);
  }

  async function guardar(e) {
    e.preventDefault();
    const cuerpo = {
      comercializadora: form.comercializadoraId || null,
      numero: form.numero,
      periodo: form.periodo,
      fecha: form.fecha || null,
      base: Number(form.base) || 0,
      ivaPorcentaje: Number(form.ivaPorcentaje) || 0,
      notas: form.notas,
    };
    const r = await fetch(`/api/energia/autofacturas${editando ? `/${editando._id}` : ""}`, {
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

  async function cobrar(a) {
    if (!window.confirm(`¿Marcar como cobrada la autofactura de ${fmtEuro(a.total)} de ${a.comercializadoraNombre}?`)) return;
    const r = await fetch(`/api/energia/autofacturas/${a._id}/cobrar`, { method: "POST" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo marcar");
  }

  async function borrar(a) {
    if (!window.confirm(`¿Borrar la autofactura de ${a.comercializadoraNombre} de ${fmtPeriodo(a.periodo)}?`)) return;
    const r = await fetch(`/api/energia/autofacturas/${a._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  const poner = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <CabeceraPagina
      titulo="Autofacturas"
      descripcion="Las liquidaciones que te mandan las comercializadoras cada mes, conciliadas contra tus comisiones calculadas."
    >
      {error && <div className="panel px-4 py-3 text-sm text-rose-400 mb-3">{error}</div>}

      {lista === null ? (
        <div className="panel px-4 py-10 text-center text-slate-500">Cargando…</div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por comercializadora, número…" />
            <input
              type="month"
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
              className="input w-auto"
              title="Mes liquidado"
            />
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="input w-auto">
              <option value="todos">Estado: todos</option>
              <option value="pendiente">Pendientes</option>
              <option value="cobrada">Cobradas</option>
            </select>
            <div className="ms-auto flex flex-wrap items-center gap-2">
              {conDiferencia.length > 0 && (
                <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-rose-300 text-sm whitespace-nowrap">
                  {conDiferencia.length} con diferencia
                </span>
              )}
              <button onClick={() => { setEditando(null); setForm(VACIO); setModal(true); }} className="btn-primary whitespace-nowrap">
                Nueva autofactura
              </button>
            </div>
          </div>

          <div className="panel overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Comercializadora</th>
                  <th>Número</th>
                  <th className="text-right">Base</th>
                  <th className="text-right">IVA</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Comisiones calc.</th>
                  <th className="text-right">Diferencia</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-slate-500 py-8">
                      {lista.length === 0
                        ? "Aún no hay autofacturas registradas. Cuando una comercializadora te mande su liquidación del mes, dala de alta con «Nueva autofactura» y el programa la concilia con las comisiones calculadas."
                        : "Ninguna autofactura coincide con esos filtros."}
                    </td>
                  </tr>
                )}
                {filtrada.map((a) => (
                  <tr key={a._id}>
                    <td className="text-slate-300 text-sm whitespace-nowrap">{fmtPeriodo(a.periodo)}</td>
                    <td className="font-medium text-slate-200 whitespace-nowrap">{a.comercializadoraNombre ?? "—"}</td>
                    <td className="text-slate-300 text-sm whitespace-nowrap">{a.numero || "—"}</td>
                    <td className="text-right num text-slate-300 whitespace-nowrap">{fmtEuro(a.base)}</td>
                    <td className="text-right num text-slate-300 whitespace-nowrap">
                      {fmtEuro(a.iva)}
                      <p className="text-xs text-slate-500 num">{a.ivaPorcentaje}%</p>
                    </td>
                    <td className="text-right num text-slate-200 font-medium whitespace-nowrap">{fmtEuro(a.total)}</td>
                    <td className="text-right num text-slate-300 whitespace-nowrap">
                      {fmtEuro(a.comisionesPeriodo)}
                      {a.comisionesN > 0 && <p className="text-xs text-slate-500">{a.comisionesN} comisiones</p>}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {Math.abs(a.diferencia ?? 0) < 0.01 ? (
                        <span className="text-emerald-300 text-sm">Cuadra</span>
                      ) : (
                        <span className={`num font-medium ${(a.diferencia ?? 0) > 0 ? "text-amber-300" : "text-rose-300"}`}>
                          {a.diferencia > 0 ? "+" : ""}{fmtEuro(a.diferencia)}
                        </span>
                      )}
                    </td>
                    <td>
                      <Badge tono={ESTADOS[a.estado].tono}>{ESTADOS[a.estado].label}</Badge>
                      {a.fechaCobro && (
                        <p className="text-xs text-slate-500 mt-0.5 num whitespace-nowrap">
                          {new Date(a.fechaCobro).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {a.estado === "pendiente" ? (
                        <>
                          <button onClick={() => cobrar(a)} className="p-1.5 text-slate-400 hover:text-emerald-400" title="Marcar cobrada">
                            <IconCobros />
                          </button>
                          <button onClick={() => abrirEdicion(a)} className="p-1.5 text-slate-400 hover:text-sky-400" title="Editar">
                            <IconEditar />
                          </button>
                          <button onClick={() => borrar(a)} className="p-1.5 text-slate-400 hover:text-rose-400" title="Borrar">
                            <IconBorrar />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- Modal alta/edición --- */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <form
            className="panel max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <h2 className="text-lg font-bold text-white">{editando ? "Editar autofactura" : "Nueva autofactura"}</h2>

            <label className="text-sm text-slate-400 block">
              Comercializadora *
              <select value={form.comercializadoraId} onChange={poner("comercializadoraId")} className="input" required disabled={!!editando}>
                <option value="">— Elige —</option>
                {comercializadoras.map((c) => (
                  <option key={c._id} value={c._id}>{c.nombre}</option>
                ))}
              </select>
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm text-slate-400">
                Número
                <input value={form.numero} onChange={poner("numero")} className="input" placeholder="El del documento que te mandan" />
              </label>
              <label className="text-sm text-slate-400">
                Mes que liquida *
                <input type="month" value={form.periodo} onChange={poner("periodo")} className="input" required />
              </label>
              <label className="text-sm text-slate-400">
                Fecha del documento
                <input type="date" value={form.fecha} onChange={poner("fecha")} className="input" />
              </label>
              <label className="text-sm text-slate-400">
                IVA (%)
                <input type="number" step="0.01" min="0" value={form.ivaPorcentaje} onChange={poner("ivaPorcentaje")} className="input num" />
              </label>
            </div>

            <label className="text-sm text-slate-400 block">
              Base imponible (€) *
              <input type="number" step="0.01" min="0.01" value={form.base} onChange={poner("base")} className="input num" required />
              <span className="text-xs text-slate-500">Las comisiones liquidadas sin IVA; el IVA y el total se calculan solos.</span>
            </label>

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
