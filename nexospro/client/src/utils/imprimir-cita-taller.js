import { imprimirFormato } from "./imprimir-formato.jsx";
import { buildCitaTaller } from "../editor/builtinTemplates.js";

const fechaEs = (fecha) => (fecha ? new Date(fecha).toLocaleDateString("es-ES") : "");
const dirTexto = (direccion) =>
  [direccion?.calle, direccion?.cp, direccion?.ciudad, direccion?.provincia].filter(Boolean).join(", ");

const ESTADOS = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

function sumarMinutos(hora, minutos) {
  const [horas, mins] = String(hora || "00:00").split(":").map(Number);
  const total = (horas * 60 + mins + Number(minutos || 0)) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function cargarPlantilla() {
  try {
    const respuesta = await fetch("/api/formatos/default/cita-taller");
    if (!respuesta.ok) return null;
    return await respuesta.json();
  } catch {
    return null;
  }
}

export async function imprimirJustificanteCitaTaller(cita) {
  const empresa = await fetch("/api/empresa")
    .then((respuesta) => (respuesta.ok ? respuesta.json() : {}))
    .catch(() => ({}));
  const plantilla = (await cargarPlantilla()) || buildCitaTaller();
  const cliente = cita.cliente && typeof cita.cliente === "object" ? cita.cliente : {};
  const vehiculo = cita.vehiculo && typeof cita.vehiculo === "object" ? cita.vehiculo : {};
  const horaFin = sumarMinutos(cita.hora, cita.duracion ?? 60);

  imprimirFormato(plantilla, {
    "empresa.nombre": empresa.nombre || "",
    "empresa.nif": empresa.nif || "",
    "empresa.direccion": dirTexto(empresa.direccion),
    "empresa.telefono": empresa.telefono || "",
    "cita.numero": `CITA-${String(cita._id || "").slice(-6).toUpperCase()}`,
    "cita.fecha": fechaEs(cita.fecha),
    "cita.horario": `${cita.hora || ""} - ${horaFin}`,
    "cita.estado": ESTADOS[cita.estado] || cita.estado || "",
    "cita.aseguradora": cita.aseguradoraNombre || "Particular",
    "cita.cortesia": cita.cortesia
      ? `Reservado${cita.cortesiaMatricula ? `: ${cita.cortesiaMatricula}` : ""}`
      : "No reservado",
    "cita.motivo": [cita.motivo, cita.notas].filter(Boolean).join("\n"),
    "cliente.nombre": cita.clienteNombre || cliente.nombre || "",
    "cliente.nif": cliente.nif || "",
    "cliente.telefono": cita.telefono || cliente.telefono || "",
    "cliente.email": cliente.email || "",
    "vehiculo.matricula": cita.matricula || "",
    "vehiculo.marca": vehiculo.marca || "",
    "vehiculo.modelo": vehiculo.modelo || "",
    "documento.fechaEmision": new Date().toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    }),
  });
}