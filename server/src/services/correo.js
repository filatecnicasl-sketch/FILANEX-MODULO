import nodemailer from "nodemailer";
import QRCode from "qrcode";
import Empresa from "../models/Empresa.js";
import Cliente from "../models/Cliente.js";
import Formato from "../models/Formato.js";
import FacturaVenta from "../models/FacturaVenta.js";
import { descifrar } from "./cifrado.js";
import { datosParaPdf } from "./documentoPdfData.js";
import { formatoToHtml } from "./formatoToHtml.js";
import { renderPdf } from "./pdfRenderer.js";
import { generarPdfFactura } from "./factura-pdf.js";

const TIPOS_DOCUMENTO = {
  "factura-venta": { etiqueta: "Factura", prefijo: "factura" },
  "presupuesto-venta": { etiqueta: "Presupuesto", prefijo: "presupuesto" },
  "albaran-venta": { etiqueta: "Albarán", prefijo: "albaran" },
};

function configuracionPublica(empresa) {
  const correo = empresa?.correo ?? {};
  return {
    activo: Boolean(correo.activo),
    tipo: correo.tipo || "smtp",
    nombreRemitente: correo.nombreRemitente || "",
    usuario: correo.usuario || "",
    host: correo.host || "",
    puerto: correo.puerto || 587,
    seguridad: correo.seguridad || "starttls",
    responderA: correo.responderA || "",
    copiaOculta: correo.copiaOculta || "",
    passwordGuardada: Boolean(correo.passwordCifrada),
    comprobadaAt: correo.comprobadaAt || null,
    ultimoError: correo.ultimoError || null,
  };
}

function escaparHtml(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function correoValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor ?? "").trim());
}

function textoCorto(valor, maximo = 5000) {
  return String(valor ?? "").trim().slice(0, maximo);
}

function opcionesSmtp(correo, password) {
  const esGmail = correo.tipo === "gmail";
  const puerto = Number(correo.puerto) || (esGmail ? 465 : 587);
  const seguridad = correo.seguridad || (puerto === 465 ? "ssl" : "starttls");
  const opciones = {
    host: esGmail ? "smtp.gmail.com" : textoCorto(correo.host, 255),
    port: puerto,
    secure: seguridad === "ssl" || puerto === 465,
    auth: { user: correo.usuario, pass: password },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  };
  if (seguridad === "ssl" && puerto !== 465) opciones.requireTLS = true;
  return opciones;
}

async function obtenerCorreoCompleto({ incluirPassword = false } = {}) {
  const empresa = await Empresa.findOne();
  if (!empresa) throw new Error("No hay empresa configurada");
  const correo = empresa.correo?.toObject?.() ?? empresa.correo ?? {};
  if (!correo.activo) throw new Error("La configuración de correo está desactivada");
  const usuario = textoCorto(correo.usuario, 255);
  if (!correoValido(usuario)) throw new Error("El correo remitente no es válido");
  if (!correo.passwordCifrada) throw new Error("Guarda primero la contraseña del correo");
  const password = descifrar(correo.passwordCifrada);
  if (!incluirPassword) return { correo, password };
  return { correo, password, empresa };
}

async function crearTransporte() {
  const { correo, password } = await obtenerCorreoCompleto({ incluirPassword: true });
  return { transporte: nodemailer.createTransport(opcionesSmtp(correo, password)), correo };
}

export function normalizarConfiguracionCorreo(body = {}, empresa) {
  const tipo = body.tipo === "gmail" ? "gmail" : "smtp";
  const puerto = Math.trunc(Number(body.puerto));
  const usuario = textoCorto(body.usuario, 255).toLowerCase();
  if (usuario && !correoValido(usuario)) throw new Error("El correo remitente no es válido");
  const responderA = textoCorto(body.responderA, 255);
  if (responderA && !correoValido(responderA)) throw new Error("El correo de respuesta no es válido");
  const copiaOculta = textoCorto(body.copiaOculta, 255);
  if (copiaOculta && !correoValido(copiaOculta)) throw new Error("La copia oculta no es válida");
  const seguridad = ["ssl", "starttls", "ninguna"].includes(body.seguridad) ? body.seguridad : "starttls";
  const host = tipo === "gmail" ? "smtp.gmail.com" : textoCorto(body.host, 255);
  if (tipo === "smtp" && !host) throw new Error("Indica el servidor SMTP del correo profesional");
  return {
    activo: Boolean(body.activo),
    tipo,
    nombreRemitente: textoCorto(body.nombreRemitente, 120) || empresa.nombre,
    usuario,
    host,
    puerto: Number.isFinite(puerto) && puerto > 0 && puerto <= 65535 ? puerto : (tipo === "gmail" ? 465 : 587),
    seguridad,
    responderA,
    copiaOculta,
    passwordCifrada: empresa.correo?.passwordCifrada,
    comprobadaAt: empresa.correo?.comprobadaAt,
    ultimoError: empresa.correo?.ultimoError,
  };
}

export async function verificarCorreoEmpresa() {
  const { transporte, correo } = await crearTransporte();
  try {
    await transporte.verify();
    await Empresa.updateOne({}, {
      $set: { "correo.comprobadaAt": new Date(), "correo.ultimoError": undefined },
    });
    return configuracionPublica(await Empresa.findOne().lean());
  } catch (error) {
    await Empresa.updateOne({}, { $set: { "correo.ultimoError": error.message } });
    const e = new Error(mensajeErrorCorreo(error, correo.tipo));
    e.status = 400;
    throw e;
  }
}

export async function enviarPruebaCorreo({ para, asunto, mensaje }) {
  const destinatario = textoCorto(para, 255);
  if (!correoValido(destinatario)) {
    const e = new Error("Indica una dirección válida para la prueba");
    e.status = 400;
    throw e;
  }
  return enviarCorreoEmpresa({
    para: destinatario,
    asunto: textoCorto(asunto, 180) || "Prueba de correo de FILANEX",
    mensaje: textoCorto(mensaje, 3000) || "La configuración de correo electrónico funciona correctamente.",
  });
}

async function generarPdfDocumento(tipo, id) {
  const plantilla = await Formato.findOne({ tipoDocumento: tipo }).sort({ porDefecto: -1, createdAt: 1 }).lean();
  const datos = await datosParaPdf(tipo, id);
  if (!plantilla && tipo === "factura-venta") {
    const factura = await FacturaVenta.findById(id).populate("cliente").lean();
    const empresa = await Empresa.findOne().lean();
    const pdf = await generarPdfFactura({ empresa, factura, cliente: factura.cliente });
    return { pdf, numero: factura.serieNumero, cliente: factura.cliente };
  }
  if (!plantilla) throw new Error("No hay plantilla de impresión para este documento");
  const signatures = datos.firma?.imagen ? { cliente: datos.firma.imagen } : {};
  let { html, css, pageSize, pageOrientation } = formatoToHtml(plantilla, datos.formData, signatures, {
    logoUrl: datos.logoUrl,
  });
  if (tipo === "factura-venta" && datos.qrContenido) {
    const dataUri = await QRCode.toDataURL(datos.qrContenido, { errorCorrectionLevel: "M", width: 300, margin: 0 });
    html = html.replace(/<\/div>$/, `<div style="position:absolute;left:20mm;bottom:14mm;display:flex;gap:3mm;align-items:center;"><img src="${dataUri}" style="width:24mm;height:24mm"/><div style="font-size:6.5pt;color:#444;line-height:1.3;"><strong>VERI*FACTU</strong><br/>Factura verificable en la sede electrónica de la AEAT</div></div></div>`);
  }
  const pdf = await renderPdf({ html, css, pageSize, pageOrientation });
  const numero = datos.formData["documento.numero"] || id;
  return { pdf, numero, clienteNombre: datos.formData["cliente.nombre"] };
}

export async function enviarDocumentoCorreo({ tipo, id, para, asunto, mensaje }) {
  const info = TIPOS_DOCUMENTO[tipo];
  if (!info) {
    const e = new Error("Tipo de documento no admitido");
    e.status = 400;
    throw e;
  }
  const documento = await datosParaPdf(tipo, id);
  const correoCliente = documento.formData["cliente.email"] || documento.formData["cliente.correo"];
  const nombreCliente = documento.formData["cliente.nombre"] || "cliente";
  const destinatario = textoCorto(para || correoCliente, 255);
  if (!correoValido(destinatario)) {
    const e = new Error(`El cliente ${nombreCliente} no tiene un correo válido`);
    e.status = 400;
    throw e;
  }
  const { pdf, numero } = await generarPdfDocumento(tipo, id);
  const asuntoFinal = textoCorto(asunto, 180) || `${info.etiqueta} ${numero}`;
  const mensajeFinal = textoCorto(mensaje, 5000)
    || `Adjunto le enviamos el ${info.etiqueta.toLowerCase()} ${numero}.\n\nQuedamos a su disposición.`;
  const resultado = await enviarCorreoEmpresa({
    para: destinatario,
    asunto: asuntoFinal,
    mensaje: mensajeFinal,
    adjuntos: [{ filename: `${info.prefijo}-${numero}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
  return { ...resultado, para: destinatario, numero };
}

export async function enviarCorreoEmpresa({ para, asunto, mensaje, adjuntos = [] }) {
  const { transporte, correo } = await crearTransporte();
  const remitente = `"${textoCorto(correo.nombreRemitente, 120).replace(/"/g, "")}" <${correo.usuario}>`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;white-space:pre-line">${escaparHtml(mensaje)}</div>`;
  try {
    const envio = await transporte.sendMail({
      from: remitente,
      to: para,
      bcc: correo.copiaOculta || undefined,
      replyTo: correo.responderA || undefined,
      subject: asunto,
      text: mensaje,
      html,
      attachments: adjuntos,
    });
    return { ok: true, messageId: envio.messageId };
  } catch (error) {
    const e = new Error(mensajeErrorCorreo(error, correo.tipo));
    e.status = 400;
    throw e;
  }
}

function mensajeErrorCorreo(error, tipo) {
  const codigo = error?.responseCode || error?.code;
  if (tipo === "gmail" && (codigo === 535 || error?.message?.includes("Username and Password not accepted"))) {
    return "Gmail ha rechazado el acceso. Activa la verificación en dos pasos y usa una contraseña de aplicación.";
  }
  if (codigo === 535 || codigo === "EAUTH") return "El servidor de correo ha rechazado el usuario o la contraseña.";
  if (codigo === "ENOTFOUND" || codigo === "ECONNREFUSED") return "No se puede conectar con el servidor SMTP. Revisa host, puerto y seguridad.";
  return error?.message || "No se pudo enviar el correo";
}

export { configuracionPublica };
