import crypto from "node:crypto";
import { Router } from "express";
import MensajeWhatsApp from "../models/MensajeWhatsApp.js";
import AgendaEvento from "../models/AgendaEvento.js";
import Cita from "../models/Cita.js";
import { Auditoria } from "../models/Auditoria.js";
import { alsEmpresa, conexionTenant } from "../models/tenant.js";
import { resolverTenantPorCuenta } from "../services/whatsapp.js";

const router = Router();

router.get("/", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe"
    && req.query["hub.verify_token"] === process.env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

function firmaValida(req) {
  const secreto = process.env.META_APP_SECRET;
  const recibida = req.get("X-Hub-Signature-256");
  if (!secreto || !recibida || !req.rawBody) return false;
  const esperada = `sha256=${crypto.createHmac("sha256", secreto).update(req.rawBody).digest("hex")}`;
  return recibida.length === esperada.length && crypto.timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada));
}

async function actualizarOrigen(mensaje, estado) {
  if (!["confirmada", "cancelada"].includes(estado)) return;
  if (mensaje.origen.ambito === "agenda") {
    await AgendaEvento.findByIdAndUpdate(mensaje.origen.id, { estado });
  } else if (["taller", "servicio"].includes(mensaje.origen.ambito)) {
    await Cita.findOneAndUpdate(
      { _id: mensaje.origen.id, ambito: mensaje.origen.ambito },
      { estado }
    );
  }
  if (estado === "cancelada") {
    await MensajeWhatsApp.updateMany(
      {
        "origen.ambito": mensaje.origen.ambito,
        "origen.id": mensaje.origen.id,
        estado: "programado",
      },
      { estado: "cancelado", error: "Cita cancelada por el cliente" }
    );
  }
}

async function procesarValor(value) {
  const phoneNumberId = value?.metadata?.phone_number_id;
  if (!phoneNumberId) return;
  const resuelto = await resolverTenantPorCuenta(phoneNumberId);
  if (!resuelto) return;
  const { tenant } = resuelto;
  await alsEmpresa.run(
    { conn: conexionTenant(tenant.dbName), slug: tenant.slug, dbName: tenant.dbName },
    async () => {
      for (const status of value.statuses ?? []) {
        const cambios = {};
        let filtro = { wamid: status.id };
        if (status.status === "sent") Object.assign(cambios, { estado: "enviado", enviadoAt: new Date(Number(status.timestamp) * 1000) });
        if (status.status === "delivered") {
          filtro.estado = { $nin: ["leido", "respondido"] };
          Object.assign(cambios, { estado: "entregado", entregadoAt: new Date(Number(status.timestamp) * 1000) });
        }
        if (status.status === "read") {
          filtro.estado = { $ne: "respondido" };
          Object.assign(cambios, { estado: "leido", leidoAt: new Date(Number(status.timestamp) * 1000) });
        }
        if (status.status === "failed") Object.assign(cambios, {
          estado: "fallido",
          fallidoAt: new Date(Number(status.timestamp) * 1000),
          errorCodigo: String(status.errors?.[0]?.code ?? ""),
          error: String(status.errors?.[0]?.title || status.errors?.[0]?.message || "Meta no pudo entregar el mensaje").slice(0, 500),
        });
        if (Object.keys(cambios).length) {
          await MensajeWhatsApp.findOneAndUpdate(filtro, cambios);
        }
      }
      for (const entrada of value.messages ?? []) {
        const payload = entrada.button?.payload || entrada.interactive?.button_reply?.id || "";
        const coincidencia = payload.match(/^FILANEX_(CONFIRMAR|CANCELAR):(.+)$/);
        if (!coincidencia) continue;
        const mensaje = await MensajeWhatsApp.findById(coincidencia[2]);
        if (!mensaje || mensaje.telefono !== entrada.from) continue;
        mensaje.estado = "respondido";
        mensaje.respondidoAt = new Date(Number(entrada.timestamp) * 1000);
        await mensaje.save();
        const estado = coincidencia[1] === "CONFIRMAR" ? "confirmada" : "cancelada";
        await actualizarOrigen(mensaje, estado);
        await Auditoria.create({
          nombre: "Cliente por WhatsApp",
          metodo: "WEBHOOK",
          ruta: `/api/whatsapp/${mensaje.origen.ambito}/${mensaje.origen.id}`,
          resultado: 200,
          detalle: estado,
        });
      }
    }
  );
}

router.post("/", async (req, res) => {
  if (!firmaValida(req)) return res.sendStatus(401);
  res.sendStatus(200);
  try {
    for (const entry of req.body?.entry ?? []) {
      for (const change of entry.changes ?? []) await procesarValor(change.value);
    }
  } catch (error) {
    console.error("Webhook WhatsApp:", error.message);
  }
});

export default router;