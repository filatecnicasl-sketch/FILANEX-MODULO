import { useEffect, useMemo, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda, euros } from "../../components/ui.jsx";
import { fechaCorta, nombreTipo } from "./datos.js";

const ESTADOS = [
  { clave: "pendiente", nombre: "Pendiente", tono: "amber" },
  { clave: "recibida", nombre: "Recibida", tono: "emerald" },
  { clave: "cancelada", nombre: "Cancelada", tono: "slate" },
];
const tonoEstado = (c) => ESTADOS.find((e) => e.clave === c)?.tono ?? "slate";
const nombreEstado = (c) => ESTADOS.find((e) => e.clave === c)?.nombre ?? c;

function ModalSolicitud({ clientes, onCerrar, onGuardado }) {
  const [f, setF] = useState({ clienteAsesoria: clientes[0]?._id ?? "", descripcion: "", periodo: "", notas: "" });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const r = await fetch("/api/asesoria/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    const datos = await r.json();
    setGuardando(false);
    if (!r.ok) return setError(datos.error || "Error al guardar");
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">Pedir documento a un cliente</h2>
        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="label">Cliente *</label>
            <select
              className="input"
              value={f.clienteAsesoria}
              onChange={(e) => setF((v) => ({ ...v, clienteAsesoria: e.target.value }))}
            >
              {clientes.map((c) => (
                <option key={c._id} value={c._id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Qué necesitas *</label>
            <input
              className="input"
              required
              placeholder="Factura de mayo de Recambios del Sur"
              value={f.descripcion}
              onChange={(e) => setF((v) => ({ ...v, descripcion: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Periodo</label>
            <input
              className="input"
              placeholder="2T 2026"
              value={f.periodo}
              onChange={(e) => setF((v) => ({ ...v, periodo: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Notas</label>
            <input
              className="input"
              value={f.notas}
              onChange={(e) => setF((v) => ({ ...v, notas: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={guardando}>
              {guardando ? "Guardando…" : "Crear solicitud"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalVincular({ solicitud, onCerrar, onGuardado }) {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/asesoria/documentos?cliente=${solicitud.clienteAsesoria._id}&estado=pendiente`)
      .then(async (r) => {
        const datos = await r.json();
        if (!r.ok) throw new Error(datos.error || "Error al cargar documentos");
        setDocs(datos);
      })
      .catch((e) => setError(e.message));
  }, [solicitud]);

  async function vincular(docId) {
    const r = await fetch(`/api/asesoria/solicitudes/${solicitud._id}/vincular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentoId: docId }),
    });
    if (!r.ok) {
      const datos = await r.json();
      return setError(datos.error || "No se pudo vincular");
    }
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-1">Vincular documento recibido</h2>
        <p className="text-xs text-slate-500 mb-4">{solicitud.descripcion}</p>
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        {docs && docs.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6">
            Este cliente no tiene documentos pendientes de revisar. Sube primero el documento en «Documentos».
          </p>
        )}
        <ul className="divide-y divide-white/5">
          {(docs ?? []).map((d) => (
            <li key={d._id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">
                  {nombreTipo(d.tipo)} · {d.tercero ?? "Sin tercero"}
                </p>
                <p className="text-xs text-slate-500">
                  {fechaCorta(d.fecha)} · {d.numero ?? "sin número"} · {euros(d.total)}
                </p>
              </div>
              <button className="btn-primary text-xs shrink-0" onClick={() => vincular(d._id)}>
                Es este
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end pt-4">
          <button className="btn-ghost" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function enlaceWhatsApp(s) {
  const telefono = String(s.clienteAsesoria?.telefono ?? "").replace(/\D/g, "");
  if (!telefono) return null;
  const numero = telefono.startsWith("34") ? telefono : `34${telefono.slice(-9)}`;
  const texto = `Hola, desde la asesoría necesitamos este documento: ${s.descripcion}${
    s.periodo ? ` (${s.periodo})` : ""
  }. ¿Puedes enviárnoslo por aquí? Muchas gracias.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export default function AsesoriaSolicitudesPage() {
  const [clientes, setClientes] = useState([]);
  const [solicitudes, setSolicitudes] = useState(null);
  const [estado, setEstado] = useState("pendiente");
  const [q, setQ] = useState("");
  const [modalNueva, setModalNueva] = useState(false);
  const [vinculando, setVinculando] = useState(null);
  const [error, setError] = useState(null);

  async function cargar() {
    try {
      const params = new URLSearchParams();
      if (estado) params.set("estado", estado);
      const r = await fetch(`/api/asesoria/solicitudes?${params}`);
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setSolicitudes(datos);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    fetch("/api/asesoria/cartera").then((r) => r.json()).then(setClientes).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
  }, [estado]);

  const filtradas = useMemo(() => {
    if (!solicitudes) return [];
    return solicitudes.filter((s) =>
      coincideBusqueda(q, s.descripcion, s.periodo, s.clienteAsesoria?.nombre, s.notas)
    );
  }, [solicitudes, q]);

  async function cambiarEstado(s, nuevo) {
    await fetch(`/api/asesoria/solicitudes/${s._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevo }),
    });
    cargar();
  }

  async function borrar(s) {
    if (!confirm("¿Borrar esta solicitud?")) return;
    await fetch(`/api/asesoria/solicitudes/${s._id}`, { method: "DELETE" });
    cargar();
  }

  return (
    <>
      <CabeceraPagina
        titulo="Solicitudes de documentos"
        descripcion="Pide a tus clientes la documentación que falta y controla qué sigue sin llegar."
      >
        <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por cliente, descripción, periodo…" />
        <button className="btn-primary" onClick={() => setModalNueva(true)} disabled={clientes.length === 0}>
          Nueva solicitud
        </button>
      </CabeceraPagina>

      <div className="flex gap-2 mb-4">
        <button
          className={`btn-ghost text-xs ${estado === "pendiente" ? "ring-1 ring-accent" : ""}`}
          onClick={() => setEstado("pendiente")}
        >
          Pendientes
        </button>
        <button
          className={`btn-ghost text-xs ${estado === "" ? "ring-1 ring-accent" : ""}`}
          onClick={() => setEstado("")}
        >
          Todas
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      {solicitudes && filtradas.length === 0 && (
        <EstadoVacio
          titulo="Sin solicitudes"
          descripcion="Cuando te falte un documento, créala con «Nueva solicitud» y avisa al cliente por WhatsApp."
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtradas.map((s) => {
          const wa = enlaceWhatsApp(s);
          return (
            <div key={s._id} className="panel p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{s.clienteAsesoria?.nombre}</p>
                  <p className="text-sm text-slate-300 mt-1">{s.descripcion}</p>
                  {s.periodo && <p className="text-xs text-slate-500 mt-0.5">{s.periodo}</p>}
                </div>
                <Badge tono={tonoEstado(s.estado)}>{nombreEstado(s.estado)}</Badge>
              </div>
              {s.documento && (
                <p className="text-xs text-emerald-400 mt-2">
                  Recibido: {nombreTipo(s.documento.tipo)} · {s.documento.tercero ?? ""} · {fechaCorta(s.documento.fecha)}
                </p>
              )}
              <p className="text-[11px] text-slate-600 mt-2">Pedido el {fechaCorta(s.createdAt)}</p>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/5">
                {s.estado === "pendiente" && (
                  <>
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
                        Avisar por WhatsApp
                      </a>
                    )}
                    <button className="btn-ghost text-xs" onClick={() => setVinculando(s)}>
                      Vincular documento
                    </button>
                    <button className="btn-ghost text-xs" onClick={() => cambiarEstado(s, "cancelada")}>
                      Cancelar
                    </button>
                  </>
                )}
                {s.estado === "recibida" && (
                  <button className="btn-ghost text-xs" onClick={() => cambiarEstado(s, "pendiente")}>
                    Reabrir
                  </button>
                )}
                <button className="btn-ghost text-xs text-red-300" onClick={() => borrar(s)}>Borrar</button>
              </div>
            </div>
          );
        })}
      </div>

      {modalNueva && (
        <ModalSolicitud
          clientes={clientes}
          onCerrar={() => setModalNueva(false)}
          onGuardado={() => {
            setModalNueva(false);
            cargar();
          }}
        />
      )}
      {vinculando && (
        <ModalVincular
          solicitud={vinculando}
          onCerrar={() => setVinculando(null)}
          onGuardado={() => {
            setVinculando(null);
            cargar();
          }}
        />
      )}
    </>
  );
}
