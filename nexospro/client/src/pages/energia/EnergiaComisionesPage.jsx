import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import { IconBorrar, IconCobros, IconPagos } from "../../components/icons.jsx";

const CONCEPTOS = {
  alta: { label: "Pago por alta", tono: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30" },
  mensual: { label: "Mensual", tono: "bg-sky-400/10 text-sky-300 border-sky-400/30" },
  anual: { label: "Anual", tono: "bg-violet-400/10 text-violet-300 border-violet-400/30" },
};
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

const VACIO = { suministroId: "", concepto: "mensual", periodo: periodoActual(), importe: "", notas: "" };

// Comisiones del canal: se generan por mes desde los suministros activos y
// las condiciones de cada comercializadora, y llevan circuito pendiente →
// cobrada. También admite altas manuales (bonos puntuales).
export default function EnergiaComisionesPage() {
  const [lista, setLista] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [suministros, setSuministros] = useState([]);
  const [comercializadoras, setComercializadoras] = useState([]);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState(periodoActual());
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroComercializadora, setFiltroComercializadora] = useState("todas");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [generando, setGenerando] = useState(false);

  const filtrada = (lista ?? []).filter((c) => {
    if (filtroPeriodo && c.periodo !== filtroPeriodo) return false;
    if (filtroEstado !== "todos" && c.estado !== filtroEstado) return false;
    if (filtroComercializadora !== "todas" && String(c.comercializadora) !== filtroComercializadora) return false;
    return coincideBusqueda(q, c.cups, c.clienteNombre ?? c.cliente?.nombre, c.comercializadoraNombre, c.notas);
  });

  const pendientePeriodo = filtrada.filter((c) => c.estado === "pendiente").reduce((a, c) => a + (c.importe ?? 0), 0);
  const cobradaPeriodo = filtrada.filter((c) => c.estado === "cobrada").reduce((a, c) => a + (c.importe ?? 0), 0);

  async function cargar() {
    try {
      const r = await fetch("/api/energia/comisiones");
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setLista(datos);
    } catch (e) {
      setError(e.message);
      setLista([]);
    }
  }

  function cargarResumen() {
    fetch("/api/energia/comisiones/resumen")
      .then((r) => (r.ok ? r.json() : null))
      .then(setResumen)
      .catch(() => setResumen(null));
  }

  useEffect(() => {
    cargar();
    cargarResumen();
    fetch("/api/energia/suministros")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSuministros(Array.isArray(d) ? d : []))
      .catch(() => setSuministros([]));
    fetch("/api/energia/comercializadoras")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setComercializadoras(Array.isArray(d) ? d : []))
      .catch(() => setComercializadoras([]));
  }, []);

  async function generar() {
    if (!filtroPeriodo) return;
    if (!window.confirm(`¿Generar las comisiones de ${fmtPeriodo(filtroPeriodo)}? Las que ya existan no se duplican.`)) return;
    setGenerando(true);
    try {
      const r = await fetch("/api/energia/comisiones/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo: filtroPeriodo }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudieron generar");
      cargar();
      cargarResumen();
      alert(`Comisiones de ${fmtPeriodo(datos.periodo)}: ${datos.creadas} nuevas, ${datos.existentes} ya existían.`);
    } catch (e) {
      alert(e.message);
    } finally {
      setGenerando(false);
    }
  }

  async function cobrar(c) {
    if (!window.confirm(`¿Marcar como cobrada la comisión de ${fmtEuro(c.importe)} del CUPS ${c.cups}?`)) return;
    const r = await fetch(`/api/energia/comisiones/${c._id}/cobrar`, { method: "POST" });
    if (r.ok) {
      cargar();
      cargarResumen();
    } else alert((await r.json()).error || "No se pudo marcar");
  }

  async function deshacer(c) {
    if (!window.confirm("¿Devolver esta comisión a pendiente?")) return;
    const r = await fetch(`/api/energia/comisiones/${c._id}/pendiente`, { method: "POST" });
    if (r.ok) {
      cargar();
      cargarResumen();
    } else alert((await r.json()).error || "No se pudo deshacer");
  }

  async function borrar(c) {
    if (!window.confirm(`¿Borrar la comisión de ${fmtEuro(c.importe)} del CUPS ${c.cups}?`)) return;
    const r = await fetch(`/api/energia/comisiones/${c._id}`, { method: "DELETE" });
    if (r.ok) {
      cargar();
      cargarResumen();
    } else alert((await r.json()).error || "No se pudo borrar");
  }

  async function guardar(e) {
    e.preventDefault();
    const r = await fetch("/api/energia/comisiones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suministro: form.suministroId,
        concepto: form.concepto,
        periodo: form.periodo,
        importe: Number(form.importe),
        notas: form.notas || undefined,
      }),
    });
    const datos = await r.json();
    if (r.ok) {
      setModal(false);
      cargar();
      cargarResumen();
    } else alert(datos.error || "Error al guardar");
  }

  const poner = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <CabeceraPagina
      titulo="Comisiones"
      descripcion="Lo que devenga tu cartera cada mes: pagos por alta, mensualidades por contrato activo y recurrentes anuales."
    >
      {error && <div className="panel px-4 py-3 text-sm text-rose-400 mb-3">{error}</div>}

      {lista === null ? (
        <div className="panel px-4 py-10 text-center text-slate-500">Cargando…</div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por CUPS, cliente, comercializadora…" />
            <input
              type="month"
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
              className="input w-auto"
              title="Mes de devengo"
            />
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="input w-auto">
              <option value="todos">Estado: todos</option>
              <option value="pendiente">Pendientes</option>
              <option value="cobrada">Cobradas</option>
            </select>
            <select value={filtroComercializadora} onChange={(e) => setFiltroComercializadora(e.target.value)} className="input w-auto">
              <option value="todas">Comercializadora: todas</option>
              {comercializadoras.map((c) => (
                <option key={c._id} value={c._id}>{c.nombre}</option>
              ))}
            </select>
            <div className="ms-auto flex flex-wrap items-center gap-2">
              <button onClick={() => { setForm({ ...VACIO, periodo: filtroPeriodo || periodoActual() }); setModal(true); }} className="btn-ghost whitespace-nowrap">
                Nueva manual
              </button>
              <button onClick={generar} disabled={generando} className="btn-primary whitespace-nowrap">
                {generando ? "Generando…" : "Generar mes"}
              </button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-300 whitespace-nowrap">
              Pendiente del mes: <b className="num">{fmtEuro(pendientePeriodo)}</b>
            </span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-300 whitespace-nowrap">
              Cobrado del mes: <b className="num">{fmtEuro(cobradaPeriodo)}</b>
            </span>
            {resumen && (
              <span className="rounded-full border border-slate-400/30 bg-slate-400/10 px-3 py-1 text-slate-300 whitespace-nowrap">
                Pendiente acumulado: <b className="num">{fmtEuro(resumen.pendiente.total)}</b>
                {resumen.pendiente.n > 0 && ` (${resumen.pendiente.n})`}
              </span>
            )}
          </div>

          <div className="panel overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Concepto</th>
                  <th>CUPS / Cliente</th>
                  <th>Comercializadora</th>
                  <th className="text-right">Importe</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-8">
                      {lista.length === 0
                        ? "Aún no hay comisiones. Pulsa «Generar mes» para calcular las del mes elegido según las condiciones de cada comercializadora."
                        : "Ninguna comisión coincide con esos filtros. Prueba a generar el mes con el botón «Generar mes»."}
                    </td>
                  </tr>
                )}
                {filtrada.map((c) => (
                  <tr key={c._id}>
                    <td className="text-slate-300 text-sm whitespace-nowrap">{fmtPeriodo(c.periodo)}</td>
                    <td><Badge tono={CONCEPTOS[c.concepto]?.tono}>{CONCEPTOS[c.concepto]?.label ?? c.concepto}</Badge></td>
                    <td>
                      <p className="num text-[0.8rem] text-slate-200 whitespace-nowrap">{c.cups}</p>
                      <p className="text-xs text-slate-500 whitespace-nowrap">
                        {c.clienteNombre ?? c.cliente?.nombre ?? "—"}
                        {c.cliente?.grupo ? ` · ${c.cliente.grupo}` : ""}
                      </p>
                    </td>
                    <td className="text-slate-300 text-sm whitespace-nowrap">{c.comercializadoraNombre ?? "—"}</td>
                    <td className="text-right num text-slate-200 whitespace-nowrap">{fmtEuro(c.importe)}</td>
                    <td>
                      <Badge tono={ESTADOS[c.estado].tono}>{ESTADOS[c.estado].label}</Badge>
                      {c.fechaCobro && (
                        <p className="text-xs text-slate-500 mt-0.5 num whitespace-nowrap">
                          {new Date(c.fechaCobro).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {c.estado === "pendiente" ? (
                        <>
                          <button onClick={() => cobrar(c)} className="p-1.5 text-slate-400 hover:text-emerald-400" title="Marcar cobrada">
                            <IconCobros />
                          </button>
                          <button onClick={() => borrar(c)} className="p-1.5 text-slate-400 hover:text-rose-400" title="Borrar">
                            <IconBorrar />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => deshacer(c)} className="p-1.5 text-slate-400 hover:text-amber-400" title="Devolver a pendiente">
                          <IconPagos />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- Modal alta manual --- */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <form
            className="panel max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <h2 className="text-lg font-bold text-white">Comisión manual</h2>
            <p className="text-xs text-slate-500">
              Para bonos puntuales o condiciones pactadas fuera de la ficha de la comercializadora.
            </p>

            <label className="text-sm text-slate-400 block">
              Suministro (CUPS) *
              <select value={form.suministroId} onChange={poner("suministroId")} className="input" required>
                <option value="">— Selecciona —</option>
                {suministros.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.cups} — {s.clienteNombre ?? s.cliente?.nombre ?? "sin cliente"}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm text-slate-400">
                Concepto *
                <select value={form.concepto} onChange={poner("concepto")} className="input">
                  <option value="alta">Pago por alta</option>
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </label>
              <label className="text-sm text-slate-400">
                Mes *
                <input type="month" value={form.periodo} onChange={poner("periodo")} className="input" required />
              </label>
              <label className="text-sm text-slate-400">
                Importe (€) *
                <input type="number" step="0.01" min="0.01" value={form.importe} onChange={poner("importe")} className="input" required />
              </label>
            </div>

            <label className="text-sm text-slate-400 block">
              Notas
              <textarea value={form.notas} onChange={poner("notas")} className="input" rows={2} placeholder="Bono campaña verano, pacto especial…" />
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
