import Tenant from "../models/plataforma/Tenant.js";
import WhatsAppCuenta from "../models/plataforma/WhatsAppCuenta.js";
import MensajeWhatsApp from "../models/MensajeWhatsApp.js";
import { alsEmpresa, conexionTenant } from "../models/tenant.js";
import { enviarMensajeWhatsApp } from "./whatsapp.js";

let temporizador;
let ejecutando = false;

async function procesarTenant(tenant, cuenta) {
  return alsEmpresa.run(
    { conn: conexionTenant(tenant.dbName), slug: tenant.slug, dbName: tenant.dbName },
    async () => {
      for (let indice = 0; indice < 20; indice++) {
        const ahora = new Date();
        const mensaje = await MensajeWhatsApp.findOneAndUpdate(
          {
            estado: "programado",
            programadoPara: { $lte: ahora },
            $and: [
              { $or: [{ proximoIntento: null }, { proximoIntento: { $lte: ahora } }] },
              { $or: [{ bloqueadoHasta: null }, { bloqueadoHasta: { $lte: ahora } }] },
            ],
          },
          { estado: "procesando", bloqueadoHasta: new Date(Date.now() + 120000), $inc: { intentos: 1 } },
          { sort: { programadoPara: 1 }, new: true }
        );
        if (!mensaje) break;
        try {
          const resultado = await enviarMensajeWhatsApp(mensaje, cuenta);
          mensaje.estado = "enviado";
          mensaje.wamid = resultado.messages?.[0]?.id;
          mensaje.enviadoAt = new Date();
          mensaje.bloqueadoHasta = undefined;
          mensaje.error = undefined;
          await mensaje.save();
        } catch (error) {
          const reintentar = error.reintentable && mensaje.intentos < 5;
          mensaje.estado = reintentar ? "programado" : "fallido";
          mensaje.proximoIntento = reintentar
            ? new Date(Date.now() + Math.min(60, 2 ** mensaje.intentos) * 60000)
            : undefined;
          mensaje.bloqueadoHasta = undefined;
          mensaje.errorCodigo = error.codigo;
          mensaje.error = String(error.message).slice(0, 500);
          if (!reintentar) mensaje.fallidoAt = new Date();
          await mensaje.save();
        }
      }
    }
  );
}

async function pasada() {
  if (ejecutando) return;
  ejecutando = true;
  try {
    const tenants = await Tenant.find({ estado: { $in: ["activo", "demo"] } }).lean();
    const cuentas = await WhatsAppCuenta.find({
      tenant: { $in: tenants.map((tenant) => tenant._id) },
      estado: "activa",
    }).lean();
    const porTenant = new Map(cuentas.map((cuenta) => [String(cuenta.tenant), cuenta]));
    for (const tenant of tenants) {
      const cuenta = porTenant.get(String(tenant._id));
      if (cuenta) await procesarTenant(tenant, cuenta);
    }
  } catch (error) {
    console.error("Cola WhatsApp:", error.message);
  } finally {
    ejecutando = false;
  }
}

export function iniciarColaWhatsApp() {
  if (temporizador) return;
  MensajeWhatsApp;
  pasada();
  temporizador = setInterval(pasada, 15000);
  temporizador.unref?.();
}