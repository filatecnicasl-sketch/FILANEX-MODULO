import { useEffect, useMemo, useState } from "react";
import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Badge, EstadoVacio, InputBusqueda, coincideBusqueda, euros } from "../../components/ui.jsx";
import { FORMAS_JURIDICAS, MODELOS_FISCALES, REGIMENES_IRPF, nombreForma } from "./datos.js";
import DocumentosVinculados from "./DocumentosVinculados.jsx";

const VACIO = {
  nombre: "",
  nif: "",
  formaJuridica: "sl",
  regimenIrpf: "estimacion_directa_simplificada",
  actividad: "",
  epigrafe: "",
  telefono: "",
  email: "",
  personaContacto: "",
  calle: "",
  cp: "",
  ciudad: "",
  provincia: "",
  numeroEmpleados: 0,
  cuotaMensual: 0,
  areas: { fiscal: true, contable: true, laboral: false },
  modelos: ["303", "390"],
  notas: "",
};

function ModalCliente({ inicial, onCerrar, onGuardado }) {
  const [f, setF] = useState(() => {
    const base = { ...VACIO, ...inicial };
    if (inicial?.direccion) {
      Object.assign(base, inicial.direccion);
    }
    base.areas = { ...VACIO.areas, ...inicial?.areas };
    base.modelos = inicial?.modelos ?? ["303", "390"];
    return base;
  });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const set = (campo) => (e) => setF((v) => ({ ...v, [campo]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const cuerpo = {
      nombre: f.nombre,
      nif: f.nif,
      formaJuridica: f.formaJuridica,
      regimenIrpf: f.formaJuridica === "autonomo" ? f.regimenIrpf : undefined,
      actividad: f.actividad,
      epigrafe: f.epigrafe,
      telefono: f.telefono,
      email: f.email,
      personaContacto: f.personaContacto,
      direccion: { calle: f.calle, cp: f.cp, ciudad: f.ciudad, provincia: f.provincia },
      numeroEmpleados: Number(f.numeroEmpleados) || 0,
      cuotaMensual: Number(String(f.cuotaMensual).replace(",", ".")) || 0,
      areas: f.areas,
      modelos: f.modelos,
      notas: f.notas,
    };
    const r = await fetch(inicial ? `/api/asesoria/cartera/${inicial._id}` : "/api/asesoria/cartera", {
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
      <div className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">
          {inicial ? `Cliente ${inicial.codigo}` : "Nuevo cliente de la asesoría"}
        </h2>
        <form onSubmit={guardar} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">Nombre / razón social *</label>
            <input className="input" required value={f.nombre} onChange={set("nombre")} />
          </div>
          <div>
            <label className="label">NIF *</label>
            <input className="input" required value={f.nif} onChange={set("nif")} />
          </div>
          <div>
            <label className="label">Forma jurídica</label>
            <select className="input" value={f.formaJuridica} onChange={set("formaJuridica")}>
              {FORMAS_JURIDICAS.map((x) => (
                <option key={x.clave} value={x.clave}>{x.nombre}</option>
              ))}
            </select>
          </div>
          {f.formaJuridica === "autonomo" && (
            <div>
              <label className="label">Régimen IRPF</label>
              <select className="input" value={f.regimenIrpf} onChange={set("regimenIrpf")}>
                {REGIMENES_IRPF.map((x) => (
                  <option key={x.clave} value={x.clave}>{x.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Actividad</label>
            <input className="input" value={f.actividad} onChange={set("actividad")} />
          </div>
          <div>
            <label className="label">Epígrafe IAE</label>
            <input className="input" value={f.epigrafe} onChange={set("epigrafe")} />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input className="input" value={f.telefono} onChange={set("telefono")} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={f.email} onChange={set("email")} />
          </div>
          <div>
            <label className="label">Persona de contacto</label>
            <input className="input" value={f.personaContacto} onChange={set("personaContacto")} />
          </div>
          <div>
            <label className="label">Cuota mensual (€)</label>
            <input className="input" value={f.cuotaMensual} onChange={set("cuotaMensual")} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Dirección</label>
            <input className="input" placeholder="Calle y número" value={f.calle} onChange={set("calle")} />
          </div>
          <div>
            <input className="input" placeholder="CP" value={f.cp} onChange={set("cp")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input className="input" placeholder="Ciudad" value={f.ciudad} onChange={set("ciudad")} />
            <input className="input" placeholder="Provincia" value={f.provincia} onChange={set("provincia")} />
          </div>

          <div className="md:col-span-2">
            <label className="label">Áreas que lleva la asesoría</label>
            <div className="flex gap-4">
              {["fiscal", "contable", "laboral"].map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm text-slate-300 capitalize">
                  <input
                    type="checkbox"
                    checked={!!f.areas[a]}
                    onChange={(e) => setF((v) => ({ ...v, areas: { ...v.areas, [a]: e.target.checked } }))}
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="label">Modelos que se le presentan</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {MODELOS_FISCALES.map((m) => (
                <label key={m.clave} className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={f.modelos.includes(m.clave)}
                    onChange={(e) =>
                      setF((v) => ({
                        ...v,
                        modelos: e.target.checked
                          ? [...v.modelos, m.clave]
                          : v.modelos.filter((x) => x !== m.clave),
                      }))
                    }
                  />
                  {m.nombre}
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={f.notas} onChange={set("notas")} />
          </div>

          {error && <p className="md:col-span-2 text-sm text-red-400">{error}</p>}
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
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

export default function AsesoriaCarteraPage() {
  const [clientes, setClientes] = useState(null);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const [error, setError] = useState(null);
  const [miCodigo, setMiCodigo] = useState(null);
  const [vinculados, setVinculados] = useState([]);
  const [visorVinculo, setVisorVinculo] = useState(null);

  async function cargar() {
    try {
      const r = await fetch("/api/asesoria/cartera");
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "Error al cargar");
      setClientes(datos);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
    fetch("/api/asesoria/mi-codigo")
      .then((r) => r.json())
      .then((d) => setMiCodigo(d.codigo ?? null))
      .catch(() => {});
    fetch("/api/asesoria/vinculados")
      .then((r) => r.json())
      .then((d) => setVinculados(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Cliente de cartera → vínculo FILANEX activo (si lo tiene).
  const vinculoPorCartera = useMemo(() => {
    const mapa = new Map();
    for (const v of vinculados) {
      if (v.estado === "activo" && v.clienteCarteraId) mapa.set(String(v.clienteCarteraId), v);
    }
    return mapa;
  }, [vinculados]);

  const filtrados = useMemo(() => {
    if (!clientes) return [];
    return clientes.filter((c) =>
      coincideBusqueda(q, c.nombre, c.nif, c.codigo, c.telefono, c.email, c.actividad, c.personaContacto)
    );
  }, [clientes, q]);

  async function alternarActivo(c) {
    await fetch(`/api/asesoria/cartera/${c._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !c.activo }),
    });
    cargar();
  }

  async function borrar(c) {
    if (!confirm(`¿Borrar a ${c.nombre} de la cartera?`)) return;
    const r = await fetch(`/api/asesoria/cartera/${c._id}`, { method: "DELETE" });
    if (!r.ok) {
      const datos = await r.json();
      alert(datos.error || "No se pudo borrar");
    }
    cargar();
  }

  return (
    <>
      <CabeceraPagina
        titulo="Cartera de clientes"
        descripcion="Clientes a los que la asesoría lleva la fiscalidad, la contabilidad y/o la laboral."
      >
        <InputBusqueda value={q} onChange={setQ} placeholder="Buscar por nombre, NIF, teléfono, actividad…" />
        <button className="btn-primary" onClick={() => setModal({})}>Nuevo cliente</button>
      </CabeceraPagina>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {miCodigo && (
        <div className="panel p-4 mb-4 flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs text-slate-500">Tu código de asesoría (dáselo a tus clientes que usen FILANEX)</p>
            <p className="text-lg font-bold text-sky-300 tracking-wider">{miCodigo}</p>
          </div>
          <p className="text-xs text-slate-500 max-w-md ml-auto">
            Cuando un cliente lo introduce en su FILANEX (Ajustes → Asesoría) y firma la autorización,
            aparece aquí con la insignia FILANEX y puedes importar sus facturas y tickets directamente.
          </p>
        </div>
      )}

      {clientes && filtrados.length === 0 && (
        <EstadoVacio
          titulo="Sin clientes en la cartera"
          descripcion="Da de alta el primero con «Nuevo cliente»."
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtrados.map((c) => {
          const vinculo = vinculoPorCartera.get(String(c._id));
          return (
          <div key={c._id} className={`panel p-5 ${c.activo ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-white font-semibold truncate">{c.nombre}</p>
                <p className="text-xs text-slate-500">
                  {c.codigo} · {c.nif} · {nombreForma(c.formaJuridica)}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {vinculo && <Badge tono="sky">FILANEX</Badge>}
                <Badge tono={c.activo ? "emerald" : "slate"}>{c.activo ? "Activo" : "Baja"}</Badge>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {[c.personaContacto, c.telefono, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {Object.entries(c.areas ?? {}).filter(([, v]) => v).map(([a]) => (
                <Badge key={a} tono="sky">{a}</Badge>
              ))}
              {(c.modelos ?? []).slice(0, 6).map((m) => (
                <Badge key={m} tono="slate">{m}</Badge>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
              <div className="text-xs text-slate-500">
                {c.cuotaMensual ? `${euros(c.cuotaMensual)}/mes` : ""}
                {c.pendientesRevision > 0 && (
                  <span className="text-amber-300 ml-2">{c.pendientesRevision} por revisar</span>
                )}
              </div>
              <div className="flex gap-2">
                {vinculo && (
                  <button className="btn-ghost text-xs text-sky-300" onClick={() => setVisorVinculo(vinculo)}>
                    Docs FILANEX
                  </button>
                )}
                <button className="btn-ghost text-xs" onClick={() => setModal(c)}>Editar</button>
                <button className="btn-ghost text-xs" onClick={() => alternarActivo(c)}>
                  {c.activo ? "Dar de baja" : "Reactivar"}
                </button>
                <button className="btn-ghost text-xs text-red-300" onClick={() => borrar(c)}>Borrar</button>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {visorVinculo && (
        <DocumentosVinculados vinculo={visorVinculo} onCerrar={() => setVisorVinculo(null)} />
      )}

      {modal !== null && (
        <ModalCliente
          inicial={modal._id ? modal : null}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
    </>
  );
}
