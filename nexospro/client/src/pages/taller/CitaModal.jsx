import { useEffect, useState } from "react";
import { ESTADOS_CITA, aFechaInput, tonoEstadoValoracion, nombreEstadoValoracion } from "./datos.js";
import BuscadorEntidad from "../../components/BuscadorEntidad.jsx";
import ModalPrestamoCortesia from "./ModalPrestamoCortesia.jsx";
import AltaRapidaCliente from "../../components/AltaRapidaCliente.jsx";
import EnviarWhatsApp from "../../components/EnviarWhatsApp.jsx";
import { imprimirHojaEntrada } from "../../components/MenuImprimirOrden.jsx";
import { imprimirJustificanteCitaTaller } from "../../utils/imprimir-cita-taller.js";
import { cargarClientesLigeros, invalidarClientesLigeros } from "../../lib/clientesLigeros.js";

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
  // Solo si el taller la ha indicado en la cita; nunca se inventa.
  const entrega = fechaEs(cita.entregaPrevista);
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

  ${cita.aseguradoraNombre || cita.numeroSiniestro || Number(cita.franquicia) > 0 ? `
  <div class="caja">
    <div class="fila">
      <div class="col"><span class="label">Compañía</span><div class="dato">${cita.aseguradoraNombre || ""}</div></div>
      <div class="col"><span class="label">Siniestro</span><div class="dato">${cita.numeroSiniestro || ""}</div></div>
      <div class="col"><span class="label">Franquicia a cargo del cliente</span><div class="dato">${Number(cita.franquicia) > 0 ? `${Number(cita.franquicia).toFixed(2)} € (IVA incluido)` : ""}</div></div>
    </div>
  </div>` : ""}

  <div class="caja">
    <div class="fila">
      <div class="col"><span class="label">Fecha de entrada</span><div class="dato">${hoy}</div></div>
      <div class="col"><span class="label">Fecha prevista de entrega</span><div class="dato">${entrega}</div></div>
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

export default function CitaModal({ cita, fechaInicial, tipoInicial, onCerrar, onGuardada, onRecepcionar }) {
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [aseguradoras, setAseguradoras] = useState([]);
  const [valoraciones, setValoraciones] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [textoLocalizar, setTextoLocalizar] = useState("");
  const [prestamos, setPrestamos] = useState([]);
  const [prestamo, setPrestamo] = useState(null); // préstamo activo de cortesía
  const [form, setForm] = useState({
    fecha: cita ? aFechaInput(cita.fecha) : fechaInicial,
    hora: cita?.hora ?? "07:00",
    horaFin: cita ? aHora(aMinutos(cita.hora) + (cita.duracion ?? 60)) : "10:00",
    entregaPrevista: cita?.entregaPrevista ? aFechaInput(cita.entregaPrevista) : "",
    cliente: cita?.cliente?._id ?? cita?.cliente ?? "",
    clienteNombre: cita?.clienteNombre ?? "",
    telefono: cita?.telefono ?? "",
    whatsappAutorizado: cita?.whatsappAutorizado ?? false,
    matricula: cita?.matricula ?? "",
    marca: "",
    modelo: "",
    vehiculoNuevo: false,
    motivo: cita?.motivo ?? "",
    tipo: cita?.tipo ?? tipoInicial ?? "normal",
    numeroSiniestro: cita?.numeroSiniestro ?? "",
    franquicia: cita?.franquicia ?? "",
    // Siempre marcada al abrir la cita: el cliente quiere ver de entrada
    // la valoración y el presupuesto del vehículo sin tener que señalarla.
    presupuesto: true,
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
  const [conflictoVehiculo, setConflictoVehiculo] = useState(null);
  const [reasignarCliente, setReasignarCliente] = useState(false);
  // Peritación adjunta: documentos ya guardados (cita existente) y el
  // archivo elegido cuando la cita aún es nueva (se sube tras guardar).
  const [adjuntos, setAdjuntos] = useState(cita?.adjuntos ?? []);
  const [adjuntoPendiente, setAdjuntoPendiente] = useState(null);
  const [subiendoAdjunto, setSubiendoAdjunto] = useState(false);
  // Diálogo de la hoja de entrada: escribir/corregir la descripción de la
  // avería justo antes de imprimir (queda guardada en la cita).
  const [dialogoEntrada, setDialogoEntrada] = useState(false);
  const [textoEntrada, setTextoEntrada] = useState("");
  const [imprimiendoEntrada, setImprimiendoEntrada] = useState(false);
  // Reparaciones a realizar: salen en la tabla de la hoja de entrada
  // (descripción / mano de obra / materiales) y se guardan con la cita.
  const [lineasEntrada, setLineasEntrada] = useState(cita?.lineas ?? []);
  // Borrador del alta rápida de cliente: si el usuario rellena "Cliente
  // nuevo" pero no pulsa "Dar de alta", sus datos se usan al guardar la
  // cita en vez de perderse en silencio.
  const [borradorAlta, setBorradorAlta] = useState({ abierto: false, nombre: "", telefono: "" });

  useEffect(() => {
    cargarClientesLigeros().then(setClientes);
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
    fetch("/api/presupuestos")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPresupuestos)
      .catch(() => setPresupuestos([]));
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
    if (nombre === "matricula" || nombre === "cliente") {
      setReasignarCliente(false);
    }
    setForm((f) => ({ ...f, [nombre]: valor }));
  }

  // Detectar si la matrícula introducida ya pertenece a otro cliente.
  useEffect(() => {
    const mat = (form.matricula ?? "").toString().trim().toUpperCase();
    if (!mat) {
      setConflictoVehiculo(null);
      return;
    }
    const v = vehiculos.find((x) => x.matricula?.toUpperCase() === mat && x.tipo !== "cortesia");
    if (v && v.cliente && String(v.cliente) !== String(form.cliente)) {
      setConflictoVehiculo(v);
    } else {
      setConflictoVehiculo(null);
    }
  }, [form.matricula, form.cliente, vehiculos]);

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
    setReasignarCliente(false);
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
      marca: v?.marca ?? f.marca,
      modelo: v?.modelo ?? f.modelo,
      cliente: f.cliente || cli?._id || "",
      clienteNombre: f.clienteNombre || v?.clienteNombre || f.clienteNombre,
      telefono: f.telefono || cli?.telefono || f.telefono,
      whatsappAutorizado: f.whatsappAutorizado || cli?.comunicaciones?.whatsapp?.autorizado || false,
    }));
    setReasignarCliente(false);
  }

  function elegirAseguradora(op) {
    setForm((f) => ({
      ...f,
      aseguradora: op?._id ?? "",
      aseguradoraNombre: op?.nombre ?? "",
    }));
  }

  // Texto libre en la compañía: si deja de coincidir con la ficha elegida,
  // se suelta el id (el servidor la dará de alta al guardar).
  function escribirAseguradora(t) {
    setForm((f) => {
      const elegida = aseguradoras.find((a) => String(a._id) === String(f.aseguradora));
      return {
        ...f,
        aseguradoraNombre: t,
        aseguradora: elegida && elegida.nombre === t ? f.aseguradora : "",
      };
    });
  }

  const matriculaExiste = vehiculos.some((v) => v.matricula?.toUpperCase() === form.matricula?.toUpperCase());

  // Localizador al crear la cita: busca valoraciones (PER) y presupuestos
  // por número, matrícula, compañía o cliente y rellena la cita con ellos.
  const opcionesLocalizar = [
    ...valoraciones.map((v) => ({
      _id: `val-${v._id}`,
      nombre: `Valoración ${v.numero} · ${v.matricula}`,
      secundario: [v.compania || "particular", nombreEstadoValoracion(v.estado)].filter(Boolean).join(" · "),
      _tipo: "valoracion",
      _ref: v,
    })),
    ...presupuestos.map((p) => ({
      _id: `pto-${p._id}`,
      nombre: `Presupuesto ${p.serieNumero}`,
      secundario: [p.cliente?.nombre, p.estado].filter(Boolean).join(" · "),
      _tipo: "presupuesto",
      _ref: p,
    })),
  ];

  function elegirLocalizado(op) {
    if (!op) return;
    setTextoLocalizar(op.nombre);
    if (op._tipo === "valoracion") {
      const v = op._ref;
      // Como al elegir la matrícula a mano: también intenta rellenar cliente.
      const veh = vehiculos.find((x) => x.matricula?.toUpperCase() === v.matricula?.toUpperCase());
      const cli = clientes.find((c) => String(c._id) === String(veh?.cliente) || c.nombre === veh?.clienteNombre);
      setForm((f) => ({
        ...f,
        matricula: v.matricula,
        marca: veh?.marca ?? v.marca ?? f.marca,
        modelo: veh?.modelo ?? v.modelo ?? f.modelo,
        cliente: f.cliente || cli?._id || "",
        clienteNombre: f.clienteNombre || veh?.clienteNombre || f.clienteNombre,
        telefono: f.telefono || cli?.telefono || f.telefono,
        aseguradora: v.aseguradora?._id ?? v.aseguradora ?? f.aseguradora,
        aseguradoraNombre: v.compania ?? f.aseguradoraNombre,
        numeroSiniestro: v.numeroSiniestro ?? f.numeroSiniestro,
        motivo: f.motivo || `Valoración ${v.numero}${v.compania ? ` · ${v.compania}` : ""}`,
        presupuesto: true,
      }));
    } else {
      const p = op._ref;
      const cli = clientes.find((c) => String(c._id) === String(p.cliente?._id ?? p.cliente));
      setForm((f) => ({
        ...f,
        cliente: cli?._id ?? f.cliente,
        clienteNombre: cli?.nombre ?? p.cliente?.nombre ?? f.clienteNombre,
        telefono: f.telefono || cli?.telefono || p.cliente?.telefono || f.telefono,
        motivo: f.motivo || `Presupuesto ${p.serieNumero}`,
        presupuesto: true,
      }));
    }
  }
  // Valoraciones del vehículo de la cita (o las de la cita ya cargada).
  const valoracionesCita = (cita?.valoraciones?.length ? cita.valoraciones : valoraciones)
    .filter((v) => v.matricula?.toUpperCase() === form.matricula?.toUpperCase());
  // Coches de cortesía libres para la reserva desde la cita.
  const ocupados = new Set(prestamos.filter((p) => p.estado === "activo").map((p) => String(p.vehiculo)));
  const cortesiaLibres = vehiculos.filter((v) => v.tipo === "cortesia" && !ocupados.has(String(v._id)));

  // Sube archivos a una cita ya existente y devuelve la lista actualizada.
  async function subirAdjuntos(idCita, archivos) {
    const datos = new FormData();
    for (const a of archivos) datos.append("archivos", a);
    const r = await fetch(`/api/taller/citas/${idCita}/adjuntos`, { method: "POST", body: datos });
    const lista = await r.json();
    if (!r.ok) throw new Error(lista.error || "No se pudo subir el documento");
    return lista;
  }

  // Elegir archivo: si la cita existe se sube al momento; si es nueva,
  // se guarda la elección y se sube justo después de crear la cita.
  async function elegirAdjunto(e) {
    const archivos = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!archivos.length) return;
    setError(null);
    if (!cita) {
      setAdjuntoPendiente(archivos[0]);
      return;
    }
    setSubiendoAdjunto(true);
    try {
      setAdjuntos(await subirAdjuntos(cita._id, archivos));
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSubiendoAdjunto(false);
    }
  }

  async function quitarAdjunto(a) {
    setError(null);
    setSubiendoAdjunto(true);
    try {
      const r = await fetch(`/api/taller/citas/${cita._id}/adjuntos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: a.url }),
      });
      const lista = await r.json();
      if (!r.ok) throw new Error(lista.error || "No se pudo quitar el documento");
      setAdjuntos(lista);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSubiendoAdjunto(false);
    }
  }

  async function guardarCita(imprimirDespues = false) {
    const duracion = aMinutos(form.horaFin) - aMinutos(form.hora);
    if (duracion <= 0) {
      setError("La hora de fin debe ser posterior a la de inicio");
      return false;
    }
    if (!form.clienteNombre?.trim() && !form.telefono?.trim() && !form.matricula?.trim()) {
      setError("Introduce al menos el cliente, el teléfono o la matrícula");
      return false;
    }
    setGuardando(true);
    setError(null);
    try {
      // Datos efectivos de cliente: parten del formulario y, si hay un
      // borrador del alta rápida sin pulsar "Dar de alta", se intenta el
      // alta aquí; si no se puede, el nombre y el teléfono viajan al menos
      // con la cita para no perderlos nunca.
      let clienteId = form.cliente;
      let clienteNombre = form.clienteNombre;
      let telefono = form.telefono;
      if (!clienteId && borradorAlta.abierto && borradorAlta.nombre) {
        try {
          const ra = await fetch("/api/clientes/rapido", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nombre: borradorAlta.nombre,
              telefono: borradorAlta.telefono,
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
          clienteNombre = borradorAlta.nombre || clienteNombre;
          telefono = borradorAlta.telefono || telefono;
        }
      }
      const cortesiaVeh = vehiculos.find((v) => String(v._id) === String(form.cortesiaVehiculo));
      const r = await fetch(`/api/taller/citas${cita ? `/${cita._id}` : ""}`, {
        method: cita ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cliente: clienteId,
          clienteNombre,
          telefono,
          duracion,
          horaFin: undefined,
          lineas: lineasEntrada,
          matricula: form.matricula || undefined,
          marca: form.vehiculoNuevo && !matriculaExiste ? (form.marca || undefined) : undefined,
          modelo: form.vehiculoNuevo && !matriculaExiste ? (form.modelo || undefined) : undefined,
          tipo: form.tipo,
          numeroSiniestro: form.tipo === "peritaje" ? (form.numeroSiniestro || undefined) : undefined,
          franquicia: form.franquicia ? Number(form.franquicia) : 0,
          entregaPrevista: form.entregaPrevista || null,
          presupuesto: Boolean(form.presupuesto),
          aseguradora: form.aseguradora || null,
          cortesia: Boolean(form.cortesia),
          cortesiaVehiculo: form.cortesia ? (form.cortesiaVehiculo || null) : null,
          cortesiaMatricula: form.cortesia ? (cortesiaVeh?.matricula || undefined) : null,
          reasignarCliente: reasignarCliente || undefined,
        }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo guardar la cita");
      // Cita nueva con peritación elegida: se adjunta justo después de crearla.
      if (!cita && adjuntoPendiente) {
        try {
          await subirAdjuntos(datos._id, [adjuntoPendiente]);
        } catch {
          alert("La cita se ha guardado, pero la peritación no se pudo adjuntar. Ábrela y súbela de nuevo.");
        }
      }
      if (imprimirDespues) {
        const cliente =
          clientes.find((item) => String(item._id) === String(form.cliente)) || undefined;
        const vehiculo =
          vehiculos.find(
            (item) => item.matricula?.toUpperCase() === form.matricula?.toUpperCase()
          ) || { marca: form.marca, modelo: form.modelo };
        const aseguradora = aseguradoras.find(
          (item) => String(item._id) === String(form.aseguradora)
        );
        await imprimirJustificanteCitaTaller({
          ...datos,
          cliente,
          vehiculo,
          clienteNombre: form.clienteNombre,
          telefono: form.telefono,
          matricula: form.matricula,
          motivo: form.motivo,
          notas: form.notas,
          aseguradoraNombre: form.aseguradoraNombre || aseguradora?.nombre || "",
          cortesia: form.cortesia,
          cortesiaMatricula: cortesiaVeh?.matricula || "",
        });
      }
      onGuardada();
      return true;
    } catch (e2) {
      setError(e2.message);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function guardar(e) {
    e.preventDefault();
    await guardarCita(false);
  }

  async function guardarEImprimir() {
    await guardarCita(true);
  }

  // Convierte las partidas de una valoración en reparaciones de la hoja.
  const lineasDesdeValoracion = (v) =>
    (v?.lineas ?? [])
      .map((l) => ({
        descripcion: l.descripcion ?? "",
        manoObra: l.horas ? `${String(l.horas).replace(".", ",")} h` : "",
        materiales:
          l.tipo === "material" && Number(l.importe) > 0 ? `${Number(l.importe).toFixed(2)} €` : "",
      }))
      .filter((l) => l.descripcion);

  const ponerLinea = (i, campo, valor) =>
    setLineasEntrada((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  const quitarLinea = (i) => setLineasEntrada((ls) => ls.filter((_, j) => j !== i));
  const anadirLinea = () =>
    setLineasEntrada((ls) => [...ls, { descripcion: "", manoObra: "", materiales: "" }]);

  function abrirDialogoEntrada() {
    const base = cita
      ? [cita.motivo, cita.notas].filter(Boolean).join(". ")
      : [form.motivo, form.notas].filter(Boolean).join(". ");
    setTextoEntrada(base);
    // Si la cita no tiene reparaciones aún pero hay valoración enlazada,
    // se traen sus partidas ya escritas (luego se pueden corregir).
    if (lineasEntrada.length === 0) {
      const v = valoracionesCita.find((x) => x.lineas?.length);
      if (v) setLineasEntrada(lineasDesdeValoracion(v));
    }
    setDialogoEntrada(true);
  }

  async function confirmarDialogoEntrada() {
    setImprimiendoEntrada(true);
    try {
      const texto = textoEntrada.trim();
      const lineas = lineasEntrada.filter((l) => l.descripcion || l.manoObra || l.materiales);
      // Lo escrito aquí queda guardado en la cita (descripción y reparaciones).
      if (cita) {
        const actual = [cita.motivo, cita.notas].filter(Boolean).join(". ");
        const mismasLineas = JSON.stringify(cita.lineas ?? []) === JSON.stringify(lineas);
        if (texto !== actual || !mismasLineas) {
          await fetch(`/api/taller/citas/${cita._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ motivo: texto, lineas }),
          }).catch(() => {});
        }
      }
      const clienteId = cita?.cliente?._id ?? cita?.cliente ?? form.cliente;
      const matricula = (cita?.matricula ?? form.matricula ?? "").toUpperCase();
      const cliente =
        clientes.find((c) => String(c._id) === String(clienteId)) ||
        (cita?.cliente && typeof cita.cliente === "object" ? cita.cliente : null);
      const vehiculo = vehiculos.find((v) => v.matricula?.toUpperCase() === matricula);
      // Compañía/siniestro/franquicia de la propia cita: salen en la hoja de
      // entrada para que el cliente sepa qué paga él de su bolsillo.
      const aseguradoraNombre =
        (cita?.aseguradoraNombre ?? form.aseguradoraNombre) ||
        aseguradoras.find((a) => String(a._id) === String(cita?.aseguradora?._id ?? cita?.aseguradora ?? form.aseguradora))?.nombre ||
        "";
      const franquicia = Number(cita?.franquicia ?? form.franquicia) || 0;

      const ok = await imprimirHojaEntrada({
        numero: cita ? `CITA-${cita._id.slice(-6).toUpperCase()}` : "CITA NUEVA",
        fechaEntrada: cita?.fecha ?? form.fecha,
        // Solo sale la fecha de entrega si el taller la ha puesto; nunca se inventa.
        fechaEntregaPrevista: (cita?.entregaPrevista ?? form.entregaPrevista) || undefined,
        matricula,
        km: vehiculo?.km ?? "",
        motivo: texto || "Recepción desde cita",
        aseguradora: aseguradoraNombre,
        numeroSiniestro: cita?.numeroSiniestro ?? form.numeroSiniestro ?? "",
        franquicia,
        cliente: cliente || undefined,
        clienteNombre: (cita?.clienteNombre ?? form.clienteNombre) || cliente?.nombre || "",
        telefono: (cita?.telefono ?? form.telefono) || cliente?.telefono || "",
        vehiculo: vehiculo ? { marca: vehiculo.marca, modelo: vehiculo.modelo } : undefined,
        lineas,
      });

      // Si no hay plantilla configurada, se imprime un resguardo básico para que
      // nunca se quede sin documento.
      if (!ok) {
        const emp = await fetch("/api/empresa").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
        const html = hojaEntradaHtml(emp, cita ?? { ...form, motivo: texto }, cliente, vehiculo);
        const ventana = window.open("", "_blank", "width=900,height=700");
        if (!ventana) return alert("Permite las ventanas emergentes para imprimir");
        ventana.document.write(html);
        ventana.document.close();
        ventana.focus();
        setTimeout(() => ventana.print(), 250);
      }
      setDialogoEntrada(false);
    } finally {
      setImprimiendoEntrada(false);
    }
  }

  async function imprimirJustificante() {
    if (!cita) return;
    const cliente =
      clientes.find((item) => String(item._id) === String(cita.cliente?._id ?? cita.cliente)) ||
      cita.cliente;
    const vehiculo =
      vehiculos.find(
        (item) => item.matricula?.toUpperCase() === (cita.matricula ?? "").toUpperCase()
      ) || cita.vehiculo;
    const aseguradora = aseguradoras.find(
      (item) => String(item._id) === String(cita.aseguradora?._id ?? cita.aseguradora)
    );

    await imprimirJustificanteCitaTaller({
      ...cita,
      cliente,
      vehiculo,
      aseguradoraNombre: cita.aseguradoraNombre || aseguradora?.nombre || "",
    });
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
          {cita
            ? `${cita.tipo === "peritaje" ? "Peritaje" : "Cita"} ${aFechaInput(cita.fecha)} ${cita.hora}`
            : form.tipo === "peritaje"
              ? "Nueva cita de peritaje"
              : "Nueva cita"}
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
        {cita && (
          <button
            type="button"
            onClick={imprimirJustificante}
            className="w-full mb-3 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-700 transition"
          >
            Imprimir justificante de cita
            <span className="block text-[0.6875rem] font-normal text-sky-100 mt-0.5">
              Confirmación para entregar al cliente
            </span>
          </button>
        )}
        {(cita?.matricula || form.matricula) && (
          <button
            type="button"
            onClick={abrirDialogoEntrada}
            className="w-full mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-900 hover:bg-white transition border border-slate-300"
          >
            Imprimir hoja de entrada
            <span className="block text-[0.6875rem] font-normal text-slate-600 mt-0.5">
              Documento oficial de entrada en taller, con la descripción de la avería
            </span>
          </button>
        )}
        <form onSubmit={guardar} className="space-y-3">
          {/* Tipo de cita: recepción normal o peritaje (viene el perito) */}
          <div className="grid grid-cols-2 gap-2">
            {[
              ["normal", "Cita normal", "Recepción o entrega del vehículo"],
              ["peritaje", "Peritaje", "Deja el coche para el perito"],
            ].map(([id, et, desc]) => (
              <button
                key={id}
                type="button"
                onClick={() => actualizar("tipo", id)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  form.tipo === id
                    ? id === "peritaje"
                      ? "border-violet-400 bg-violet-500/15 text-white"
                      : "border-accent bg-accent/10 text-white"
                    : "border-slate-600/40 text-slate-400 hover:border-slate-500"
                }`}
              >
                <span className="block text-sm font-bold">{et}</span>
                <span className="block text-[0.6875rem] opacity-75">{desc}</span>
              </button>
            ))}
          </div>
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
          <div>
            <label className="text-sm text-slate-400 block mb-1">Localizar valoración o presupuesto</label>
            <BuscadorEntidad
              opciones={opcionesLocalizar}
              valorTexto={textoLocalizar}
              onTexto={setTextoLocalizar}
              onElegir={elegirLocalizado}
              placeholder="PER-000012, matrícula, compañía, P-3…"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Al elegirla rellena matrícula, compañía, siniestro y cliente de la cita.
            </p>
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
              <AltaRapidaCliente
                nombreInicial={form.clienteNombre}
                telefonoInicial={form.telefono}
                onCambio={setBorradorAlta}
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
                placeholder="Buscar por matrícula o escribir nueva…"
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

          {/* Aviso de reasignación si la matrícula pertenece a otro cliente */}
          {conflictoVehiculo && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-sm text-amber-800">
                <b>Atención:</b> la matrícula <b>{conflictoVehiculo.matricula}</b> está actualmente asignada al cliente{' '}
                <b>{conflictoVehiculo.clienteNombre || '—'}</b>.
              </p>
              <label className="flex items-start gap-2 text-sm text-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reasignarCliente}
                  onChange={(e) => setReasignarCliente(e.target.checked)}
                  className="mt-0.5 accent-amber-600"
                />
                <span>
                  Reasignar el vehículo al nuevo cliente al guardar la cita.
                  <span className="block text-xs text-amber-700">
                    El historial se conserva; solo cambia el propietario actual.
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Casilla "Nuevo" en vehículo: marca y modelo para darlo de alta */}
          {form.matricula && !matriculaExiste && (
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.vehiculoNuevo}
                  onChange={(e) => actualizar("vehiculoNuevo", e.target.checked)}
                  className="accent-[#2ec4b6]"
                />
                Vehículo nuevo (dar de alta ahora)
              </label>
              {form.vehiculoNuevo && (
                <div className="mt-2 rounded-xl border border-teal-300 bg-teal-50 p-3 space-y-2">
                  <p className="text-xs text-teal-700">
                    Se dará de alta con esta matrícula al guardar la cita.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className={campo}
                      value={form.marca}
                      onChange={(e) => actualizar("marca", e.target.value)}
                      placeholder="Marca"
                    />
                    <input
                      className={campo}
                      value={form.modelo}
                      onChange={(e) => actualizar("modelo", e.target.value)}
                      placeholder="Modelo"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compañía de seguros (si la reparación va por aseguradora) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">
                Por compañía de seguros{form.tipo === "peritaje" ? " *" : ""}
              </label>
              <BuscadorEntidad
                opciones={aseguradoras}
                valorId={form.aseguradora}
                valorTexto={form.aseguradoraNombre}
                onElegir={elegirAseguradora}
                onTexto={escribirAseguradora}
                placeholder="Particular (sin compañía)…"
                required={form.tipo === "peritaje"}
              />
              {form.aseguradoraNombre && !form.aseguradora && (
                <p className="text-[11px] text-slate-500 mt-1">Se dará de alta la compañía al guardar.</p>
              )}
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Franquicia (€, IVA incl.)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={campo}
                value={form.franquicia}
                onChange={(e) => actualizar("franquicia", e.target.value)}
                placeholder="0,00"
                disabled={!form.aseguradora && !form.aseguradoraNombre}
              />
              <p className="text-[11px] text-slate-500 mt-1">La paga el cliente; se descuenta de la factura a la compañía.</p>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Entrega prevista (opcional)</label>
              <input
                type="date"
                className={campo}
                value={form.entregaPrevista}
                onChange={(e) => actualizar("entregaPrevista", e.target.value)}
              />
              <p className="text-[11px] text-slate-500 mt-1">Solo si la sabes: sale en la hoja de entrada.</p>
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

          {/* Datos del peritaje: el perito de la compañía viene a valorar */}
          {form.tipo === "peritaje" && (
            <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Nº de siniestro</label>
                  <input
                    className={campo}
                    value={form.numeroSiniestro}
                    onChange={(e) => actualizar("numeroSiniestro", e.target.value)}
                    placeholder="Nº que da la compañía"
                  />
                </div>
                <p className="text-xs text-violet-300/80 self-end pb-1">
                  El cliente deja el vehículo y el perito de la compañía vendrá a valorarlo en el taller.
                </p>
              </div>

              {/* Peritación adjunta: el PDF que manda la compañía o fotos */}
              <div className="border-t border-violet-500/15 pt-2">
                <label className="text-xs text-slate-400 block mb-1">Peritación adjunta</label>
                {adjuntos.length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {adjuntos.map((a) => (
                      <li key={a.url} className="flex items-center gap-2 text-sm">
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 truncate text-violet-300 hover:underline"
                          title="Abrir el documento en una pestaña nueva"
                        >
                          {a.nombre || "Ver documento"}
                        </a>
                        <button
                          type="button"
                          onClick={() => quitarAdjunto(a)}
                          disabled={subiendoAdjunto}
                          className="text-xs text-rose-400 hover:underline disabled:opacity-50"
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!cita && adjuntoPendiente && (
                  <p className="text-xs text-violet-300/80 mb-1 truncate">
                    {adjuntoPendiente.name} — se adjuntará al guardar la cita
                  </p>
                )}
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-violet-300 hover:underline cursor-pointer">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    className="hidden"
                    onChange={elegirAdjunto}
                    disabled={subiendoAdjunto}
                  />
                  {subiendoAdjunto
                    ? "Subiendo…"
                    : adjuntos.length
                      ? "Adjuntar otro documento"
                      : "Adjuntar peritación (PDF o foto)"}
                </label>
              </div>
            </div>
          )}
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
            <label className="text-sm text-slate-400 block mb-1">
              Descripción de la avería / trabajos solicitados por el cliente
            </label>
            <textarea
              className={`${campo} resize-none`}
              rows={3}
              value={form.motivo}
              onChange={(e) => actualizar("motivo", e.target.value)}
              placeholder="Ej.: El cliente dice que frena mal y suena un ruido delante; revisar frenos y cambiar bombilla del faro derecho…"
            />
            <p className="text-[0.6875rem] text-slate-500 mt-1">
              Este texto sale impreso en el cuadro grande de la hoja de entrada.
            </p>
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
              {!cita && (
                <button
                  type="button"
                  onClick={guardarEImprimir}
                  disabled={guardando}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Guardar e imprimir justificante"}
                </button>
              )}
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

    {dialogoEntrada && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
        onClick={() => setDialogoEntrada(false)}
      >
        <div className="modal-panel w-full max-w-2xl p-5" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-base font-bold text-white mb-1">
            Hoja de entrada · {(cita?.matricula ?? form.matricula ?? "").toUpperCase()}
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Escribe la descripción de la avería / trabajos que pide el cliente. Sale impresa en el
            cuadro grande de la hoja{cita ? " y queda guardada en la cita" : ""}.
          </p>
          <textarea
            autoFocus
            rows={3}
            className="input w-full resize-none"
            placeholder="Ej.: El cliente dice que frena mal y suena un ruido delante; revisar frenos y cambiar bombilla del faro derecho…"
            value={textoEntrada}
            onChange={(e) => setTextoEntrada(e.target.value)}
          />

          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-300">Reparaciones a realizar</span>
              <button
                type="button"
                onClick={anadirLinea}
                className="text-xs text-accent hover:underline"
              >
                + Añadir línea
              </button>
            </div>
            <p className="text-[0.6875rem] text-slate-500 mb-2">
              Salen rellenas en la tabla de la hoja (descripción / mano de obra / materiales). Si la
              cita tiene valoración enlazada, vienen ya escritas.
            </p>
            {lineasEntrada.length > 0 && (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {lineasEntrada.map((l, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      className="input flex-1"
                      placeholder="Reparar aleta delantera derecha…"
                      value={l.descripcion}
                      onChange={(e) => ponerLinea(i, "descripcion", e.target.value)}
                    />
                    <input
                      className="input w-20"
                      placeholder="M.O."
                      title="Mano de obra"
                      value={l.manoObra}
                      onChange={(e) => ponerLinea(i, "manoObra", e.target.value)}
                    />
                    <input
                      className="input w-20"
                      placeholder="Mater."
                      title="Materiales"
                      value={l.materiales}
                      onChange={(e) => ponerLinea(i, "materiales", e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => quitarLinea(i)}
                      className="btn-ghost px-2"
                      title="Quitar línea"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setDialogoEntrada(false)} className="btn-ghost">
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarDialogoEntrada}
              disabled={imprimiendoEntrada}
              className="btn-primary disabled:opacity-50"
            >
              {imprimiendoEntrada ? "Preparando…" : "Imprimir hoja de entrada"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
