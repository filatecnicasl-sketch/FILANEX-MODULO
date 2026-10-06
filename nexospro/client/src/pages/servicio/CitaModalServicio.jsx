import { useEffect, useState } from "react";
import { ESTADOS_CITA, aFechaInput } from "./datos.js";
import BuscadorEntidad from "../../components/BuscadorEntidad.jsx";
import EnviarWhatsApp from "../../components/EnviarWhatsApp.jsx";

import { cargarClientesLigeros, invalidarClientesLigeros } from "../../lib/clientesLigeros.js";
const campo = "input w-full";

/** Convierte "HH:MM" a minutos desde medianoche. */
function aMinutos(h) {
  const [hh, mm] = String(h ?? "0:0").split(":").map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

/** Convierte minutos desde medianoche a "HH:MM". */
function aHora(minutos) {
  const hh = String(Math.max(0, Math.floor(minutos / 60))).padStart(2, "0");
  const mm = String(Math.max(0, minutos % 60)).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Descripción corta del aparato (la misma que genera el servidor).
function describirAparato(a) {
  const partes = [a?.marca, a?.modelo].filter(Boolean).join(" ");
  const sn = a?.numeroSerie ? `S/N ${a.numeroSerie}` : a?.codigo;
  return [partes, sn].filter(Boolean).join(" · ");
}

// Dirección fiscal del cliente en una línea ("Calle, CP, Ciudad, Provincia").
const dirTexto = (d) => [d?.calle, d?.cp, d?.ciudad, d?.provincia].filter(Boolean).join(", ");

const normalizar = (s) =>
  (s ?? "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Busca posibles duplicados entre la cartera cargada y los datos que se
 *  están escribiendo para un cliente nuevo. */
function buscarDuplicadosClientes(clientes, { nombre, telefono, nif }) {
  const t = (telefono ?? "").toString().trim().replace(/[\s.-]/g, "");
  const n = (nif ?? "").toString().trim().toUpperCase().replace(/[\s.-]/g, "");
  const nom = normalizar(nombre).replace(/\s+/g, " ");
  const palabras = nom.split(" ").filter((p) => p.length > 2);
  const encontrados = new Map();

  for (const c of clientes) {
    const cNif = (c.nif ?? "").toString().toUpperCase().replace(/[\s.-]/g, "");
    const cTel = (c.telefono ?? "").toString().replace(/[\s.-]/g, "");
    const cNom = normalizar(c.nombre).replace(/\s+/g, " ");

    let motivo = null;
    if (n && cNif && cNif === n) motivo = "mismo NIF/CIF";
    else if (t && cTel && cTel === t) motivo = "mismo teléfono";
    else if (nom.length > 4 && cNom.length > 4) {
      const cPalabras = cNom.split(" ").filter((p) => p.length > 2);
      const comunes = palabras.filter((p) => cPalabras.includes(p)).length;
      const similitud =
        (2 * comunes) / (palabras.length + cPalabras.length || 1);
      const longitudSimilar =
        Math.abs(nom.length - cNom.length) <= Math.max(nom.length, cNom.length) * 0.25;
      if (comunes >= 2 && similitud >= 0.5 && longitudSimilar) {
        motivo = "nombre muy parecido";
      }
    }

    if (motivo) {
      const clave = String(c._id);
      const prev = encontrados.get(clave);
      if (!prev || prev.peso < (motivo === "mismo NIF/CIF" ? 3 : motivo === "mismo teléfono" ? 2 : 1)) {
        encontrados.set(clave, { cliente: c, motivo, peso: motivo === "mismo NIF/CIF" ? 3 : motivo === "mismo teléfono" ? 2 : 1 });
      }
    }
  }

  return Array.from(encontrados.values())
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 3);
}

/** Modal de alta/edición de cita del servicio técnico (SAT). */
export default function CitaModalServicio({ cita, fechaInicial, onCerrar, onGuardada }) {
  const [clientes, setClientes] = useState([]);
  const [aparatos, setAparatos] = useState([]);
  const [form, setForm] = useState({
    fecha: cita ? aFechaInput(cita.fecha) : fechaInicial,
    hora: cita?.hora ?? "07:00",
    horaFin: cita ? aHora(aMinutos(cita.hora) + (cita.duracion ?? 60)) : "10:00",
    cliente: cita?.cliente?._id ?? cita?.cliente ?? "",
    clienteNombre: cita?.clienteNombre ?? "",
    telefono: cita?.telefono ?? "",
    email: cita?.email ?? "",
    nif: cita?.nif ?? "",
    whatsappAutorizado: cita?.whatsappAutorizado ?? false,
    aparato: cita?.aparato?._id ?? cita?.aparato ?? "",
    aparatoDescripcion: cita?.aparatoDescripcion ?? "",
    // La cita no guarda el lugar: se deduce de si tiene dirección.
    lugar: cita?.direccion ? "domicilio" : "tienda",
    direccion: cita?.direccion ?? "",
    motivo: cita?.motivo ?? "",
    presupuesto: cita?.presupuesto ?? true,
    estado: cita?.estado ?? "pendiente",
    notas: cita?.notas ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  // Posibles duplicados al escribir un cliente nuevo.
  const [duplicados, setDuplicados] = useState([]);

  useEffect(() => {
    cargarClientesLigeros().then(setClientes);
    fetch("/api/servicio/aparatos")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAparatos)
      .catch(() => setAparatos([]));
  }, []);

  // Detectar posibles duplicados mientras se escribe un cliente nuevo.
  useEffect(() => {
    if (form.cliente) {
      setDuplicados([]);
      return;
    }
    const resultado = buscarDuplicadosClientes(clientes, {
      nombre: form.clienteNombre,
      telefono: form.telefono,
      nif: form.nif,
    });
    setDuplicados(resultado);
  }, [clientes, form.cliente, form.clienteNombre, form.telefono, form.nif]);

  function actualizar(nombre, valor) {
    setForm((f) => ({ ...f, [nombre]: valor }));
  }

  // Elegir de la cartera rellena nombre y teléfono; si la cita es a
  // domicilio también precarga la dirección del cliente. Vale texto libre.
  function elegirCliente(op) {
    if (!op) return;
    setForm((f) => ({
      ...f,
      cliente: String(op._id),
      clienteNombre: op.nombre,
      telefono: op.telefono ?? f.telefono,
      email: op.email ?? f.email,
      nif: op.nif ?? f.nif,
      whatsappAutorizado: op.comunicaciones?.whatsapp?.autorizado ?? false,
      direccion: f.lugar === "domicilio" ? dirTexto(op.direccion) || f.direccion : f.direccion,
    }));
  }

  // Si se retoca el nombre a mano tras elegirlo, se desvincula el cliente.
  function textoCliente(t) {
    setForm((f) => ({ ...f, clienteNombre: t, cliente: "", whatsappAutorizado: false }));
  }

  // Selector de aparato dado de alta: "marca modelo · S/N …" con código y
  // cliente debajo; también vale texto libre si no está dado de alta.
  const opcionesAparatos = aparatos.map((a) => ({
    _id: a._id,
    nombre: describirAparato(a),
    secundario: [a.codigo, a.clienteNombre].filter(Boolean).join(" · ") || undefined,
  }));

  // Al elegir un aparato se guardan su id y su descripción, y se rellenan
  // cliente y teléfono si estaban vacíos.
  function elegirAparato(op) {
    if (!op) return;
    const a = aparatos.find((x) => String(x._id) === String(op._id));
    const cli = clientes.find((c) => String(c._id) === String(a?.cliente) || c.nombre === a?.clienteNombre);
    setForm((f) => ({
      ...f,
      aparato: String(op._id),
      aparatoDescripcion: op.nombre,
      cliente: f.cliente || (a?.cliente ? String(a.cliente) : f.cliente),
      clienteNombre: f.clienteNombre || a?.clienteNombre || f.clienteNombre,
      telefono: f.telefono || cli?.telefono || f.telefono,
      whatsappAutorizado: f.whatsappAutorizado || cli?.comunicaciones?.whatsapp?.autorizado || false,
      direccion: f.lugar === "domicilio" ? f.direccion || dirTexto(cli?.direccion) : f.direccion,
    }));
  }

  // Texto libre de aparato: si se edita a mano lo elegido, se desvincula.
  function textoAparato(t) {
    setForm((f) => ({ ...f, aparatoDescripcion: t, aparato: f.aparatoDescripcion === t ? f.aparato : "" }));
  }

  // Lugar del servicio: al pasar a domicilio se precarga la dirección del
  // cliente elegido (editable después).
  function elegirLugar(v) {
    setForm((f) => {
      if (v !== "domicilio") return { ...f, lugar: v };
      const cli = clientes.find((c) => String(c._id) === String(f.cliente));
      return { ...f, lugar: v, direccion: f.direccion || dirTexto(cli?.direccion) };
    });
  }

  async function guardar(e) {
    e.preventDefault();
    const duracion = aMinutos(form.horaFin) - aMinutos(form.hora);
    if (duracion <= 0) {
      setError("La hora de fin debe ser posterior a la de inicio");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      // Datos efectivos de cliente: si no se ha elegido uno de la cartera
      // pero se ha escrito un nombre, damos de alta al cliente automáticamente
      // al guardar la cita. Si no hay teléfono no se crea la ficha, pero el
      // nombre y teléfono escritos viajan con la cita para no perderlos nunca.
      let clienteId = form.cliente;
      let clienteNombre = (form.clienteNombre || "").trim();
      let telefono = (form.telefono || "").trim();
      if (!clienteId && clienteNombre && telefono) {
        try {
          const ra = await fetch("/api/clientes/rapido", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nombre: clienteNombre,
              telefono,
              email: form.email?.trim() || undefined,
              nif: form.nif?.trim() || undefined,
              exigirTelefono: true,
            }),
          });
          const da = await ra.json();
          if (!ra.ok || !da?._id) throw new Error(da?.error || "No se pudo dar de alta el cliente");
          invalidarClientesLigeros();
          setClientes((l) => [da, ...l]);
          clienteId = da._id;
          clienteNombre = da.nombre;
          telefono = da.telefono ?? telefono;
        } catch {
          // El alta falló (p. ej. teléfono duplicado): conservamos lo
          // escrito para que la cita no quede vacía.
        }
      }
      const r = await fetch(`/api/servicio/citas${cita ? `/${cita._id}` : ""}`, {
        method: cita ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cliente: clienteId || null,
          clienteNombre,
          telefono,
          duracion,
          horaFin: undefined,
          aparato: form.aparato || null,
          aparatoDescripcion: form.aparatoDescripcion || undefined,
          direccion: form.lugar === "domicilio" ? form.direccion : "",
          presupuesto: Boolean(form.presupuesto),
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo guardar la cita");
      onGuardada();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!window.confirm("¿Borrar esta cita?")) return;
    const r = await fetch(`/api/servicio/citas/${cita._id}`, { method: "DELETE" });
    if (r.ok) onGuardada();
    else alert("No se pudo borrar");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4 flex flex-wrap items-center gap-3">
          {cita ? `Cita ${aFechaInput(cita.fecha)} ${cita.hora}` : "Nueva cita"}
          {cita && (
            <EnviarWhatsApp
              telefono={cita.telefono}
              cliente={cita.cliente?._id ?? cita.cliente}
              clienteNombre={cita.clienteNombre}
              tipo="cliente"
              id={cita._id}
            />
          )}
        </h2>
        <form onSubmit={guardar} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Fecha *</label>
              <input
                type="date"
                className={campo}
                value={form.fecha}
                onChange={(e) => actualizar("fecha", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">De *</label>
              <input
                type="time"
                className={campo}
                value={form.hora}
                onChange={(e) => actualizar("hora", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">A *</label>
              <input
                type="time"
                className={campo}
                value={form.horaFin}
                onChange={(e) => actualizar("horaFin", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-sm text-slate-400 block mb-1">Buscar cliente en la cartera</label>
              <BuscadorEntidad
                opciones={clientes}
                valorId={form.cliente}
                valorTexto={form.clienteNombre}
                onTexto={textoCliente}
                onElegir={elegirCliente}
                placeholder="Escribe nombre, teléfono o NIF…"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">
                {form.cliente ? "Nombre del cliente" : "Nombre del cliente *"}
              </label>
              <input
                className={campo}
                value={form.clienteNombre}
                onChange={(e) => setForm((f) => ({ ...f, clienteNombre: e.target.value, cliente: "" }))}
                placeholder={form.cliente ? "Cliente seleccionado de la cartera" : "Nombre completo"}
                required={!form.cliente}
              />
              {!form.cliente && form.clienteNombre.trim() && (
                <p className="text-[11px] text-teal-400 mt-1">
                  Cliente nuevo: se dará de alta al guardar si hay teléfono.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Teléfono</label>
              <input
                className={campo}
                value={form.telefono}
                onChange={(e) => actualizar("telefono", e.target.value)}
                placeholder="Obligatorio para dar de alta a un cliente nuevo"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Email</label>
              <input
                className={campo}
                type="email"
                value={form.email}
                onChange={(e) => actualizar("email", e.target.value)}
                placeholder="cliente@ejemplo.com"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">CIF / NIF</label>
              <input
                className={campo}
                value={form.nif}
                onChange={(e) => actualizar("nif", e.target.value.toUpperCase())}
                placeholder="Evita duplicados si ya existe"
              />
            </div>

            {duplicados.length > 0 && (
              <div className="sm:col-span-2 rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-800">
                  Parece que este cliente ya existe en la cartera
                </p>
                {duplicados.map(({ cliente: c, motivo }) => (
                  <div key={c._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-white p-2 border border-amber-200">
                    <div className="text-sm text-slate-700">
                      <span className="font-semibold">{c.nombre}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-xs text-slate-500">{motivo}</span>
                      {(c.telefono || c.nif || c.email) && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {[c.telefono, c.nif, c.email].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => elegirCliente({ _id: c._id, nombre: c.nombre, telefono: c.telefono, email: c.email, nif: c.nif, comunicaciones: c.comunicaciones })}
                      className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition"
                    >
                      Usar este cliente
                    </button>
                  </div>
                ))}
                <p className="text-xs text-amber-700">
                  Si ninguno es el correcto, continúa escribiendo y se creará uno nuevo al guardar.
                </p>
              </div>
            )}

            <div>
              <label className="text-sm text-slate-400 block mb-1">Aparato</label>
              <BuscadorEntidad
                opciones={opcionesAparatos}
                valorTexto={form.aparatoDescripcion}
                onTexto={textoAparato}
                onElegir={elegirAparato}
                placeholder="Buscar por marca, modelo o S/N…"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Estado</label>
              <select
                className={campo}
                value={form.estado}
                onChange={(e) => actualizar("estado", e.target.value)}
              >
                {ESTADOS_CITA.map((est) => (
                  <option key={est.clave} value={est.clave}>{est.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Lugar</label>
              <div className="flex rounded-lg overflow-hidden border border-white/10 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => elegirLugar("tienda")}
                  className={`flex-1 px-3 py-2.5 transition-colors ${
                    form.lugar === "tienda" ? "bg-accent/15 text-accent" : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  En tienda
                </button>
                <button
                  type="button"
                  onClick={() => elegirLugar("domicilio")}
                  className={`flex-1 px-3 py-2.5 transition-colors ${
                    form.lugar === "domicilio" ? "bg-accent/15 text-accent" : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  A domicilio
                </button>
              </div>
            </div>
            {form.lugar === "domicilio" && (
              <div>
                <label className="text-sm text-slate-400 block mb-1">Dirección de la intervención</label>
                <input
                  className={campo}
                  value={form.direccion}
                  onChange={(e) => actualizar("direccion", e.target.value)}
                  placeholder="Calle, CP, ciudad…"
                />
              </div>
            )}
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Motivo</label>
            <input
              className={campo}
              value={form.motivo}
              onChange={(e) => actualizar("motivo", e.target.value)}
              placeholder="No enciende, pantalla rota, limpieza de virus…"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.presupuesto}
              onChange={(e) => actualizar("presupuesto", e.target.checked)}
              className="accent-[#2ec4b6]"
            />
            Viene de presupuesto
          </label>
          <label className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.whatsappAutorizado}
              onChange={(e) => actualizar("whatsappAutorizado", e.target.checked)}
              className="accent-emerald-500 mt-0.5"
            />
            <span>
              El cliente autoriza recordatorios por WhatsApp
              <span className="block text-xs text-slate-500 mt-0.5">Confirmación al crear y recordatorio según Ajustes → WhatsApp.</span>
            </span>
          </label>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Notas</label>
            <input
              className={campo}
              value={form.notas}
              onChange={(e) => actualizar("notas", e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex justify-between gap-2 pt-2">
            <div className="flex items-center gap-4">
              {cita && (
                <button type="button" onClick={borrar} className="text-sm text-rose-400 hover:underline">
                  Borrar
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary disabled:opacity-50">
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
