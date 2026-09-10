import { useEffect, useState } from "react";
import { ESTADOS_CITA, aFechaInput, tonoEstadoValoracion, nombreEstadoValoracion } from "./datos.js";
import BuscadorEntidad from "../../components/BuscadorEntidad.jsx";
import ModalPrestamoCortesia from "./ModalPrestamoCortesia.jsx";
import AltaRapidaCliente from "../../components/AltaRapidaCliente.jsx";
import EnviarWhatsApp from "../../components/EnviarWhatsApp.jsx";
import { imprimirHojaEntrada } from "../../components/MenuImprimirOrden.jsx";

const CLASES_PILL_ESTADO = {
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  cyan: "bg-sky-100 text-sky-700 border-sky-200",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
  red: "bg-rose-100 text-rose-700 border-rose-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

const campo = "input w-full";
const fechaEs = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "");
const dirTexto = (d) => [d?.calle, d?.cp, d?.ciudad, d?.provincia].filter(Boolean).join(", ");

function hojaEntradaHtml(emp, cita, cliente, vehiculo) {
  const hoy = fechaEs(cita.fecha);
  const manana = new Date(cita.fecha);
  manana.setDate(manana.getDate() + 1);
  return `
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Hoja de entrada en taller</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; }
  .caja { border: 1px solid #333; border-radius: 6px; padding: 10px; margin-bottom: 10px; }
  .titulo { font-weight: bold; font-size: 13pt; text-align: center; margin-bottom: 6px; }
  .fila { display: flex; gap: 10px; margin-bottom: 5px; }
  .col { flex: 1; }
  .label { font-size: 9pt; color: #555; text-transform: uppercase; }
  .dato { font-weight: bold; }
  .motivo { min-height: 60px; border: 1px solid #333; border-radius: 4px; padding: 8px; margin-top: 4px; }
  .firmas { display: flex; gap: 20px; margin-top: 30px; }
  .firma { flex: 1; border-top: 1px solid #333; padding-top: 4px; text-align: center; font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #333; padding: 6px; font-size: 10pt; text-align: left; }
  th { background: #eee; }
</style>
</head>
<body>
  <div class="caja">
    <div class="titulo">HOJA DE ENTRADA EN TALLER</div>
    <div class="fila">
      <div class="col"><span class="label">Taller</span><div class="dato">${emp.nombre ?? ""}</div></div>
      <div class="col"><span class="label">CIF</span><div>${emp.nif ?? ""}</div></div>
      <div class="col"><span class="label">Fecha</span><div class="dato">${hoy}</div></div>
    </div>
    <div class="fila"><div class="col"><span class="label">Dirección</span><div>${dirTexto(emp.direccion)}</div></div></div>
    <div class="fila">
      <div class="col"><span class="label">Teléfono</span><div>${emp.telefono ?? ""}</div></div>
      <div class="col"><span class="label">Email</span><div>${emp.email ?? ""}</div></div>
    </div>
  </div>

  <div class="caja">
    <div class="fila">
      <div class="col"><span class="label">Cliente</span><div class="dato">${cliente?.nombre ?? cita.clienteNombre ?? ""}</div></div>
      <div class="col"><span class="label">Teléfono</span><div>${cita.telefono || cliente?.telefono || ""}</div></div>
      <div class="col"><span class="label">CIF/NIF</span><div>${cliente?.nif ?? ""}</div></div>
    </div>
    <div class="fila"><div class="col"><span class="label">Dirección</span><div>${dirTexto(cliente?.direccion)}</div></div></div>
  </div>

  <div class="caja">
    <div class="fila">
      <div class="col"><span class="label">Matrícula</span><div class="dato">${cita.matricula ?? ""}</div></div>
      <div class="col"><span class="label">Marca</span><div>${vehiculo?.marca ?? ""}</div></div>
      <div class="col"><span class="label">Modelo</span><div>${vehiculo?.modelo ?? ""}</div></div>
    </div>
    <div class="fila">
      <div class="col"><span class="label">Bastidor</span><div>${vehiculo?.bastidor ?? ""}</div></div>
      <div class="col"><span class="label">KM</span><div>${vehiculo?.km != null ? Number(vehiculo.km).toLocaleString("es-ES") : ""}</div></div>
      <div class="col"><span class="label">Combustible</span><div>${vehiculo?.combustible ?? ""}</div></div>
    </div>
  </div>

  <div class="caja">
    <span class="label">Trabajos solicitados / motivo</span>
    <div class="motivo">${[cita.motivo, cita.notas].filter(Boolean).join(". ") || "—"}</div>
  </div>

  <div class="caja">
    <div class="fila">
      <div class="col"><span class="label">Fecha de entrada</span><div class="dato">${hoy}</div></div>
      <div class="col"><span class="label">Fecha prevista de entrega</span><div class="dato">${fechaEs(manana)}</div></div>
      <div class="col"><span class="label">Cita</span><div>${cita.de ? cita.de.slice(0,5) : ""} - ${cita.a ? cita.a.slice(0,5) : ""}</div></div>
    </div>
  </div>

  <table>
    <thead><tr><th>Descripción</th><th style="width:80px">Sí</th><th style="width:80px">No</th></tr></thead>
    <tbody>
      <tr><td>El vehículo se entrega con llaves y documentación</td><td></td><td></td></tr>
      <tr><td>Objetos de valor personales retirados</td><td></td><td></td></tr>
      <tr><td>Estado general del vehículo revisado</td><td></td><td></td></tr>
    </tbody>
  </table>

  <div class="firmas">
    <div class="firma">Firma del cliente</div>
    <div class="firma">Firma del taller</div>
  </div>
</body>
</html>`;
}

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

export default function CitaModal({ cita, fechaInicial, onCerrar, onGuardada, onRecepcionar }) {
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [aseguradoras, setAseguradoras] = useState([]);
  const [valoraciones, setValoraciones] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [prestamo, setPrestamo] = useState(null); // préstamo activo de cortesía
  const [altaVehiculo, setAltaVehiculo] = useState(false);
  const [form, setForm] = useState({
    fecha: cita ? aFechaInput(cita.fecha) : fechaInicial,
    hora: cita?.hora ?? "07:00",
    horaFin: cita ? aHora(aMinutos(cita.hora) + (cita.duracion ?? 60)) : "10:00",
    cliente: cita?.cliente?._id ?? cita?.cliente ?? "",
    clienteNombre: cita?.clienteNombre ?? "",
    telefono: cita?.telefono ?? "",
    whatsappAutorizado: cita?.whatsappAutorizado ?? false,
    matricula: cita?.matricula ?? "",
    motivo: cita?.motivo ?? "",
    presupuesto: cita?.presupuesto ?? true,
    aseguradora: cita?.aseguradora?._id ?? cita?.aseguradora ?? "",
    aseguradoraNombre: cita?.aseguradoraNombre ?? "",
    cortesia: cita?.cortesia ?? false,
    cortesiaVehiculo: cita?.cortesiaVehiculo?._id ?? cita?.cortesiaVehiculo ?? "",
    estado: cita?.estado ?? "pendiente",
    notas: cita?.notas ?? "",
  });
  const [cortesiaAbierta, setCortesiaAbierta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .catch(() => setClientes([]));
    fetch("/api/taller/vehiculos")
      .then((r) => (r.ok ? r.json() : []))
      .then(setVehiculos)
      .catch(() => setVehiculos([]));
    fetch("/api/taller/aseguradoras")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAseguradoras)
      .catch(() => setAseguradoras([]));
    fetch("/api/taller/valoraciones")
      .then((r) => (r.ok ? r.json() : []))
      .then(setValoraciones)
      .catch(() => setValoraciones([]));
    fetch("/api/taller/cortesia")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPrestamos)
      .catch(() => setPrestamos([]));
  }, []);

  // Préstamo de cortesía activo de esta cita (por vínculo o por cliente).
  useEffect(() => {
    if (!prestamos.length) { setPrestamo(null); return; }
    const activos = prestamos.filter((p) => p.estado === "activo");
    const deLaCita = cita && activos.find((p) => String(p.cita) === String(cita._id));
    const delCliente = activos.find((p) => p.clienteNombre && p.clienteNombre === form.clienteNombre);
    setPrestamo(deLaCita ?? delCliente ?? null);
  }, [prestamos, cita, form.clienteNombre]);

  function actualizar(nombre, valor) {
    setForm((f) => ({ ...f, [nombre]: valor }));
  }

  // Elegir de la cartera rellena nombre y teléfono; también vale texto libre.
  function elegirCliente(op) {
    if (!op) return;
    setForm((f) => ({
      ...f,
      cliente: op._id,
      clienteNombre: op.nombre,
      telefono: op.telefono ?? f.telefono,
      whatsappAutorizado: op.comunicaciones?.whatsapp?.autorizado ?? false,
    }));
  }

  // Búsqueda por matrícula: al elegir un vehículo se rellenan cliente y
  // teléfono si estaban vacíos.
  const opcionesVehiculos = vehiculos.map((v) => ({
    _id: v._id,
    nombre: v.matricula,
    secundario: [v.clienteNombre, v.marca, v.modelo].filter(Boolean).join(" · ") || undefined,
  }));

  function elegirVehiculo(op) {
    if (!op) return;
    const v = vehiculos.find((x) => String(x._id) === String(op._id));
    const cli = clientes.find((c) => String(c._id) === String(v?.cliente) || c.nombre === v?.clienteNombre);
    setForm((f) => ({
      ...f,
      matricula: op.nombre,
      cliente: f.cliente || cli?._id || "",
      clienteNombre: f.clienteNombre || v?.clienteNombre || f.clienteNombre,
      telefono: f.telefono || cli?.telefono || f.telefono,
      whatsappAutorizado: f.whatsappAutorizado || cli?.comunicaciones?.whatsapp?.autorizado || false,
    }));
  }

  function elegirAseguradora(op) {
    setForm((f) => ({
      ...f,
      aseguradora: op?._id ?? "",
      aseguradoraNombre: op?.nombre ?? "",
    }));
  }

  // Alta rápida del vehículo sin salir de la cita (matrícula ya escrita).
  async function crearVehiculoRapido(datos) {
    const r = await fetch("/api/taller/vehiculos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matricula: form.matricula,
        marca: datos.marca || undefined,
        modelo: datos.modelo || undefined,
        cliente: form.cliente || undefined,
        clienteNombre: form.clienteNombre || undefined,
      }),
    });
    const creado = await r.json();
    if (!r.ok) throw new Error(creado.error || "No se pudo crear el vehículo");
    setVehiculos((l) => [...l, creado]);
    setAltaVehiculo(false);
  }

  const matriculaExiste = vehiculos.some((v) => v.matricula?.toUpperCase() === form.matricula?.toUpperCase());
  // Valoraciones del vehículo de la cita (o las de la cita ya cargada).
  const valoracionesCita = (cita?.valoraciones?.length ? cita.valoraciones : valoraciones)
    .filter((v) => v.matricula?.toUpperCase() === form.matricula?.toUpperCase());
  // Coches de cortesía libres para la reserva desde la cita.
  const ocupados = new Set(prestamos.filter((p) => p.estado === "activo").map((p) => String(p.vehiculo)));
  const cortesiaLibres = vehiculos.filter((v) => v.tipo === "cortesia" && !ocupados.has(String(v._id)));

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
      const cortesiaVeh = vehiculos.find((v) => String(v._id) === String(form.cortesiaVehiculo));
      const r = await fetch(`/api/taller/citas${cita ? `/${cita._id}` : ""}`, {
        method: cita ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          duracion,
          horaFin: undefined,
          matricula: form.matricula || undefined,
          presupuesto: Boolean(form.presupuesto),
          aseguradora: form.aseguradora || null,
          cortesia: Boolean(form.cortesia),
          cortesiaVehiculo: form.cortesia ? (form.cortesiaVehiculo || null) : null,
          cortesiaMatricula: form.cortesia ? (cortesiaVeh?.matricula || undefined) : null,
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

  async function imprimirEntrada() {
    if (!cita) return;
    const cliente = clientes.find((c) => String(c._id) === String(cita.cliente?._id ?? cita.cliente)) || cita.cliente;
    const vehiculo = vehiculos.find((v) => v.matricula?.toUpperCase() === (cita.matricula ?? "").toUpperCase());

    const manana = new Date(cita.fecha);
    manana.setDate(manana.getDate() + 1);

    const ok = await imprimirHojaEntrada({
      numero: `CITA-${cita._id.slice(-6).toUpperCase()}`,
      fechaEntrada: cita.fecha,
      fechaEntregaPrevista: manana.toISOString().slice(0, 10),
      matricula: cita.matricula ?? "",
      km: vehiculo?.km ?? "",
      motivo: [cita.motivo, cita.notas].filter(Boolean).join(". ") || "Recepción desde cita",
      aseguradora: vehiculo?.aseguradora?.nombre ?? "",
      cliente: cliente || undefined,
      clienteNombre: cita.clienteNombre || cliente?.nombre || "",
      telefono: cita.telefono || cliente?.telefono || "",
      vehiculo: vehiculo ? { marca: vehiculo.marca, modelo: vehiculo.modelo } : undefined,
      lineas: [],
    });

    // Si no hay plantilla configurada, se imprime un resguardo básico para que
    // nunca se quede sin documento.
    if (!ok) {
      const emp = await fetch("/api/empresa").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
      const html = hojaEntradaHtml(emp, cita, cliente, vehiculo);
      const ventana = window.open("", "_blank", "width=900,height=700");
      if (!ventana) return alert("Permite las ventanas emergentes para imprimir");
      ventana.document.write(html);
      ventana.document.close();
      ventana.focus();
      setTimeout(() => ventana.print(), 250);
    }
  }

  async function borrar() {
    if (!window.confirm("¿Borrar esta cita?")) return;
    const r = await fetch(`/api/taller/citas/${cita._id}`, { method: "DELETE" });
    if (r.ok) onGuardada();
    else alert("No se pudo borrar");
  }

  return (
    <>
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
        {cita && onRecepcionar && !["realizada", "cancelada"].includes(cita.estado) && (
          <button
            type="button"
            onClick={() => onRecepcionar(cita)}
            className="w-full mb-3 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white hover:bg-accent/90 transition"
          >
            Recepcionar ahora
            <span className="block text-[0.6875rem] font-normal text-white/80 mt-0.5">
              Ha llegado el cliente: abrir la recepción rápida con esta cita
            </span>
          </button>
        )}
        {cita && cita.matricula && (
          <button
            type="button"
            onClick={imprimirEntrada}
            className="w-full mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-900 hover:bg-white transition border border-slate-300"
          >
            Imprimir hoja de entrada
            <span className="block text-[0.6875rem] font-normal text-slate-600 mt-0.5">
              Documento oficial de entrada en taller, sin crear aún la orden
            </span>
          </button>
        )}
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
            <div>
              <label className="text-sm text-slate-400 block mb-1">Cliente</label>
              <BuscadorEntidad
                opciones={clientes}
                valorTexto={form.clienteNombre}
                onTexto={(t) => setForm((f) => ({ ...f, clienteNombre: t, cliente: "" }))}
                onElegir={elegirCliente}
                placeholder="Buscar en la cartera o escribir…"
              />
              <div className="mt-1">
                <AltaRapidaCliente
                  nombreInicial={form.clienteNombre}
                  telefonoInicial={form.telefono}
                  onCreado={(c) => {
                    setClientes((l) => [c, ...l]);
                    setForm((f) => ({
                      ...f,
                      cliente: c._id,
                      clienteNombre: c.nombre,
                      telefono: c.telefono ?? f.telefono,
                      whatsappAutorizado: c.comunicaciones?.whatsapp?.autorizado ?? false,
                    }));
                  }}
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Teléfono</label>
              <input
                className={campo}
                value={form.telefono}
                onChange={(e) => actualizar("telefono", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Matrícula</label>
              <BuscadorEntidad
                opciones={opcionesVehiculos}
                valorTexto={form.matricula}
                onTexto={(t) => actualizar("matricula", t.toUpperCase())}
                onElegir={elegirVehiculo}
                placeholder="Buscar por matrícula…"
              />
              {form.matricula && !matriculaExiste && !altaVehiculo && (
                <button
                  type="button"
                  onClick={() => setAltaVehiculo(true)}
                  className="mt-1 text-xs font-semibold text-teal-300 hover:text-teal-200"
                  title="Dar de alta este vehículo en el taller sin salir de la cita"
                >
                  + Alta de vehículo
                </button>
              )}
              {altaVehiculo && (
                <AltaRapidaVehiculo
                  matricula={form.matricula}
                  onCrear={crearVehiculoRapido}
                  onCancelar={() => setAltaVehiculo(false)}
                />
              )}
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

          {/* Compañía de seguros (si la reparación va por aseguradora) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Por compañía de seguros</label>
              <BuscadorEntidad
                opciones={aseguradoras}
                valorId={form.aseguradora}
                onElegir={elegirAseguradora}
                placeholder="Particular (sin compañía)…"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Coche de cortesía</label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none h-[2.625rem]">
                <input
                  type="checkbox"
                  checked={form.cortesia}
                  onChange={(e) => actualizar("cortesia", e.target.checked)}
                  className="accent-[#2ec4b6]"
                />
                Reservar cortesía
              </label>
            </div>
          </div>
          {form.cortesia && (
            <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[12rem]">
                  <label className="text-xs text-slate-400 block mb-1">Vehículo asignado</label>
                  <select
                    className={campo}
                    value={form.cortesiaVehiculo}
                    onChange={(e) => actualizar("cortesiaVehiculo", e.target.value)}
                  >
                    <option value="">— Sin asignar todavía —</option>
                    {cortesiaLibres.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.matricula}{[v.marca, v.modelo].filter(Boolean).length ? ` · ${[v.marca, v.modelo].filter(Boolean).join(" ")}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setCortesiaAbierta(true)}
                  className="text-xs font-semibold text-teal-300 hover:underline self-end pb-2"
                  title="Registrar el préstamo ya (contrato y control de devolución)"
                >
                  Registrar préstamo
                </button>
              </div>
              {cortesiaLibres.length === 0 && (
                <p className="text-xs text-amber-300">No hay coches de cortesía libres ahora mismo.</p>
              )}
            </div>
          )}
          {prestamo && (
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs text-teal-200">
              Cortesía activa: <b>{prestamo.matricula}</b> · devolución prevista {fechaEs(prestamo.fechaPrevista)}
            </div>
          )}

          {/* Valoraciones del vehículo (mismo pill de estado que Taller → Valoraciones) */}
          {valoracionesCita.length > 0 && (
            <div className="rounded-xl border border-slate-300 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Valoraciones de este vehículo
              </p>
              <ul className="space-y-1">
                {valoracionesCita.map((v) => (
                  <li key={v._id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold text-slate-800 num">{v.numero}</span>
                    <span className="text-slate-500">{v.compania || "particular"}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${CLASES_PILL_ESTADO[tonoEstadoValoracion(v.estado)] ?? CLASES_PILL_ESTADO.slate}`}>
                      {nombreEstadoValoracion(v.estado)}
                    </span>
                    {v.total > 0 && (
                      <span className="ml-auto font-semibold text-slate-800 num">
                        {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v.total)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="text-sm text-slate-400 block mb-1">Motivo</label>
            <input
              className={campo}
              value={form.motivo}
              onChange={(e) => actualizar("motivo", e.target.value)}
              placeholder="Revisión, golpe aleta, ITV…"
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

    {cortesiaAbierta && (
      <ModalPrestamoCortesia
        inicial={{
          clienteNombre: form.clienteNombre,
          telefono: form.telefono,
          fechaPrevista: form.fecha,
          citaId: cita?._id,
        }}
        onCerrar={() => setCortesiaAbierta(false)}
        onCreado={() => setCortesiaAbierta(false)}
      />
    )}
    </>
  );
}

// Alta mínima del vehículo desde la cita: marca y modelo; la matrícula y el
// cliente ya están en el formulario de la cita. El resto de la ficha (bastidor,
// combustible…) se completa después desde Taller → Vehículos.
function AltaRapidaVehiculo({ matricula, onCrear, onCancelar }) {
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function crear() {
    setGuardando(true);
    setError(null);
    try {
      await onCrear({ marca: marca.trim(), modelo: modelo.trim() });
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-2">
      <p className="text-xs text-slate-400">
        Alta rápida de <b className="text-slate-200">{matricula}</b>. Bastidor y demás datos, luego en Vehículos.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input
          className="input w-full"
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          placeholder="Marca"
          autoFocus
        />
        <input
          className="input w-full"
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          placeholder="Modelo"
        />
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={crear} disabled={guardando} className="btn-primary text-xs px-3 py-1.5">
          {guardando ? "Creando…" : "Crear vehículo"}
        </button>
        <button type="button" onClick={onCancelar} className="btn-ghost text-xs px-3 py-1.5">
          Cancelar
        </button>
      </div>
    </div>
  );
}
