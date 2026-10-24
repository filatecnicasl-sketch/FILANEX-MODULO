import Tenant from "../models/plataforma/Tenant.js";
import WhatsAppCuenta from "../models/plataforma/WhatsAppCuenta.js";
import MensajeWhatsApp from "../models/MensajeWhatsApp.js";
import PlantillaWhatsApp from "../models/PlantillaWhatsApp.js";
import Empresa from "../models/Empresa.js";
import Cliente from "../models/Cliente.js";
import { contextoActual } from "../models/tenant.js";
import { descifrarTokenWhatsApp } from "./whatsapp-crypto.js";
import { firmarToken } from "./jwt.js";

export const PLANTILLAS_FILANEX = {
  confirmacion: "filanex_cita_confirmacion_v1",
  recordatorio: "filanex_cita_recordatorio_v1",
  modificacion: "filanex_cita_modificada_v1",
  cancelacion: "filanex_cita_cancelada_v1",
  documento: "filanex_documento_disponible_v1",
  manual: "filanex_mensaje_cliente_v1",
};

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

export function normalizarTelefonoWhatsApp(valor, pais = "34") {
  let numero = String(valor ?? "").trim().replace(/[^\d+]/g, "");
  if (numero.startsWith("00")) numero = `+${numero.slice(2)}`;
  if (numero.startsWith("+")) numero = numero.slice(1);
  if (/^[6789]\d{8}$/.test(numero)) numero = `${pais}${numero}`;
  if (!/^\d{8,15}$/.test(numero)) {
    throw new Error("El teléfono no es válido para WhatsApp");
  }
  return numero;
}

export async function cuentaWhatsAppActual() {
  const contexto = contextoActual();
  if (!contexto?.dbName) return null;
  return WhatsAppCuenta.findOne({ dbName: contexto.dbName, estado: "activa" }).lean();
}

async function peticionGraph(ruta, token, opciones = {}) {
  const respuesta = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opciones.headers ?? {}),
    },
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos?.error?.error_user_msg || datos?.error?.message || "Meta rechazó la operación");
    error.codigo = String(datos?.error?.code ?? respuesta.status);
    error.reintentable = respuesta.status >= 500 || respuesta.status === 429;
    throw error;
  }
  return datos;
}

export async function comprobarCuenta(cuenta) {
  const token = descifrarTokenWhatsApp(cuenta.tokenCifrado);
  return peticionGraph(`${cuenta.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, token);
}

export async function sincronizarPlantillasCuenta(cuenta) {
  const token = descifrarTokenWhatsApp(cuenta.tokenCifrado);
  const datos = await peticionGraph(`${cuenta.wabaId}/message_templates?limit=100`, token);
  const permitidas = new Set(Object.values(PLANTILLAS_FILANEX));
  for (const plantilla of datos.data ?? []) {
    if (!permitidas.has(plantilla.name)) continue;
    await PlantillaWhatsApp.findOneAndUpdate(
      { nombre: plantilla.name },
      {
        categoria: plantilla.category,
        idioma: plantilla.language,
        estado: plantilla.status,
        metaId: plantilla.id,
        motivoRechazo: plantilla.rejected_reason,
        sincronizadaAt: new Date(),
      },
      { upsert: true, new: true }
    );
  }
  return PlantillaWhatsApp.find().sort({ nombre: 1 }).lean();
}

const DEFINICIONES_PLANTILLAS = [
  {
    name: PLANTILLAS_FILANEX.confirmacion,
    body: "{{1}}: Hola {{2}}, su cita es el {{3}} a las {{4}}. Motivo: {{5}}.",
    example: ["FILATECNICA", "María", "28/08/2026", "10:00", "Revisión"],
    buttons: true,
  },
  {
    name: PLANTILLAS_FILANEX.recordatorio,
    body: "{{1}}: Le recordamos, {{2}}, su cita del {{3}} a las {{4}}. Motivo: {{5}}.",
    example: ["FILATECNICA", "María", "28/08/2026", "10:00", "Revisión"],
    buttons: true,
  },
  {
    name: PLANTILLAS_FILANEX.modificacion,
    body: "{{1}}: {{2}}, su cita ha cambiado al {{3}} a las {{4}}. Motivo: {{5}}.",
    example: ["FILATECNICA", "María", "29/08/2026", "11:00", "Revisión"],
    buttons: true,
  },
  {
    name: PLANTILLAS_FILANEX.cancelacion,
    body: "{{1}}: {{2}}, queda cancelada su cita del {{3}} a las {{4}}. Motivo: {{5}}.",
    example: ["FILATECNICA", "María", "28/08/2026", "10:00", "Revisión"],
  },
  {
    name: PLANTILLAS_FILANEX.documento,
    body: "{{1}}: Hola {{2}}, ya tiene disponible su {{3}} número {{4}}. Puede consultarlo aquí: {{5}}",
    example: ["FILATECNICA", "María", "factura", "A-125", "https://api.filanex.es"],
  },
  {
    name: PLANTILLAS_FILANEX.manual,
    body: "{{1}}: Hola {{2}}, le enviamos un aviso relacionado con {{3}} {{4}}.",
    example: ["FILATECNICA", "María", "su ficha", "-"],
  },
];

export async function prepararPlantillasCuenta(cuenta) {
  const token = descifrarTokenWhatsApp(cuenta.tokenCifrado);
  const actuales = await peticionGraph(`${cuenta.wabaId}/message_templates?limit=100`, token);
  const nombres = new Set((actuales.data ?? []).map((plantilla) => plantilla.name));
  const resultados = [];
  for (const definicion of DEFINICIONES_PLANTILLAS) {
    if (nombres.has(definicion.name)) {
      resultados.push({ nombre: definicion.name, estado: "existente" });
      continue;
    }
    const components = [{
      type: "BODY",
      text: definicion.body,
      example: { body_text: [definicion.example] },
    }];
    if (definicion.buttons) {
      components.push({
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Confirmar" },
          { type: "QUICK_REPLY", text: "Cancelar" },
        ],
      });
    }
    const creada = await peticionGraph(`${cuenta.wabaId}/message_templates`, token, {
      method: "POST",
      body: JSON.stringify({
        name: definicion.name,
        language: "es",
        category: "UTILITY",
        components,
      }),
    });
    resultados.push({ nombre: definicion.name, estado: "creada", id: creada.id });
  }
  await sincronizarPlantillasCuenta(cuenta);
  return resultados;
}

function componentesMensaje(mensaje) {
  const components = [{
    type: "body",
    parameters: mensaje.variables.map((text) => ({ type: "text", text: String(text || "-") })),
  }];
  if (["confirmacion", "recordatorio", "modificacion"].includes(mensaje.clase)) {
    components.push(
      { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: `FILANEX_CONFIRMAR:${mensaje._id}` }] },
      { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: `FILANEX_CANCELAR:${mensaje._id}` }] }
    );
  }
  return components;
}

export async function enviarMensajeWhatsApp(mensaje, cuenta) {
  const plantilla = await PlantillaWhatsApp.findOne({ nombre: mensaje.plantilla }).lean();
  if (!plantilla || plantilla.estado !== "APPROVED") {
    const error = new Error(`La plantilla ${mensaje.plantilla} todavía no está aprobada por Meta`);
    error.codigo = "PLANTILLA_NO_APROBADA";
    error.reintentable = false;
    throw error;
  }
  const token = descifrarTokenWhatsApp(cuenta.tokenCifrado);
  return peticionGraph(`${cuenta.phoneNumberId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: mensaje.telefono,
      type: "template",
      template: {
        name: mensaje.plantilla,
        language: { code: plantilla.idioma || "es" },
        components: componentesMensaje(mensaje),
      },
    }),
  });
}

function fechaHora(fecha, hora) {
  const dia = new Date(fecha);
  const [horas, minutos] = String(hora).split(":").map(Number);
  dia.setHours(horas || 0, minutos || 0, 0, 0);
  return dia;
}

async function consentimientoDe(documento) {
  if (documento.cliente) {
    const cliente = await Cliente.findById(documento.cliente).select("comunicaciones.whatsapp").lean();
    if (cliente?.comunicaciones?.whatsapp?.autorizado) return true;
  }
  return documento.whatsappAutorizado === true;
}

async function crearEnCola(datos) {
  return MensajeWhatsApp.findOneAndUpdate(
    { idempotencia: datos.idempotencia },
    { $setOnInsert: datos },
    { upsert: true, new: true }
  );
}

export async function sincronizarWhatsAppCita({ ambito, documento, anterior = null, usuario = null }) {
  await MensajeWhatsApp.updateMany(
    {
      "origen.ambito": ambito,
      "origen.id": String(documento._id),
      estado: "programado",
    },
    { estado: "cancelado", error: "Programación sustituida al modificar la cita" }
  );

  const cuenta = await cuentaWhatsAppActual();
  if (!cuenta || documento.estado === "realizada") return { programados: 0, motivo: "WhatsApp no conectado" };
  if (!(await consentimientoDe(documento))) return { programados: 0, motivo: "Falta consentimiento para WhatsApp" };

  let telefono;
  try {
    telefono = normalizarTelefonoWhatsApp(documento.telefono);
  } catch (error) {
    return { programados: 0, motivo: error.message };
  }

  const empresa = await Empresa.findOne().lean();
  const prefs = empresa?.notificaciones?.whatsapp?.[ambito] ?? {};
  if (prefs.activo === false) return { programados: 0, motivo: "Automatización desactivada" };

  const fechaCita = fechaHora(documento.fecha, documento.hora);
  const version = fechaCita.toISOString();
  const variables = [
    empresa?.nombre || "FILANEX",
    documento.clienteNombre || "cliente",
    fechaCita.toLocaleDateString("es-ES"),
    documento.hora,
    documento.titulo || documento.motivo || documento.aparatoDescripcion || documento.matricula || "cita",
  ];
  const origen = { ambito, id: String(documento._id), tipo: ambito };
  let programados = 0;
  const yaEnviado = anterior && await MensajeWhatsApp.exists({
    "origen.ambito": ambito,
    "origen.id": String(documento._id),
    estado: { $in: ["enviado", "entregado", "leido", "respondido"] },
  });

  if (documento.estado === "cancelada") {
    if (yaEnviado) {
      await crearEnCola({
        telefono, cliente: documento.cliente, clienteNombre: documento.clienteNombre,
        origen, clase: "cancelacion", plantilla: PLANTILLAS_FILANEX.cancelacion,
        variables, programadoPara: new Date(), idempotencia: `${ambito}:${documento._id}:cancelacion:${version}`,
        creadoPor: usuario?.sub, creadoPorNombre: usuario?.nombre,
      });
      programados++;
    }
    return { programados };
  }

  if (anterior && yaEnviado && (String(anterior.fecha) !== String(documento.fecha) || anterior.hora !== documento.hora)) {
    await crearEnCola({
      telefono, cliente: documento.cliente, clienteNombre: documento.clienteNombre,
      origen, clase: "modificacion", plantilla: PLANTILLAS_FILANEX.modificacion,
      variables, programadoPara: new Date(), idempotencia: `${ambito}:${documento._id}:modificacion:${version}`,
      creadoPor: usuario?.sub, creadoPorNombre: usuario?.nombre,
    });
    programados++;
  } else if (!anterior && prefs.confirmacion !== false) {
    await crearEnCola({
      telefono, cliente: documento.cliente, clienteNombre: documento.clienteNombre,
      origen, clase: "confirmacion", plantilla: PLANTILLAS_FILANEX.confirmacion,
      variables, programadoPara: new Date(), idempotencia: `${ambito}:${documento._id}:confirmacion:${version}`,
      creadoPor: usuario?.sub, creadoPorNombre: usuario?.nombre,
    });
    programados++;
  }

  if (prefs.recordatorios !== false) {
    const minutos = Math.max(15, Number(prefs.minutosAntes) || 1440);
    const programadoPara = new Date(fechaCita.getTime() - minutos * 60000);
    if (programadoPara > new Date()) {
      await crearEnCola({
        telefono, cliente: documento.cliente, clienteNombre: documento.clienteNombre,
        origen, clase: "recordatorio", plantilla: PLANTILLAS_FILANEX.recordatorio,
        variables, programadoPara, idempotencia: `${ambito}:${documento._id}:recordatorio:${version}:${minutos}`,
        creadoPor: usuario?.sub, creadoPorNombre: usuario?.nombre,
      });
      programados++;
    }
  }
  return { programados };
}

export async function programarMensajeManual({ telefono, cliente, clienteNombre, tipo, id, numero, usuario }) {
  const normalizado = normalizarTelefonoWhatsApp(telefono);
  const cuenta = await cuentaWhatsAppActual();
  if (!cuenta) throw new Error("Conecta primero el WhatsApp Business de la empresa");
  if (cliente) {
    const ficha = await Cliente.findById(cliente).select("comunicaciones.whatsapp nombre").lean();
    if (!ficha?.comunicaciones?.whatsapp?.autorizado) {
      throw new Error("El cliente no tiene registrado el consentimiento para WhatsApp");
    }
  }
  const empresa = await Empresa.findOne().lean();
  const contexto = contextoActual();
  const tiposDocumento = {
    presupuesto: "presupuesto-venta",
    albaran: "albaran-venta",
    factura: "factura-venta",
  };
  let enlace;
  if (tipo !== "cliente") {
    const documentoTipo = tiposDocumento[tipo];
    if (!documentoTipo || !id) throw new Error("El documento no es válido para WhatsApp");
    const token = firmarToken({
      tipo: "whatsapp-documento",
      db: contexto.dbName,
      t: contexto.slug,
      documentoTipo,
      documentoId: String(id),
    }, 7 * 24 * 60 * 60);
    const origen = String(process.env.PUBLIC_API_URL || process.env.FRONTEND_URL || "http://localhost:4700").replace(/\/$/, "");
    enlace = `${origen}/api/documentos/${documentoTipo}/${id}/pdf?wa=${encodeURIComponent(token)}`;
  }
  return crearEnCola({
    telefono: normalizado,
    cliente,
    clienteNombre,
    origen: { ambito: tipo === "cliente" ? "cliente" : "documento", tipo, id: String(id || ""), numero },
    clase: tipo === "cliente" ? "manual" : "documento",
    plantilla: tipo === "cliente" ? PLANTILLAS_FILANEX.manual : PLANTILLAS_FILANEX.documento,
    variables: [
      empresa?.nombre || "FILANEX",
      clienteNombre || "cliente",
      tipo,
      numero || "-",
      ...(enlace ? [enlace] : []),
    ],
    programadoPara: new Date(),
    idempotencia: `manual:${tipo}:${id || normalizado}:${Date.now()}`,
    creadoPor: usuario?.sub,
    creadoPorNombre: usuario?.nombre,
  });
}

export async function resolverTenantPorCuenta(phoneNumberId) {
  const cuenta = await WhatsAppCuenta.findOne({ phoneNumberId, estado: "activa" }).lean();
  if (!cuenta) return null;
  const tenant = await Tenant.findById(cuenta.tenant).lean();
  return tenant ? { cuenta, tenant } : null;
}