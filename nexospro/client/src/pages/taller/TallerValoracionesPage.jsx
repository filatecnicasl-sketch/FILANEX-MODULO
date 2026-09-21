import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import BuscadorEntidad from "../../components/BuscadorEntidad.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda, euros } from "../../components/ui.jsx";
import { ESTADOS_VALORACION, tonoEstadoValoracion, nombreEstadoValoracion, aFechaInput } from "./datos.js";
import { IconImprimir } from "../../components/icons.jsx";
import { imprimirValoracion } from "../../utils/imprimir.js";

const campo = "input w-full";
const lineaVacia = () => ({ descripcion: "", tipo: "otro", horas: "", importe: 0 });
const VACIO = {
  matricula: "",
  marca: "",
  modelo: "",
  bastidor: "",
  clienteNombre: "",
  telefono: "",
  aseguradora: "",
  numeroSiniestro: "",
  fechaSiniestro: "",
  compromiso: false,
  observaciones: "",
};

const TIPOS_PARTIDA = [
  ["chapa", "Chapa"],
  ["pintura", "Pintura"],
  ["mecanica", "Mecánica"],
  ["material", "Material"],
  ["otro", "Otro"],
];

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

// Desplegable de estado con aspecto de pill coloreada (referencia).
const CLASES_PILL_ESTADO = {
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  cyan: "bg-sky-100 text-sky-700 border-sky-200",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
  red: "bg-rose-100 text-rose-700 border-rose-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};
const ESTILO_FLECHA = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundPosition: "right 9px center",
};

export default function TallerValoracionesPage() {
  const [lista, setLista] = useState(null);
  const [aseguradoras, setAseguradoras] = useState([]);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [lineas, setLineas] = useState([lineaVacia()]);
  const [importando, setImportando] = useState(false);
  const [importandoAlta, setImportandoAlta] = useState(false);
  const [avisoAlta, setAvisoAlta] = useState(false);
  const [preciosHora, setPreciosHora] = useState({ chapa: 0, pintura: 0, mecanica: 0 });
  const [vehiculos, setVehiculos] = useState([]);
  const inputPdfRef = useRef(null);
  const inputAltaPdfRef = useRef(null);
  const [q, setQ] = useState("");
  const [params, setParams] = useSearchParams();

  // Abre directamente una valoración cuando llega ?abrir=<id> (p. ej. desde el historial del vehículo).
  useEffect(() => {
    const id = params.get("abrir");
    if (!id || !lista) return;
    const v = lista.find((x) => x._id === id);
    if (v) {
      abrirEdicion(v);
      params.delete("abrir");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, params, setParams]);

  // Filtra por todos los campos visibles de la tabla.
  const filtrada = (lista ?? []).filter((v) =>
    coincideBusqueda(
      q,
      v.numero,
      v.matricula,
      v.clienteNombre,
      v.compania,
      v.numeroSiniestro,
      nombreEstadoValoracion(v.estado),
      v.numeroOrden,
      v.total != null ? euros(v.total) : null
    )
  );

  async function cargar() {
    try {
      const r = await fetch("/api/taller/valoraciones");
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
    fetch("/api/taller/aseguradoras")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAseguradoras)
      .catch(() => setAseguradoras([]));
    fetch("/api/empresa")
      .then((r) => (r.ok ? r.json() : null))
      .then((e) => {
        if (e?.taller) {
          setPreciosHora({
            chapa: Number(e.taller.precioHoraChapa) || 0,
            pintura: Number(e.taller.precioHoraPintura) || 0,
            mecanica: Number(e.taller.precioHoraMecanica) || 0,
          });
        }
      })
      .catch(() => {});
    fetch("/api/taller/vehiculos")
      .then((r) => (r.ok ? r.json() : []))
      .then(setVehiculos)
      .catch(() => setVehiculos([]));
  }, []);

  // Al salir del campo matrícula: si el vehículo ya está dado de alta, se
  // rellenan marca, modelo y bastidor solos (se pueden corregir a mano).
  function rellenarDesdeVehiculo() {
    const mat = (form.matricula ?? "").replace(/[\s-]/g, "").toUpperCase();
    if (!mat) return;
    const v = vehiculos.find((x) => x.matricula === mat);
    if (!v) return;
    setForm((f) => ({
      ...f,
      marca: v.marca ?? f.marca,
      modelo: v.modelo ?? f.modelo,
      bastidor: v.bastidor ?? f.bastidor,
    }));
  }

  // Precio por hora según el tipo de partida (Ajustes → Configuración).
  function precioPorTipo(tipo) {
    if (tipo === "chapa") return preciosHora.chapa;
    if (tipo === "pintura") return preciosHora.pintura;
    if (tipo === "mecanica") return preciosHora.mecanica;
    return 0;
  }

  // Cambia un campo de una partida; si hay horas y precio configurado para el
  // tipo, el importe se calcula solo (horas × precio). Siempre editable.
  function actualizarLinea(i, cambios) {
    setLineas((ls) =>
      ls.map((x, j) => {
        if (j !== i) return x;
        const l = { ...x, ...cambios };
        const precio = precioPorTipo(l.tipo);
        const horas = Number(l.horas);
        if (precio > 0 && horas > 0) {
          l.importe = Math.round(horas * precio * 100) / 100;
        }
        return l;
      })
    );
  }

  function abrirNueva() {
    setEditando(null);
    setForm(VACIO);
    setLineas([lineaVacia()]);
    setAvisoAlta(false);
    setModal(true);
  }

  function abrirEdicion(v) {
    setEditando(v);
    setAvisoAlta(false);
    setForm({
      matricula: v.matricula,
      marca: v.marca ?? "",
      modelo: v.modelo ?? "",
      bastidor: v.bastidor ?? "",
      clienteNombre: v.clienteNombre ?? "",
      telefono: v.telefono ?? "",
      aseguradora: v.aseguradora?._id ?? v.aseguradora ?? "",
      numeroSiniestro: v.numeroSiniestro ?? "",
      fechaSiniestro: v.fechaSiniestro ? aFechaInput(v.fechaSiniestro) : "",
      compromiso: !!v.compromiso,
      observaciones: v.observaciones ?? "",
    });
    setLineas(v.lineas?.length > 0 ? v.lineas.map((l) => ({ ...l })) : [lineaVacia()]);
    setModal(true);
  }

  // Importación OCR de una valoración (Audatex, GT Estimate…): sube el PDF
  // o foto y precarga matrícula, siniestro, aseguradora y partidas.
  async function importarPDF(e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setImportando(true);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      const r = await fetch("/api/taller/valoraciones/importar-pdf", { method: "POST", body: fd });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo leer el documento");

      // Aseguradora: coincide por nombre (contiene, sin distinguir mayúsculas).
      const compania = (datos.compania ?? "").toLowerCase().trim();
      const aseg = compania
        ? aseguradoras.find(
            (a) => a.nombre.toLowerCase().includes(compania) || compania.includes(a.nombre.toLowerCase())
          )
        : null;

      setForm((f) => ({
        ...f,
        matricula: datos.matricula ? datos.matricula.toUpperCase() : f.matricula,
        marca: datos.marca ?? f.marca,
        modelo: datos.modelo ?? f.modelo,
        bastidor: datos.bastidor ? datos.bastidor.toUpperCase() : f.bastidor,
        numeroSiniestro: datos.numeroSiniestro ?? f.numeroSiniestro,
        fechaSiniestro: datos.fechaSiniestro ?? f.fechaSiniestro,
        aseguradora: aseg?._id ?? f.aseguradora,
        observaciones: datos.observaciones ?? f.observaciones,
      }));

      // Las secciones/imputaciones del documento se aplastan a partidas con
      // el prefijo del grupo (p.ej. "Chapa aleta dcha: Reparar aleta").
      const partidas = (datos.secciones ?? []).flatMap((s) =>
        (s.operaciones ?? []).map((op) => ({
          descripcion: s.nombre ? `${s.nombre}: ${op.descripcion}` : op.descripcion,
          importe: Number(op.importe) || 0,
        }))
      );
      if (partidas.length) setLineas(partidas);
    } catch (e2) {
      alert(e2.message);
    } finally {
      setImportando(false);
    }
  }

  async function guardar(e) {
    e.preventDefault();
    const cuerpo = {
      ...form,
      aseguradora: form.aseguradora || null,
      fechaSiniestro: form.fechaSiniestro || undefined,
      lineas: lineas.filter((l) => l.descripcion),
    };
    const r = await fetch(`/api/taller/valoraciones${editando ? `/${editando._id}` : ""}`, {
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

  async function cambiarEstado(v, estado) {
    const r = await fetch(`/api/taller/valoraciones/${v._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const datos = await r.json();
    if (r.ok) cargar();
    else alert(datos.error || "No se pudo cambiar el estado");
  }

  async function crearOrden(v) {
    if (!window.confirm(`¿Crear orden de trabajo desde ${v.numero}?`)) return;
    const r = await fetch(`/api/taller/valoraciones/${v._id}/crear-orden`, { method: "POST" });
    const datos = await r.json();
    if (r.ok) cargar();
    else alert(datos.error || "No se pudo crear la orden");
  }

  // Alta automática desde el PDF de la compañía: el servidor lo lee con OCR,
  // crea la valoración completa y se abre para poner solo los datos del cliente.
  async function importarAltaPDF(e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setImportandoAlta(true);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      const r = await fetch("/api/taller/valoraciones/importar", { method: "POST", body: fd });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo importar el documento");
      await cargar();
      abrirEdicion(datos.valoracion);
      setAvisoAlta(true);
    } catch (e2) {
      alert(e2.message);
    } finally {
      setImportandoAlta(false);
    }
  }

  async function borrar(v) {
    if (!window.confirm(`¿Borrar la valoración ${v.numero}?`)) return;
    const r = await fetch(`/api/taller/valoraciones/${v._id}`, { method: "DELETE" });
    if (r.ok) cargar();
    else alert((await r.json()).error || "No se pudo borrar");
  }

  const totalForm = lineas.reduce((s, l) => s + (Number(l.importe) || 0), 0);

  return (
    <>
      <CabeceraPagina
        titulo="Valoraciones"
        descripcion="Peritajes de daños para compañías de seguros o clientes particulares."
      >
        <button
          onClick={() => inputAltaPdfRef.current?.click()}
          disabled={importandoAlta}
          className="btn-ghost disabled:opacity-50"
          title="Sube el PDF de la compañía: se lee solo y se crea la valoración completa"
        >
          {importandoAlta ? "Leyendo documento…" : "Alta desde PDF"}
        </button>
        <button onClick={abrirNueva} className="btn-primary">
          Nueva valoración
        </button>
      </CabeceraPagina>

      <input
        ref={inputAltaPdfRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={importarAltaPDF}
      />

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {lista?.length > 0 && (
        <div className="mb-3">
          <InputBusqueda value={q} onChange={setQ} />
        </div>
      )}

      <div className="panel px-3.5 py-2">
        {!lista ? null : lista.length === 0 ? (
          <EstadoVacio
            titulo="Sin valoraciones"
            descripcion="Registra el primer peritaje: compañía, nº de siniestro y partidas de daños."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Vehículo</th>
                  <th>Cliente</th>
                  <th>Compañía</th>
                  <th>Siniestro</th>
                  <th>Estado</th>
                  <th className="text-right">Valoración</th>
                  <th>OT</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((v) => (
                  <tr key={v._id}>
                    <td className="font-bold text-white whitespace-nowrap num">{v.numero}</td>
                    <td className="text-slate-300 num">{v.matricula}</td>
                    <td className="text-slate-300">{v.clienteNombre ?? "—"}</td>
                    <td className="text-slate-300">
                      {v.compania ?? "—"}
                      {v.compromiso && (
                        <span className="ml-1.5 inline-block align-middle rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold">
                          Compromiso
                        </span>
                      )}
                    </td>
                    <td className="text-slate-400 num">{v.numeroSiniestro ?? "—"}</td>
                    <td>
                      <select
                        value={v.estado}
                        onChange={(e) => cambiarEstado(v, e.target.value)}
                        className={`cursor-pointer appearance-none rounded-full border text-[0.6875rem] font-semibold pl-3 pr-7 py-1 bg-no-repeat focus:outline-none ${
                          CLASES_PILL_ESTADO[tonoEstadoValoracion(v.estado)] ?? CLASES_PILL_ESTADO.slate
                        }`}
                        style={ESTILO_FLECHA}
                      >
                        {ESTADOS_VALORACION.map((e2) => (
                          <option key={e2.clave} value={e2.clave}>{e2.nombre}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-right text-slate-300 whitespace-nowrap num">{euros(v.total)}</td>
                    <td className="whitespace-nowrap">
                      {v.numeroOrden ? (
                        <Badge tono="cyan">{v.numeroOrden}</Badge>
                      ) : (
                        <button onClick={() => crearOrden(v)} className="text-xs text-accent hover:underline">
                          Crear OT
                        </button>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        onClick={() => imprimirValoracion(v)}
                        title="Imprimir valoración"
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
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-slate-500 py-8">
                      Sin resultados para «{q}».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <div
            className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-white">
                {editando ? `Valoración ${editando.numero}` : "Nueva valoración"}
              </h2>
              <button
                type="button"
                onClick={() => inputPdfRef.current?.click()}
                disabled={importando}
                className="btn-ghost !py-1.5 !px-3.5 text-xs whitespace-nowrap disabled:opacity-50"
                title="Sube el PDF o una foto de la valoración (Audatex, GT Estimate…) y se rellena sola"
              >
                {importando ? "Leyendo con OCR…" : "Importar PDF"}
              </button>
              <input
                ref={inputPdfRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={importarPDF}
              />
            </div>
            {avisoAlta && (
              <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                Valoración creada desde el PDF de la compañía. Revisa los datos y completa el cliente y el teléfono.
              </div>
            )}
            <form onSubmit={guardar} className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Matrícula *</label>
                  <input
                    className={`${campo} uppercase`}
                    value={form.matricula}
                    onChange={(e) => setForm({ ...form, matricula: e.target.value.toUpperCase() })}
                    onBlur={rellenarDesdeVehiculo}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Marca</label>
                  <input
                    className={campo}
                    value={form.marca}
                    onChange={(e) => setForm({ ...form, marca: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Modelo</label>
                  <input
                    className={campo}
                    value={form.modelo}
                    onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Nº de bastidor</label>
                  <input
                    className={`${campo} uppercase`}
                    value={form.bastidor}
                    onChange={(e) => setForm({ ...form, bastidor: e.target.value.toUpperCase() })}
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
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Teléfono</label>
                  <input
                    className={campo}
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Compañía de seguros</label>
                  <BuscadorEntidad
                    opciones={aseguradoras}
                    valorId={form.aseguradora}
                    onElegir={(op) => setForm({ ...form, aseguradora: op?._id ?? "" })}
                    placeholder="Particular o busca la compañía…"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Nº de siniestro</label>
                  <input
                    className={campo}
                    value={form.numeroSiniestro}
                    onChange={(e) => setForm({ ...form, numeroSiniestro: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Fecha del siniestro</label>
                  <input
                    type="date"
                    className={campo}
                    value={form.fechaSiniestro}
                    onChange={(e) => setForm({ ...form, fechaSiniestro: e.target.value })}
                  />
                </div>
                {form.aseguradora && (
                  <label className="flex items-end gap-2 pb-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.compromiso}
                      onChange={(e) => setForm({ ...form, compromiso: e.target.checked })}
                      className="w-4 h-4 accent-[#0e7490]"
                    />
                    <span className="text-sm text-slate-300">Compromiso de reparación</span>
                  </label>
                )}
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-2">Partidas de daños</label>
                <div className="hidden md:grid grid-cols-12 gap-2 px-1 pb-1 text-xs text-slate-500">
                  <span className="col-span-2">Tipo</span>
                  <span className="col-span-5">Descripción</span>
                  <span className="col-span-2">Horas</span>
                  <span className="col-span-2 text-right">Importe €</span>
                  <span className="col-span-1"></span>
                </div>
                <div className="space-y-2">
                  {lineas.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2">
                      <select
                        value={l.tipo ?? "otro"}
                        onChange={(e) => actualizarLinea(i, { tipo: e.target.value })}
                        className="col-span-4 md:col-span-2 input"
                      >
                        {TIPOS_PARTIDA.map(([id, et]) => (
                          <option key={id} value={id}>{et}</option>
                        ))}
                      </select>
                      <input
                        placeholder="Descripción de la partida"
                        value={l.descripcion}
                        onChange={(e) => actualizarLinea(i, { descripcion: e.target.value })}
                        className="col-span-8 md:col-span-5 input"
                      />
                      <input
                        type="number" min="0" step="0.25" placeholder="—"
                        title="Horas (mano de obra: chapa, pintura, mecánica)"
                        value={l.horas ?? ""}
                        onChange={(e) => actualizarLinea(i, { horas: e.target.value })}
                        className="col-span-4 md:col-span-2 input"
                      />
                      <input
                        type="number" min="0" step="0.01" placeholder="Importe"
                        value={l.importe}
                        onChange={(e) => actualizarLinea(i, { importe: e.target.value })}
                        className="col-span-6 md:col-span-2 input text-right"
                      />
                      <button
                        type="button"
                        onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))}
                        className="col-span-2 md:col-span-1 text-slate-500 hover:text-red-300"
                        title="Quitar partida"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setLineas((ls) => [...ls, lineaVacia()])}
                      className="text-accent text-sm hover:underline"
                    >
                      + Añadir partida
                    </button>
                    {(preciosHora.chapa > 0 || preciosHora.pintura > 0 || preciosHora.mecanica > 0) && (
                      <span className="text-xs text-slate-500">
                        {preciosHora.chapa > 0 && `Chapa ${preciosHora.chapa} €/h`}
                        {preciosHora.pintura > 0 && ` · Pintura ${preciosHora.pintura} €/h`}
                        {preciosHora.mecanica > 0 && ` · Mecánica ${preciosHora.mecanica} €/h`}
                      </span>
                    )}
                    <p className="text-sm text-slate-400">
                      <span className="text-white font-semibold">Total {euros(totalForm)}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Observaciones</label>
                <textarea
                  className={`${campo} resize-none`}
                  rows={2}
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
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
