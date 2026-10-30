import { imprimirFormato } from "./imprimir-formato.jsx";
import { buildContratoCortesia } from "../editor/builtinTemplates.js";
import { gaugeCarburanteConNivel } from "../editor/assets.js";

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
    "empresa.email": emp.email || "",
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
    // La plantilla de Montiel usa esta variante de la clave; se dan las dos.
    "vehiculo.forfaitDiario": eur(p.participacionForfaitDiaria),
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

    // Bloque SALIDA / RETORNO con relojes de carburante (plantilla nueva).
    // Sin dato se imprime una línea en blanco para rellenar a mano, como la
    // columna de retorno real y el impreso original.
    "sr.fechaSalida": p.fechaSalida ? `${fechaEs(p.fechaSalida)} · ${horaEs(p.fechaSalida)}H` : "____/____/______  ____H",
    "sr.fechaPrevista": p.fechaPrevista ? `${fechaEs(p.fechaPrevista)} · ${horaEs(p.fechaPrevista)}H` : "____/____/______  ____H",
    "sr.kmSalida": n(p.kmSalida) || "________________",
  };

  // Tabla salida / retorno previsto / retorno real.
  // Buscamos la tabla en la plantilla para rellenar con las claves correctas.
  const tabla = plantilla?.elements?.find((e) => e.type === "table");
  if (tabla) {
    const nivelCombustible = Number(p.combustibleSalida);
    const combustibleVisual =
      p.combustibleSalida != null && p.combustibleSalida !== "" &&
      Number.isInteger(nivelCombustible) && nivelCombustible >= 0 && nivelCombustible <= 8
        ? `${"■".repeat(nivelCombustible)}${"□".repeat(8 - nivelCombustible)} ${nivelCombustible}/8`
        : "No indicado";
    const celdas = [
      ["Fecha y hora:", `${fechaEs(p.fechaSalida)} ${horaEs(p.fechaSalida)}`, fechaEs(p.fechaPrevista), ""],
      ["Km. En el contador:", n(p.kmSalida), "", ""],
      ["Nivel de carburante:", combustibleVisual, "", ""],
    ];
    celdas.forEach((fila, r) => {
      fila.forEach((valor, c) => {
        formData[`tbl_${tabla.id}_${r}_${c}`] = valor;
      });
    });
  }

  return formData;
}

// La impresión rápida renderiza los textos tal cual están en la plantilla:
// los marcadores {{clave}} se sustituyen aquí con los datos, igual que hace
// el servidor en formatoToHtml para los PDF.
function sustituirMarcadores(plantilla, formData) {
  const reemplazo = (texto) =>
    String(texto ?? "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, clave) => formData[clave] ?? "");
  return {
    ...plantilla,
    elements: (plantilla.elements ?? []).map((el) =>
      el.type === "text" ? { ...el, text: reemplazo(el.text) } : el
    ),
  };
}

export async function imprimirContratoCortesia(p, { copias = 1 } = {}) {
  const emp = await fetch("/api/empresa").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  let plantilla = await cargarPlantilla();
  if (!plantilla) {
    plantilla = buildContratoCortesia();
  }
  const formData = mapearFormData(p, emp, plantilla);

  // Reloj de carburante de la salida: la aguja marca el nivel guardado (0-8).
  // Sin nivel válido queda el reloj en blanco, para marcar a mano como en el
  // impreso original.
  const nivel = Number(p.combustibleSalida);
  const gaugeSalida = plantilla.elements?.find((e) => e.id === "sr-g1");
  if (
    gaugeSalida &&
    p.combustibleSalida != null &&
    p.combustibleSalida !== "" &&
    Number.isInteger(nivel) &&
    nivel >= 0 &&
    nivel <= 8
  ) {
    gaugeSalida.src = gaugeCarburanteConNivel(nivel);
  }

  // El contrato de cortesía se firma por duplicado: una copia para el cliente
  // y otra para el taller. Se pasan como páginas de un MISMO documento para
  // que salgan en un único diálogo de impresión: dos llamadas seguidas a
  // print() no funcionan porque el navegador bloquea la segunda al haberse
  // perdido la acción del usuario tras el primer diálogo.
  const paginas = [];
  for (let i = 0; i < Math.max(1, copias); i += 1) {
    const pagina = { ...plantilla, id: `${plantilla.id ?? "contrato"}-copia-${i + 1}` };
    if (copias > 1) {
      const etiqueta = `Copia ${i + 1} de ${copias}`;
      pagina.elements = pagina.elements.map((el) =>
        el.type === "text" && String(el.text ?? "").includes("{{copia.indicador}}")
          ? { ...el, text: String(el.text).replace(/\{\{\s*copia\.indicador\s*\}\}/g, etiqueta) }
          : el
      );
    }
    paginas.push(sustituirMarcadores(pagina, formData));
  }
  await imprimirFormato(paginas, formData, {});
}
