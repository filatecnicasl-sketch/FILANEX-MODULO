import { imprimirFormato } from "./imprimir-formato.jsx";
import { buildContratoCortesia } from "../editor/builtinTemplates.js";

const fechaEs = (f) => (f ? new Date(f).toLocaleDateString("es-ES") : "");
const horaEs = (f) =>
  f ? new Date(f).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "";
const n = (v) => (v != null && v !== "" ? Number(v).toLocaleString("es-ES") : "");
const eur = (v) => {
  if (v == null || v === "") return "";
  return Number(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const dirTexto = (d) => [d?.calle, d?.cp, d?.ciudad, d?.provincia].filter(Boolean).join(", ");

async function cargarPlantilla() {
  try {
    const r = await fetch("/api/formatos/default/contrato-cortesia");
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function mapearFormData(p, emp, plantilla) {
  const nombrePartes = String(p.clienteNombre || "").trim().split(/\s+/);
  const nombre = nombrePartes[0] || "";
  const apellidos = nombrePartes.slice(1).join(" ") || "";

  const formData = {
    "empresa.nombre": emp.nombre || "",
    "empresa.direccion": dirTexto(emp.direccion),
    "empresa.telefono": emp.telefono || "",
    "prestamo.numero": p.numeroOrden ? `OT ${p.numeroOrden}` : String(p._id || "").slice(-6).toUpperCase(),

    "cliente.apellidos": apellidos,
    "cliente.nombre": nombre,
    "cliente.fechaNacimiento": fechaEs(p.clienteFechaNacimiento),
    "cliente.lugarNacimiento": p.clienteLugarNacimiento || "",
    "cliente.direccion": p.clienteDireccion || "",
    "cliente.telefono": p.telefono || "",
    "cliente.movil": p.telefono || "",
    "cliente.telefonoTrabajo": p.telefonoTrabajo || "",
    "cliente.permisoNumero": p.permisoConducirNumero || "",
    "cliente.permisoExpedicion": fechaEs(p.permisoConducirExpedicion),
    "cliente.permisoLugar": p.permisoConducirLugar || "",
    "cliente.otrosConductores": p.otroConductor || "",

    "vehiculo.marca": p.vehiculo?.marca || "",
    "vehiculo.modelo": p.vehiculo?.modelo || "",
    "vehiculo.matricula": p.matricula || "",
    "vehiculo.vin": p.vinCortesia || "",
    "vehiculo.forfaitDiaria": eur(p.participacionForfaitDiaria),
    "vehiculo.observaciones": p.notas || "",

    "seguro.asegurador": p.aseguradora || "",
    "seguro.numeroContrato": p.numeroContratoSeguro || "",
    "seguro.franquiciaTerceros": eur(p.franquiciaTerceros),
    "seguro.franquiciaVehiculo": eur(p.franquiciaVehiculo),
    "seguro.franquiciaRobo": eur(p.franquiciaRobo),
    "seguro.rescateSi": Boolean(p.rescateFranquicia),
    "seguro.rescateNo": !p.rescateFranquicia,
    "seguro.transferenciaSi": Boolean(p.transferenciaSeguro),
    "seguro.transferenciaNo": !p.transferenciaSeguro,
    "seguro.rescatePorDia": eur(p.rescatePorDia),

    "reparacion.modelo": p.vehiculoReparacionMarcaModelo || "",
    "reparacion.matricula": p.vehiculoReparacionMatricula || "",
    "reparacion.vin": p.vehiculoReparacionVIN || "",
    "reparacion.numeroOrden": p.numeroOrden || "",
    "reparacion.entregaPrevista": fechaEs(p.fechaPrevista),
  };

  // Tabla salida / retorno previsto / retorno real.
  // Buscamos la tabla en la plantilla para rellenar con las claves correctas.
  const tabla = plantilla?.elements?.find((e) => e.type === "table");
  if (tabla) {
    const celdas = [
      ["Fecha y hora:", `${fechaEs(p.fechaSalida)} ${horaEs(p.fechaSalida)}`, fechaEs(p.fechaPrevista), ""],
      ["Km. En el contador:", n(p.kmSalida), "", ""],
      ["Nivel de carburante:", String(p.combustibleSalida || ""), "", ""],
    ];
    celdas.forEach((fila, r) => {
      fila.forEach((valor, c) => {
        formData[`tbl_${tabla.id}_${r}_${c}`] = valor;
      });
    });
  }

  return formData;
}

export async function imprimirContratoCortesia(p) {
  const emp = await fetch("/api/empresa").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  let plantilla = await cargarPlantilla();
  if (!plantilla) {
    plantilla = buildContratoCortesia();
  }
  const formData = mapearFormData(p, emp, plantilla);
  imprimirFormato(plantilla, formData, {});
}
