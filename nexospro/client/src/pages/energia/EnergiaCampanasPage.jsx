import { useEffect, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { EstadoVacio, InputBusqueda, coincideBusqueda } from "../../components/ui.jsx";
import { IconEditar, IconBorrar, IconOjo, IconAnular } from "../../components/icons.jsx";

// Campañas de precios de las comercializadoras. El PDF que manda la
// comercializadora se sube y la IA extrae los términos; la campaña queda
// "pendiente" hasta que alguien la revisa y la publica. Las publicadas se
// ofrecen directamente en los estudios de ahorro.

const ESTADOS = {
  pendiente: { label: "Pendiente de revisión", tono: "bg-amber-400/10 text-amber-300 border-amber-400/30" },
  publicada: { label: "Publicada", tono: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30" },
  descartada: { label: "Descartada", tono: "bg-slate-400/10 text-slate-400 border-slate-400/30" },
};

const VACIO = {
  comercializadoraId: "", tipo: "luz", nombre: "", tarifa: "",
  vigenciaDesde: "", vigenciaHasta: "",
  precioEnergia: "", precioEnergiaPunta: "", precioEnergiaLlano: "", precioEnergiaValle: "",
  unidadPotencia: "ano", precioPotenciaPunta: "", precioPotenciaValle: "",
  mantenimiento: "", descuento: "", notas: "",
  publicar: true,
};

const num4 = (n) =>
  Number(n ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const num2 = (n) =>
  Number(n ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fmtFecha = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "");

function Badge({ tono, children }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tono}`}>
      {children}
    </span>
  );
}

export default function EnergiaCampanasPage() {
  const [lista, setLista] = useState(null);
  const [comercializadoras, setComercializadoras] = useState([]);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  // OCR de la campaña
  const [ocrFichero, setOcrFichero] = useState(null);
  const [ocrLeyendo, setOcrLeyendo] = useState(false);
  const [ocrAvisos, setOcrAvisos] = useState([]);
  const [ocrResumen, setOcrResumen] = useState(null);
  const [ocrDetalle, setOcrDetalle] = useState(null);

  const filtrada = (lista ?? []).filter((c) =>
    coincideBusqueda(
      q,
      c.nombre, c.tarifa, c.comercializadoraNombre ?? c.comercializadora?.nombre, c.descuento, c.notas
    )
  );
  const pendientes = (lista ?? []).filter((c) => c.estado === "pendiente").length;
  const publicadas = (lista ?? []).filter((c) => c.estado === "publicada").length;

  async function cargar() {
    try {
      const r = await fetch("/api/energia/campanas");
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

  function abrirNueva() {
    setEditando(null);
    setForm(VACIO);
    setOcrFichero(null);
    setOcrAvisos([]);
    setOcrResumen(null);
    setOcrDetalle(null);
    setModal(true);
  }

  function abrirEdicion(c) {
    setEditando(c);
    setOcrFichero(null);
    setOcrAvisos([]);
    setOcrResumen(null);
    setOcrDetalle(null);
    setForm({
      comercializadoraId: c.comercializadora ?? "",
      tipo: c.tipo ?? "luz",
      nombre: c.nombre ?? "",
      tarifa: c.tarifa ?? "",
      vigenciaDesde: c.vigenciaDesde ? c.vigenciaDesde.slice(0, 10) : "",
      vigenciaHasta: c.vigenciaHasta ? c.vigenciaHasta.slice(0, 10) : "",
      precioEnergia: c.precioEnergia || "",
      precioEnergiaPunta: c.precioEnergiaPunta || "",
      precioEnergiaLlano: c.precioEnergiaLlano || "",
      precioEnergiaValle: c.precioEnergiaValle || "",
      unidadPotencia: "ano",
      precioPotenciaPunta: c.precioPotenciaPunta || "",
      precioPotenciaValle: c.precioPotenciaValle || "",
      mantenimiento: c.mantenimiento || "",
      descuento: c.descuento ?? "",
      notas: c.notas ?? "",
      publicar: c.estado === "publicada",
    });
    setModal(true);
  }

  // Lee el PDF de la campaña con IA y precarga el formulario. Nada se
  // guarda: el usuario revisa y decide.
  async function leerCampana(ev) {
    ev.preventDefault();
    if (!ocrFichero) return;
    setOcrLeyendo(true);
    setOcrAvisos([]);
    setOcrResumen(null);
    setOcrDetalle(null);
    try {
      const fd = new FormData();
      fd.append("documento", ocrFichero);
      const r = await fetch("/api/energia/campanas/ocr", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo leer la campaña");
      const p = d.prefill;
      setForm((f) => ({
        ...f,
        comercializadoraId: p.comercializadora ?? f.comercializadoraId,
        tipo: p.tipo ?? f.tipo,
        nombre: p.nombre ?? f.nombre,
        tarifa: p.tarifa ?? f.tarifa,
        vigenciaDesde: p.vigenciaDesde ? p.vigenciaDesde.slice(0, 10) : f.vigenciaDesde,
        vigenciaHasta: p.vigenciaHasta ? p.vigenciaHasta.slice(0, 10) : f.vigenciaHasta,
        precioEnergia: p.precioEnergia ?? f.precioEnergia,
        precioEnergiaPunta: p.precioEnergiaPunta ?? f.precioEnergiaPunta,
        precioEnergiaLlano: p.precioEnergiaLlano ?? f.precioEnergiaLlano,
        precioEnergiaValle: p.precioEnergiaValle ?? f.precioEnergiaValle,
        precioPotenciaPunta: p.precioPotenciaPunta ?? f.precioPotenciaPunta,
        precioPotenciaValle: p.precioPotenciaValle ?? f.precioPotenciaValle,
        mantenimiento: p.mantenimiento ?? f.mantenimiento,
        descuento: p.descuento ?? f.descuento,
        publicar: false, // lo leído por IA siempre nace pendiente de revisión
      }));
      setOcrAvisos(d.avisos ?? []);
      setOcrDetalle(d.detalle ?? null);
      setOcrResumen(
        `Campaña leída: ${p.comercializadoraNombre ?? "comercializadora ilegible"}${p.nombre ? ` · ${p.nombre}` : ""}` +
          (p.precioEnergia ? ` — energía ${num4(p.precioEnergia)} €/kWh` : "")
      );
    } catch (err) {
      setOcrAvisos([err.message]);
    } finally {
      setOcrLeyendo(false);
    }
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      // Si la potencia se teclea en €/kW·día, se convierte a €/kW·año
      // (la unidad con la que trabajan los estudios).
      const factor = form.unidadPotencia === "dia" ? 365 : 1;
      const convertir = (v) => {
        const n = Number(String(v).replace(",", ".")) || 0;
        return n > 0 ? Math.round(n * factor * 100) / 100 : 0;
      };
      const cuerpo = {
        comercializadora: form.comercializadoraId || null,
        tipo: form.tipo,
        nombre: form.nombre,
        tarifa: form.tarifa,
        vigenciaDesde: form.vigenciaDesde || null,
        vigenciaHasta: form.vigenciaHasta || null,
        precioEnergia: Number(String(form.precioEnergia).replace(",", ".")) || 0,
        precioEnergiaPunta: Number(String(form.precioEnergiaPunta).replace(",", ".")) || 0,
        precioEnergiaLlano: Number(String(form.precioEnergiaLlano).replace(",", ".")) || 0,
        precioEnergiaValle: Number(String(form.precioEnergiaValle).replace(",", ".")) || 0,
        precioPotenciaPunta: convertir(form.precioPotenciaPunta),
        precioPotenciaValle: convertir(form.precioPotenciaValle),
        mantenimiento: Number(String(form.mantenimiento).replace(",", ".")) || 0,
        descuento: form.descuento,
        notas: form.notas,
        ...(editando
          ? {}
          : {
              origen: ocrResumen ? "ocr" : "manual",
              estado: form.publicar && !ocrResumen ? "publicada" : "pendiente",
            }),
      };
      const r = await fetch(`/api/energia/campanas${editando ? `/${editando._id}` : ""}`, {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al guardar");
      setModal(false);
      cargar();
    } catch (err) {
      alert(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(c, estado) {
    const textos = {
      publicada: "¿Publicar esta campaña? Estará disponible en los estudios de ahorro.",
      descartada: "¿Descartar esta campaña? Dejará de ofrecerse en los estudios.",
      pendiente: "¿Volver a dejarla pendiente de revisión?",
    };
    if (!window.confirm(textos[estado])) return;
    const r = await fetch(`/api/energia/campanas/${c._id}/estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo cambiar el estado");
  }

  async function borrar(c) {
    if (!window.confirm(`¿Borrar la campaña ${c.nombre || c.comercializadoraNombre || ""}?`)) return;
    const r = await fetch(`/api/energia/campanas/${c._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  const poner = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const esLuz = form.tipo === "luz";

  return (
    <CabeceraPagina titulo="Campañas de precios">
      {error && <div className="panel px-4 py-3 text-sm text-rose-400 mb-3">{error}</div>}

      {lista === null ? (
        <div className="panel px-4 py-10 text-center text-slate-500">Cargando…</div>
      ) : lista.length === 0 ? (
        <>
          <EstadoVacio
            titulo="Sin campañas de precios"
            descripcion="Sube el PDF con la campaña de precios que te mande la comercializadora: la IA lee los términos (energía, potencia, descuentos y vigencia), la revisas y la publicas. Después saldrá sola en los estudios de ahorro."
          />
          <div className="mt-3 flex justify-center">
            <button onClick={abrirNueva} className="btn-primary">Nueva campaña</button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por campaña, comercializadora, tarifa…" />
            {pendientes > 0 && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-300 text-sm whitespace-nowrap">
                {pendientes} pendiente{pendientes !== 1 ? "s" : ""} de revisión
              </span>
            )}
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-300 text-sm whitespace-nowrap">
              {publicadas} publicada{publicadas !== 1 ? "s" : ""}
            </span>
            <button onClick={abrirNueva} className="btn-primary ms-auto whitespace-nowrap">Nueva campaña</button>
          </div>

          <div className="panel overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Campaña</th>
                  <th>Comercializadora</th>
                  <th>Vigencia</th>
                  <th className="text-right">Energía</th>
                  <th className="text-right">Potencia</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-6">
                      Ninguna campaña coincide con la búsqueda.
                    </td>
                  </tr>
                )}
                {filtrada.map((c) => (
                  <tr key={c._id} className={c.estado === "descartada" ? "opacity-50" : ""}>
                    <td>
                      <p className="font-medium text-slate-200 whitespace-nowrap">{c.nombre || "Sin nombre"}</p>
                      <p className="num text-xs text-slate-500 whitespace-nowrap">
                        {c.tipo === "luz" ? "Luz" : "Gas"}{c.tarifa ? ` · ${c.tarifa}` : ""}
                        {c.origen === "ocr" ? " · leída con IA" : ""}
                      </p>
                      {c.descuento && <p className="text-xs text-amber-300/90">{c.descuento}</p>}
                    </td>
                    <td className="text-slate-300 whitespace-nowrap">
                      {c.comercializadoraNombre ?? c.comercializadora?.nombre ?? "—"}
                    </td>
                    <td className="num text-slate-300 text-sm whitespace-nowrap">
                      {c.vigenciaDesde || c.vigenciaHasta ? (
                        <>
                          {fmtFecha(c.vigenciaDesde) || "—"}
                          <p className="text-xs text-slate-500">hasta {fmtFecha(c.vigenciaHasta) || "sin límite"}</p>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-right num text-slate-300 whitespace-nowrap">
                      {c.precioEnergia > 0 ? (
                        <>
                          <p>{num4(c.precioEnergia)} €/kWh</p>
                          {(c.precioEnergiaPunta > 0 || c.precioEnergiaValle > 0) && (
                            <p className="text-xs text-slate-500">
                              P {num4(c.precioEnergiaPunta)}
                              {c.precioEnergiaLlano > 0 ? ` · L ${num4(c.precioEnergiaLlano)}` : ""}
                              {c.precioEnergiaValle > 0 ? ` · V ${num4(c.precioEnergiaValle)}` : ""}
                            </p>
                          )}
                        </>
                      ) : "—"}
                    </td>
                    <td className="text-right num text-slate-300 text-sm whitespace-nowrap">
                      {c.tipo === "luz" && c.precioPotenciaPunta > 0 ? (
                        <>
                          <p>{num2(c.precioPotenciaPunta)} €/kW·año</p>
                          {c.precioPotenciaValle > 0 && c.precioPotenciaValle !== c.precioPotenciaPunta && (
                            <p className="text-xs text-slate-500">valle {num2(c.precioPotenciaValle)}</p>
                          )}
                        </>
                      ) : c.mantenimiento > 0 ? (
                        <span className="text-xs text-slate-500">{num2(c.mantenimiento)} €/mes</span>
                      ) : "—"}
                    </td>
                    <td><Badge tono={ESTADOS[c.estado].tono}>{ESTADOS[c.estado].label}</Badge></td>
                    <td className="text-right whitespace-nowrap">
                      {c.estado === "pendiente" && (
                        <button
                          onClick={() => cambiarEstado(c, "publicada")}
                          className="p-1.5 text-slate-400 hover:text-emerald-400"
                          title="Revisada: publicar para los estudios"
                        >
                          <IconOjo />
                        </button>
                      )}
                      {c.estado === "publicada" && (
                        <button
                          onClick={() => cambiarEstado(c, "descartada")}
                          className="p-1.5 text-slate-400 hover:text-rose-400"
                          title="Descartar (retirar de los estudios)"
                        >
                          <IconAnular />
                        </button>
                      )}
                      {c.estado === "descartada" && (
                        <button
                          onClick={() => cambiarEstado(c, "publicada")}
                          className="p-1.5 text-slate-400 hover:text-emerald-400"
                          title="Volver a publicar"
                        >
                          <IconOjo />
                        </button>
                      )}
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

      {/* --- Modal crear/editar campaña --- */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <form
            className="panel max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <h2 className="text-lg font-bold text-white">
              {editando ? "Editar campaña" : "Nueva campaña de precios"}
            </h2>

            {!editando && (
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                <p className="text-sm font-semibold text-sky-300">¿Te han mandado la campaña por correo?</p>
                <p className="text-xs text-slate-500 mb-2">
                  Sube el PDF (o una captura) y lo leo con IA: relleno la comercializadora, los términos de
                  energía y potencia, los descuentos y la vigencia. Tú revisas los números y publicas.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    onChange={(e) => setOcrFichero(e.target.files?.[0] ?? null)}
                    className="text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-xs file:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={leerCampana}
                    disabled={!ocrFichero || ocrLeyendo}
                    className="btn-primary text-xs whitespace-nowrap disabled:opacity-50"
                  >
                    {ocrLeyendo ? "Leyendo campaña…" : "Leer campaña (IA)"}
                  </button>
                </div>
                {ocrResumen && <p className="mt-2 text-xs text-emerald-300">{ocrResumen}</p>}
                {ocrDetalle && ocrDetalle.unidadLeida === "€/kW·día" && (ocrDetalle.potenciaPuntaLeida > 0 || ocrDetalle.potenciaValleLeida > 0) && (
                  <p className="mt-1 text-xs text-slate-500">
                    Potencia leída en €/kW·día y convertida a €/kW·año
                    {ocrDetalle.potenciaPuntaLeida > 0 ? ` (punta ${num4(ocrDetalle.potenciaPuntaLeida)} €/kW·día × 365)` : ""}.
                  </p>
                )}
                {ocrAvisos.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-xs text-amber-300 space-y-0.5">
                    {ocrAvisos.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
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
                Tipo
                <select value={form.tipo} onChange={poner("tipo")} className="input">
                  <option value="luz">Luz</option>
                  <option value="gas">Gas</option>
                </select>
              </label>
              <label className="text-sm text-slate-400">
                Nombre de la campaña
                <input value={form.nombre} onChange={poner("nombre")} className="input" placeholder="Tarifa estable otoño…" />
              </label>
              <label className="text-sm text-slate-400">
                Tarifa de acceso
                <input value={form.tarifa} onChange={poner("tarifa")} className="input" placeholder={esLuz ? "2.0TD…" : "3.1…"} />
              </label>
              <label className="text-sm text-slate-400">
                Vigente desde
                <input type="date" value={form.vigenciaDesde} onChange={poner("vigenciaDesde")} className="input" />
              </label>
              <label className="text-sm text-slate-400">
                Vigente hasta
                <input type="date" value={form.vigenciaHasta} onChange={poner("vigenciaHasta")} className="input" />
              </label>
            </div>

            <div className="rounded-xl border border-slate-600/40 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-300">Términos de la campaña</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm text-slate-400">
                  Precio energía (€/kWh) <span className="text-xs text-slate-500">— el que se usa en los estudios</span>
                  <input value={form.precioEnergia} onChange={poner("precioEnergia")} className="input num" inputMode="decimal" placeholder="0,1432" />
                </label>
                <label className="text-sm text-slate-400">
                  Mantenimiento (€/mes)
                  <input value={form.mantenimiento} onChange={poner("mantenimiento")} className="input num" inputMode="decimal" placeholder="0,00" />
                </label>
              </div>
              {esLuz && (
                <>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <label className="text-sm text-slate-400">
                      Energía punta (€/kWh)
                      <input value={form.precioEnergiaPunta} onChange={poner("precioEnergiaPunta")} className="input num" inputMode="decimal" />
                    </label>
                    <label className="text-sm text-slate-400">
                      Energía llano (€/kWh)
                      <input value={form.precioEnergiaLlano} onChange={poner("precioEnergiaLlano")} className="input num" inputMode="decimal" />
                    </label>
                    <label className="text-sm text-slate-400">
                      Energía valle (€/kWh)
                      <input value={form.precioEnergiaValle} onChange={poner("precioEnergiaValle")} className="input num" inputMode="decimal" />
                    </label>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs uppercase tracking-wider text-slate-500">Término de potencia</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Unidad del documento:</span>
                        <select value={form.unidadPotencia} onChange={poner("unidadPotencia")} className="input py-1 px-2 text-xs w-auto">
                          <option value="ano">€/kW·año</option>
                          <option value="dia">€/kW·día</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="text-sm text-slate-400">
                        Potencia punta
                        <input value={form.precioPotenciaPunta} onChange={poner("precioPotenciaPunta")} className="input num" inputMode="decimal" />
                      </label>
                      <label className="text-sm text-slate-400">
                        Potencia valle
                        <input value={form.precioPotenciaValle} onChange={poner("precioPotenciaValle")} className="input num" inputMode="decimal" />
                      </label>
                    </div>
                    {form.unidadPotencia === "dia" && (
                      <p className="mt-1 text-xs text-slate-500">
                        Se guardará convertido a €/kW·año (× 365), que es lo que usan los estudios.
                      </p>
                    )}
                  </div>
                </>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm text-slate-400">
                  Descuentos y promociones
                  <input value={form.descuento} onChange={poner("descuento")} className="input" placeholder="15 % en energía 12 meses…" />
                </label>
                <label className="text-sm text-slate-400">
                  Notas
                  <input value={form.notas} onChange={poner("notas")} className="input" placeholder="Permanencia, condiciones…" />
                </label>
              </div>
            </div>

            {!editando && (
              <label className="flex items-start gap-2 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={form.publicar}
                  onChange={(e) => setForm((f) => ({ ...f, publicar: e.target.checked }))}
                  className="mt-1"
                  disabled={!!ocrResumen}
                />
                <span>
                  Publicar al guardar (disponible en los estudios)
                  {ocrResumen && (
                    <span className="block text-xs text-amber-300">
                      Lo leído con IA se guarda siempre como pendiente: revisa los números y publícala después.
                    </span>
                  )}
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary disabled:opacity-50">
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </CabeceraPagina>
  );
}
