import { useEffect, useMemo, useRef, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda, euros } from "../../components/ui.jsx";
import {
  ESTADOS_DOCUMENTO,
  TIPOS_DOCUMENTO,
  fechaCorta,
  nombreEstadoDoc,
  nombreTipo,
  tonoEstadoDoc,
  tonoTipo,
} from "./datos.js";

const DOC_VACIO = {
  tipo: "recibida",
  fecha: new Date().toISOString().slice(0, 10),
  numero: "",
  tercero: "",
  nifTercero: "",
  base: "",
  tipoIva: 21,
  cuotaIva: "",
  total: "",
  retencion: 0,
  notas: "",
};

function ModalDocumento({ cliente, inicial, onCerrar, onGuardado }) {
  const [f, setF] = useState(() => {
    const base = { ...DOC_VACIO, ...inicial };
    if (inicial?.fecha) base.fecha = new Date(inicial.fecha).toISOString().slice(0, 10);
    return base;
  });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const set = (campo) => (e) => setF((v) => ({ ...v, [campo]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const num = (v) => (v === "" || v === undefined ? undefined : Number(String(v).replace(",", ".")) || 0);
    const cuerpo = {
      clienteAsesoria: inicial?.clienteAsesoria?._id ?? inicial?.clienteAsesoria ?? cliente,
      tipo: f.tipo,
      fecha: f.fecha,
      numero: f.numero,
      tercero: f.tercero,
      nifTercero: f.nifTercero,
      base: num(f.base),
      tipoIva: num(f.tipoIva),
      cuotaIva: num(f.cuotaIva),
      total: num(f.total),
      retencion: num(f.retencion) ?? 0,
      notas: f.notas,
    };
    const r = await fetch(inicial ? `/api/asesoria/documentos/${inicial._id}` : "/api/asesoria/documentos", {
      method: inicial ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const datos = await r.json();
    setGuardando(false);
    if (!r.ok) return setError(datos.error || "Error al guardar");
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">
          {inicial ? "Revisar documento" : "Nuevo documento manual"}
        </h2>
        {inicial?.archivo && (
          <a href={inicial.archivo} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline block mb-3">
            Ver documento original
          </a>
        )}
        <form onSubmit={guardar} className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={f.tipo} onChange={set("tipo")}>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.clave} value={t.clave}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Fecha *</label>
            <input className="input" type="date" required value={f.fecha} onChange={set("fecha")} />
          </div>
          <div>
            <label className="label">Número</label>
            <input className="input" value={f.numero} onChange={set("numero")} />
          </div>
          <div>
            <label className="label">Tercero</label>
            <input className="input" value={f.tercero} onChange={set("tercero")} />
          </div>
          <div>
            <label className="label">NIF del tercero</label>
            <input className="input" value={f.nifTercero} onChange={set("nifTercero")} />
          </div>
          <div>
            <label className="label">Tipo de IVA %</label>
            <select className="input" value={f.tipoIva} onChange={set("tipoIva")}>
              {[0, 4, 10, 21].map((t) => (
                <option key={t} value={t}>{t} %</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Base imponible</label>
            <input className="input" value={f.base} onChange={set("base")} placeholder="0,00" />
          </div>
          <div>
            <label className="label">Cuota IVA</label>
            <input className="input" value={f.cuotaIva} onChange={set("cuotaIva")} placeholder="0,00" />
          </div>
          <div>
            <label className="label">Total</label>
            <input className="input" value={f.total} onChange={set("total")} placeholder="0,00" />
          </div>
          {f.tipo === "emitida" && (
            <div>
              <label className="label">Retención IRPF %</label>
              <select className="input" value={f.retencion} onChange={set("retencion")}>
                {[0, 7, 15, 19].map((t) => (
                  <option key={t} value={t}>{t} %</option>
                ))}
              </select>
            </div>
          )}
          <div className="col-span-2">
            <label className="label">Notas</label>
            <input className="input" value={f.notas} onChange={set("notas")} />
          </div>
          {error && <p className="col-span-2 text-sm text-red-400">{error}</p>}
          <div className="col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" className="btn-ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AsesoriaDocumentosPage() {
  const [clientes, setClientes] = useState([]);
  const [cliente, setCliente] = useState("");
  const [docs, setDocs] = useState(null);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [modal, setModal] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);
  const inputFichero = useRef(null);

  async function cargarDocs(clienteId = cliente, estadoSel = estado) {
    const params = new URLSearchParams();
    if (clienteId) params.set("cliente", clienteId);
    if (estadoSel) params.set("estado", estadoSel);
    const r = await fetch(`/api/asesoria/documentos?${params}`);
    const datos = await r.json();
    if (r.ok) setDocs(datos);
  }

  useEffect(() => {
    fetch("/api/asesoria/cartera")
      .then((r) => r.json())
      .then((lista) => {
        setClientes(lista);
        if (lista.length && !cliente) setCliente(lista[0]._id);
      })
      .catch(() => setError("No se pudo cargar la cartera"));
  }, []);

  useEffect(() => {
    if (cliente) cargarDocs(cliente, estado);
  }, [cliente, estado]);

  const filtrados = useMemo(() => {
    if (!docs) return [];
    return docs.filter((d) =>
      coincideBusqueda(q, d.tercero, d.nifTercero, d.numero, d.notas, nombreTipo(d.tipo))
    );
  }, [docs, q]);

  async function subirOcr(listaArchivos) {
    const archivos = Array.from(listaArchivos || []);
    if (!archivos.length || !cliente) return;
    setSubiendo(true);
    setAviso(null);
    setError(null);
    const avisos = [];
    const fallos = [];
    let leidos = 0;
    for (let i = 0; i < archivos.length; i++) {
      setProgreso({ hecho: i, total: archivos.length, nombre: archivos[i].name });
      const datos = new FormData();
      datos.append("clienteAsesoria", cliente);
      datos.append("tipo", "recibida");
      datos.append("documento", archivos[i]);
      try {
        const r = await fetch("/api/asesoria/documentos/ocr", { method: "POST", body: datos });
        const res = await r.json();
        if (!r.ok) throw new Error(res.error || "No se pudo leer el documento");
        leidos++;
        (res.avisos || []).forEach((a) => avisos.push(`${archivos[i].name}: ${a}`));
      } catch (e) {
        fallos.push(`${archivos[i].name}: ${e.message}`);
      }
    }
    setProgreso(null);
    setSubiendo(false);
    if (inputFichero.current) inputFichero.current.value = "";
    cargarDocs();
    const resumen = [`${leidos} de ${archivos.length} documento(s) leídos.`, ...avisos];
    setAviso(resumen.join(" "));
    if (fallos.length) setError(fallos.join(" "));
  }

  async function cambiarEstado(d, nuevo) {
    await fetch(`/api/asesoria/documentos/${d._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevo }),
    });
    cargarDocs();
  }

  async function borrar(d) {
    if (!confirm(`¿Borrar el documento de ${d.tercero ?? "este tercero"}?`)) return;
    await fetch(`/api/asesoria/documentos/${d._id}`, { method: "DELETE" });
    cargarDocs();
  }

  const clienteSel = clientes.find((c) => c._id === cliente);

  return (
    <>
      <CabeceraPagina
        titulo="Documentos de la cartera"
        descripcion="Sube la documentación de cada cliente (foto o PDF): se lee con IA y queda pendiente de tu revisión."
      >
        <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por tercero, NIF, número…" />
        <button className="btn-ghost" onClick={() => setModal({})} disabled={!cliente}>
          Alta manual
        </button>
        <button
          className="btn-primary"
          disabled={!cliente || subiendo}
          onClick={() => inputFichero.current?.click()}
        >
          {subiendo
            ? progreso
              ? `Leyendo ${progreso.hecho + 1} de ${progreso.total}…`
              : "Leyendo con IA…"
            : "Subir documentos"}
        </button>
        <input
          ref={inputFichero}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => subirOcr(e.target.files)}
        />
      </CabeceraPagina>

      <div className="flex flex-wrap gap-3 mb-4">
        <select className="input max-w-xs" value={cliente} onChange={(e) => setCliente(e.target.value)}>
          {clientes.map((c) => (
            <option key={c._id} value={c._id}>{c.nombre}</option>
          ))}
        </select>
        <select className="input max-w-[180px]" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS_DOCUMENTO.map((s) => (
            <option key={s.clave} value={s.clave}>{s.nombre}</option>
          ))}
        </select>
      </div>

      {progreso && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span className="truncate max-w-[70%]">{progreso.nombre}</span>
            <span>{progreso.hecho + 1} / {progreso.total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-indigo-400 transition-all"
              style={{ width: `${Math.round((progreso.hecho / progreso.total) * 100)}%` }}
            />
          </div>
        </div>
      )}
      {aviso && <p className="text-sm text-emerald-400 mb-3">{aviso}</p>}
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {clientes.length === 0 && docs === null && (
        <EstadoVacio
          titulo="Primero la cartera"
          descripcion="Da de alta un cliente en «Cartera» para poder subirle documentos."
        />
      )}
      {docs && filtrados.length === 0 && (
        <EstadoVacio
          titulo={`Sin documentos de ${clienteSel?.nombre ?? "este cliente"}`}
          descripcion="Sube una foto o un PDF y la IA extraerá los datos."
        />
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-white/5">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Tercero</th>
              <th className="px-4 py-3 text-right">Base</th>
              <th className="px-4 py-3 text-right">IVA</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((d) => (
              <tr key={d._id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{fechaCorta(d.fecha)}</td>
                <td className="px-4 py-3"><Badge tono={tonoTipo(d.tipo)}>{nombreTipo(d.tipo)}</Badge></td>
                <td className="px-4 py-3 text-slate-300">{d.numero || "—"}</td>
                <td className="px-4 py-3 text-slate-300 max-w-[220px] truncate">
                  {d.tercero || "—"}
                  {d.nifTercero && <span className="text-xs text-slate-500 block">{d.nifTercero}</span>}
                </td>
                <td className="px-4 py-3 text-right text-slate-300">{euros(d.base)}</td>
                <td className="px-4 py-3 text-right text-slate-300">{euros(d.cuotaIva)}</td>
                <td className="px-4 py-3 text-right text-white font-semibold">{euros(d.total)}</td>
                <td className="px-4 py-3">
                  <select
                    className="bg-transparent text-xs border border-white/10 rounded-lg px-2 py-1"
                    value={d.estado}
                    onChange={(e) => cambiarEstado(d, e.target.value)}
                  >
                    {ESTADOS_DOCUMENTO.map((s) => (
                      <option key={s.clave} value={s.clave}>{s.nombre}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {d.archivo && (
                    <a href={d.archivo} target="_blank" rel="noreferrer" className="btn-ghost text-xs mr-2">Ver</a>
                  )}
                  <button className="btn-ghost text-xs mr-2" onClick={() => setModal(d)}>Editar</button>
                  <button className="btn-ghost text-xs text-red-300" onClick={() => borrar(d)}>Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <ModalDocumento
          cliente={cliente}
          inicial={modal._id ? modal : null}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            cargarDocs();
          }}
        />
      )}
    </>
  );
}
