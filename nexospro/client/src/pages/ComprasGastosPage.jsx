import { useEffect, useRef, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda, euros } from "../components/ui.jsx";
import { enterComoTab } from "../utils/enter-tab.js";

// Compras → Gastos (tickets). Gasto de bolsillo justificado con ticket:
// se hace la foto, la IA lee los datos y el gasto queda pendiente de revisar.
// La categoría marca cuánto IVA es deducible y se avisa cuando el ticket no
// lleva los datos fiscales de la empresa (entonces no se deduce nada).

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");
const aInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

const PAGOS = {
  efectivo: "Efectivo (caja)",
  tarjeta_empresa: "Tarjeta de la empresa",
  tarjeta_personal: "Lo pagó un trabajador",
  transferencia: "Transferencia",
  otro: "Otro",
};

export default function ComprasGastosPage() {
  const [lista, setLista] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [form, setForm] = useState(null); // { gasto? , avisos? }
  const ficheroRef = useRef(null);

  const nombreCategoria = (clave) => categorias.find((c) => c.clave === clave)?.etiqueta ?? clave;

  const filtrada = (lista ?? []).filter((g) =>
    coincideBusqueda(
      q,
      g.comercio,
      g.nifComercio,
      g.concepto,
      nombreCategoria(g.categoria),
      fecha(g.fecha),
      euros(g.total),
      g.total,
      PAGOS[g.pagadoCon],
      g.pagadoPor,
      g.notas,
      g.estado === "validado" ? "Validado" : "Pendiente de revisión"
    )
  );

  async function cargar() {
    try {
      const r = await fetch("/api/gastos");
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setLista(datos);
    } catch (e) {
      setError(e.message);
      setLista([]);
    }
  }

  useEffect(() => {
    fetch("/api/gastos/categorias")
      .then((r) => r.json())
      .then((d) => setCategorias(d.categorias ?? []))
      .catch(() => setCategorias([]));
    cargar();
  }, []);

  // Foto del ticket: en el móvil abre la cámara directamente.
  async function subirTicket(e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const cuerpo = new FormData();
      cuerpo.append("ticket", archivo);
      const r = await fetch("/api/gastos/ticket", { method: "POST", body: cuerpo });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo leer el ticket");
      await cargar();
      // Se abre para revisar: la IA propone, la persona confirma.
      setForm({ gasto: datos, avisos: datos.avisos ?? [] });
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function validar(g) {
    const r = await fetch(`/api/gastos/${g._id}/validar`, { method: "POST" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo validar");
  }

  async function borrar(g) {
    if (!window.confirm(`¿Borrar el gasto de ${g.comercio} por ${euros(g.total)}?`)) return;
    const r = await fetch(`/api/gastos/${g._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  const totalPeriodo = filtrada.reduce((s, g) => s + (g.total ?? 0), 0);
  const ivaDeducible = filtrada.reduce((s, g) => s + (g.ivaDeducibleImporte ?? 0), 0);

  return (
    <>
      <CabeceraPagina
        titulo="Gastos (tickets)"
        descripcion="Gastos de bolsillo justificados con ticket: haz la foto y la IA rellena los datos."
      >
        <input
          ref={ficheroRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          onChange={subirTicket}
          className="hidden"
        />
        <button
          onClick={() => ficheroRef.current?.click()}
          disabled={subiendo}
          className="btn-ghost mr-2"
        >
          {subiendo ? "Leyendo el ticket…" : "Foto del ticket"}
        </button>
        <button onClick={() => setForm({ gasto: null })} className="btn-primary">
          Nuevo gasto
        </button>
      </CabeceraPagina>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {lista?.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <InputBusqueda value={q} onChange={setQ} />
          <p className="text-sm text-slate-500">
            {filtrada.length} gasto(s) · <span className="text-slate-300 font-semibold">{euros(totalPeriodo)}</span> ·
            IVA deducible <span className="text-slate-300 font-semibold">{euros(ivaDeducible)}</span>
          </p>
        </div>
      )}

      <div className="panel px-3.5 py-2">
        {!lista ? null : lista.length === 0 ? (
          <EstadoVacio
            titulo="Sin gastos registrados"
            descripcion="Haz la foto del primer ticket: la IA lee comercio, fecha e importes y tú solo confirmas."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Comercio</th>
                  <th>Categoría</th>
                  <th>Pagado con</th>
                  <th className="text-right">Base</th>
                  <th className="text-right">IVA</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">IVA deducible</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((g) => (
                  <tr key={g._id}>
                    <td className="text-slate-400 whitespace-nowrap num">{fecha(g.fecha)}</td>
                    <td className="text-slate-300 max-w-[200px]">
                      <span className="block truncate font-semibold text-white" title={g.comercio}>
                        {g.comercio}
                      </span>
                      {g.concepto && (
                        <span className="block truncate text-[0.75rem] text-slate-500" title={g.concepto}>
                          {g.concepto}
                        </span>
                      )}
                    </td>
                    <td className="text-slate-300 whitespace-nowrap">{nombreCategoria(g.categoria)}</td>
                    <td className="text-slate-400 whitespace-nowrap">
                      {PAGOS[g.pagadoCon] ?? g.pagadoCon}
                      {g.pagadoCon === "tarjeta_personal" && (
                        <Badge tono={g.reembolsado ? "green" : "amber"}>
                          {g.reembolsado ? "reembolsado" : "por reembolsar"}
                        </Badge>
                      )}
                    </td>
                    <td className="text-right text-slate-400 whitespace-nowrap num">{euros(g.base)}</td>
                    <td className="text-right text-slate-400 whitespace-nowrap num">{euros(g.cuotaIva)}</td>
                    <td className="text-right text-slate-300 font-semibold whitespace-nowrap num">{euros(g.total)}</td>
                    <td className="text-right whitespace-nowrap num">
                      {g.conDatosFiscales ? (
                        <span className="text-slate-300">{euros(g.ivaDeducibleImporte)}</span>
                      ) : (
                        <span className="text-amber-400" title="El ticket no lleva tus datos fiscales: el IVA no es deducible">
                          0,00 €
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <Badge tono={g.estado === "validado" ? "green" : "amber"}>
                        {g.estado === "validado" ? "Validado" : "Por revisar"}
                      </Badge>
                      {g.origen === "ocr" && <Badge tono="sky">IA</Badge>}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {g.ficheroUrl && (
                        <a
                          href={g.ficheroUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-400 hover:text-accent hover:underline mr-3"
                        >
                          Ver ticket
                        </a>
                      )}
                      <button onClick={() => setForm({ gasto: g })} className="text-xs text-accent hover:underline mr-3">
                        Editar
                      </button>
                      {g.estado !== "validado" && (
                        <button onClick={() => validar(g)} className="text-xs text-emerald-400 hover:underline mr-3">
                          Validar
                        </button>
                      )}
                      <button onClick={() => borrar(g)} className="text-xs text-rose-400 hover:underline">
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-slate-500 py-8">
                      Sin resultados para «{q}».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <FormGasto
          gasto={form.gasto}
          avisos={form.avisos}
          categorias={categorias}
          onGuardado={() => {
            setForm(null);
            cargar();
          }}
          onCerrar={() => setForm(null)}
        />
      )}
    </>
  );
}

// Alta y revisión de un gasto. Mismo patrón de ventana que el resto del
// programa: etiqueta encima del campo, secciones y Cancelar + Guardar.
function FormGasto({ gasto, avisos = [], categorias, onGuardado, onCerrar }) {
  const [datos, setDatos] = useState({
    comercio: gasto?.comercio ?? "",
    nifComercio: gasto?.nifComercio ?? "",
    fecha: aInput(gasto?.fecha),
    concepto: gasto?.concepto ?? "",
    categoria: gasto?.categoria ?? "otros",
    total: gasto?.total ?? "",
    tipoIva: gasto?.tipoIva ?? 21,
    conDatosFiscales: gasto?.conDatosFiscales ?? false,
    ivaDeduciblePct: gasto?.ivaDeduciblePct ?? 100,
    pagadoCon: gasto?.pagadoCon ?? "tarjeta_empresa",
    pagadoPor: gasto?.pagadoPor ?? "",
    reembolsado: gasto?.reembolsado ?? false,
    notas: gasto?.notas ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const cambiar = (campo) => (e) => {
    const valor = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setDatos((d) => ({ ...d, [campo]: valor }));
  };

  // Al cambiar la categoría se propone su porcentaje deducible por ley.
  function elegirCategoria(e) {
    const clave = e.target.value;
    const pct = categorias.find((c) => c.clave === clave)?.deducible ?? 100;
    setDatos((d) => ({ ...d, categoria: clave, ivaDeduciblePct: pct }));
  }

  const notaCategoria = categorias.find((c) => c.clave === datos.categoria)?.nota;
  const total = Number(datos.total) || 0;
  const tipo = Number(datos.tipoIva) || 0;
  const base = total / (1 + tipo / 100);
  const cuota = total - base;
  const deducible = datos.conDatosFiscales ? (cuota * (Number(datos.ivaDeduciblePct) || 0)) / 100 : 0;

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(gasto ? `/api/gastos/${gasto._id}` : "/api/gastos", {
        method: gasto ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...datos,
          total: Number(datos.total) || 0,
          tipoIva: Number(datos.tipoIva) || 0,
          ivaDeduciblePct: Number(datos.ivaDeduciblePct) || 0,
          base: undefined,
          cuotaIva: undefined,
        }),
      });
      const respuesta = await r.json();
      if (!r.ok) throw new Error(respuesta.error || "Error al guardar");
      onGuardado();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-1">{gasto ? "Revisar gasto" : "Nuevo gasto"}</h2>
        <p className="text-sm text-slate-400 mb-4">
          Un ticket es una factura simplificada: sin tus datos fiscales impresos, su IVA no se puede deducir.
        </p>

        {avisos.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 space-y-1">
            {avisos.map((a, i) => (
              <p key={i}>{a}</p>
            ))}
          </div>
        )}

        <form onSubmit={guardar} onKeyDown={enterComoTab} className="space-y-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Datos del ticket</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="text-sm text-slate-400 block mb-1">Comercio *</label>
              <input value={datos.comercio} onChange={cambiar("comercio")} className="input w-full" autoFocus />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">NIF del comercio</label>
              <input value={datos.nifComercio} onChange={cambiar("nifComercio")} className="input w-full" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Fecha</label>
              <input type="date" value={datos.fecha} onChange={cambiar("fecha")} className="input w-full" />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-slate-400 block mb-1">Concepto</label>
              <input value={datos.concepto} onChange={cambiar("concepto")} className="input w-full" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Categoría</label>
              <select value={datos.categoria} onChange={elegirCategoria} className="input w-full">
                {categorias.map((c) => (
                  <option key={c.clave} value={c.clave}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {notaCategoria && <p className="text-xs text-slate-500">{notaCategoria}</p>}

          <p className="text-xs uppercase tracking-wider text-slate-500">Importe e IVA</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Total pagado *</label>
              <input
                type="number"
                step="0.01"
                value={datos.total}
                onChange={cambiar("total")}
                className="input w-full text-right"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Tipo de IVA</label>
              <select value={datos.tipoIva} onChange={cambiar("tipoIva")} className="input w-full">
                <option value={21}>21 %</option>
                <option value={10}>10 %</option>
                <option value={4}>4 %</option>
                <option value={0}>Sin IVA</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">IVA deducible</label>
              <select value={datos.ivaDeduciblePct} onChange={cambiar("ivaDeduciblePct")} className="input w-full">
                <option value={100}>100 %</option>
                <option value={50}>50 %</option>
                <option value={0}>No deducible</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={datos.conDatosFiscales}
                  onChange={cambiar("conDatosFiscales")}
                  className="w-4 h-4"
                />
                Lleva mis datos fiscales
              </label>
            </div>
          </div>
          <p className="text-sm text-slate-400">
            Base <span className="text-slate-200 font-semibold">{euros(base)}</span> · IVA{" "}
            <span className="text-slate-200 font-semibold">{euros(cuota)}</span> · deducible{" "}
            <span className={deducible > 0 ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
              {euros(deducible)}
            </span>
          </p>

          <p className="text-xs uppercase tracking-wider text-slate-500">Pago</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Pagado con</label>
              <select value={datos.pagadoCon} onChange={cambiar("pagadoCon")} className="input w-full">
                {Object.entries(PAGOS).map(([clave, etiqueta]) => (
                  <option key={clave} value={clave}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </div>
            {datos.pagadoCon === "tarjeta_personal" && (
              <>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Quién lo pagó</label>
                  <input value={datos.pagadoPor} onChange={cambiar("pagadoPor")} className="input w-full" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={datos.reembolsado}
                      onChange={cambiar("reembolsado")}
                      className="w-4 h-4"
                    />
                    Ya se le ha devuelto
                  </label>
                </div>
              </>
            )}
            <div className="col-span-2 md:col-span-3">
              <label className="text-sm text-slate-400 block mb-1">Notas</label>
              <input value={datos.notas} onChange={cambiar("notas")} className="input w-full" />
            </div>
          </div>

          {gasto?.ficheroUrl && (
            <a
              href={gasto.ficheroUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm text-accent hover:underline"
            >
              Ver la foto del ticket
            </a>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCerrar} className="btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={guardando || !datos.comercio} className="btn-primary">
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
