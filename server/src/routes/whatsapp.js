import { Router } from "express";
import Tenant from "../models/plataforma/Tenant.js";
import WhatsAppCuenta from "../models/plataforma/WhatsAppCuenta.js";
import MensajeWhatsApp from "../models/MensajeWhatsApp.js";
import PlantillaWhatsApp from "../models/PlantillaWhatsApp.js";
import Empresa from "../models/Empresa.js";
import { requiereRol } from "../middleware/auth.js";
import { contextoActual } from "../models/tenant.js";
import { cifrarTokenWhatsApp } from "../services/whatsapp-crypto.js";
import {
  comprobarCuenta,
  cuentaWhatsAppActual,
  prepararPlantillasCuenta,
  programarMensajeManual,
  sincronizarPlantillasCuenta,
} from "../services/whatsapp.js";

const router = Router();
const soloAdmin = requiereRol("admin");
const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

function cuentaPublica(cuenta) {
  if (!cuenta) return null;
  return {
    numero: cuenta.numero,
    nombreVisible: cuenta.nombreVisible,
    estado: cuenta.estado,
    calidad: cuenta.calidad,
    conectadaAt: cuenta.conectadaAt,
    comprobadaAt: cuenta.comprobadaAt,
    ultimoError: cuenta.ultimoError,
  };
}

router.get("/configuracion", async (req, res, next) => {
  try {
    const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [cuenta, empresa, plantillas, resumen, recientes] = await Promise.all([
      cuentaWhatsAppActual(),
      Empresa.findOne().lean(),
      PlantillaWhatsApp.find().sort({ nombre: 1 }).lean(),
      MensajeWhatsApp.aggregate([{ $group: { _id: "$estado", total: { $sum: 1 } } }]),
      MensajeWhatsApp.aggregate([
        { $match: { createdAt: { $gte: desde24h } } },
        { $group: { _id: "$estado", total: { $sum: 1 } } },
      ]),
    ]);
    const resumenReciente = Object.fromEntries(recientes.map((fila) => [fila._id, fila.total]));
    const totalReciente = Object.values(resumenReciente).reduce((suma, total) => suma + total, 0);
    const alertas = [];
    if (cuenta?.calidad === "RED") alertas.push("Meta indica calidad baja para el número conectado.");
    if (plantillas.some((plantilla) => plantilla.estado === "REJECTED")) {
      alertas.push("Hay plantillas rechazadas que deben revisarse.");
    }
    if (totalReciente >= 5 && (resumenReciente.fallido || 0) / totalReciente >= 0.2) {
      alertas.push("Más del 20 % de los mensajes de las últimas 24 horas han fallado.");
    }
    res.json({
      disponible: Boolean(process.env.META_APP_ID && process.env.META_CONFIG_ID),
      appId: process.env.META_APP_ID || null,
      configId: process.env.META_CONFIG_ID || null,
      graphVersion,
      cuenta: cuentaPublica(cuenta),
      preferencias: empresa?.notificaciones?.whatsapp,
      plantillas,
      resumen: Object.fromEntries(resumen.map((fila) => [fila._id, fila.total])),
      alertas,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/embedded-signup", soloAdmin, async (req, res, next) => {
  try {
    const { code, wabaId, phoneNumberId } = req.body;
    if (!code || !wabaId || !phoneNumberId) {
      return res.status(400).json({ error: "Meta no devolvió todos los datos de conexión" });
    }
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID || "",
      client_secret: process.env.META_APP_SECRET || "",
      code,
    });
    const tokenRespuesta = await fetch(`https://graph.facebook.com/${graphVersion}/oauth/access_token?${params}`);
    const tokenDatos = await tokenRespuesta.json();
    if (!tokenRespuesta.ok || !tokenDatos.access_token) {
      return res.status(400).json({ error: tokenDatos?.error?.message || "No se pudo completar la conexión con Meta" });
    }
    const contexto = contextoActual();
    const tenant = await Tenant.findOne({ dbName: contexto.dbName });
    if (!tenant) return res.status(404).json({ error: "Empresa SaaS no encontrada" });
    const cuentaTemporal = {
      phoneNumberId,
      tokenCifrado: cifrarTokenWhatsApp(tokenDatos.access_token),
    };
    const telefonoRespuesta = await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${tokenDatos.access_token}` } }
    );
    const telefono = await telefonoRespuesta.json();
    if (!telefonoRespuesta.ok) {
      return res.status(400).json({ error: telefono?.error?.message || "No se pudo comprobar el número conectado" });
    }
    const suscripcionRespuesta = await fetch(
      `https://graph.facebook.com/${graphVersion}/${wabaId}/subscribed_apps`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenDatos.access_token}` },
      }
    );
    const suscripcion = await suscripcionRespuesta.json();
    if (!suscripcionRespuesta.ok || suscripcion.success !== true) {
      return res.status(400).json({ error: suscripcion?.error?.message || "No se pudo activar el webhook para esta cuenta" });
    }
    const cuenta = await WhatsAppCuenta.findOneAndUpdate(
      { tenant: tenant._id },
      {
        $set: {
          tenant: tenant._id,
          slug: tenant.slug,
          dbName: tenant.dbName,
          wabaId,
          phoneNumberId,
          numero: telefono.display_phone_number,
          nombreVisible: telefono.verified_name,
          calidad: telefono.quality_rating,
          tokenCifrado: cuentaTemporal.tokenCifrado,
          estado: "activa",
          conectadaAt: new Date(),
          comprobadaAt: new Date(),
        },
        $unset: { desconectadaAt: 1, ultimoError: 1 },
      },
      { upsert: true, new: true }
    );
    await sincronizarPlantillasCuenta(cuenta);
    res.json({ cuenta: cuentaPublica(cuenta) });
  } catch (error) {
    next(error);
  }
});

router.post("/desconectar", soloAdmin, async (req, res, next) => {
  try {
    const contexto = contextoActual();
    await WhatsAppCuenta.findOneAndUpdate(
      { dbName: contexto.dbName },
      { estado: "desconectada", desconectadaAt: new Date(), $unset: { tokenCifrado: 1 } }
    );
    await MensajeWhatsApp.updateMany({ estado: "programado" }, { estado: "cancelado", error: "Cuenta desconectada" });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/sincronizar", soloAdmin, async (req, res, next) => {
  try {
    const cuenta = await cuentaWhatsAppActual();
    if (!cuenta) return res.status(400).json({ error: "WhatsApp no está conectado" });
    const datos = await comprobarCuenta(cuenta);
    await WhatsAppCuenta.findByIdAndUpdate(cuenta._id, {
      numero: datos.display_phone_number,
      nombreVisible: datos.verified_name,
      calidad: datos.quality_rating,
      comprobadaAt: new Date(),
      estado: "activa",
    });
    const plantillas = await sincronizarPlantillasCuenta(cuenta);
    res.json({ cuenta: cuentaPublica({ ...cuenta, ...datos }), plantillas });
  } catch (error) {
    next(error);
  }
});

router.post("/plantillas/preparar", soloAdmin, async (req, res, next) => {
  try {
    const cuenta = await cuentaWhatsAppActual();
    if (!cuenta) return res.status(400).json({ error: "WhatsApp no está conectado" });
    const resultados = await prepararPlantillasCuenta(cuenta);
    res.json({ resultados });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/preferencias", soloAdmin, async (req, res, next) => {
  try {
    const cambios = {};
    for (const ambito of ["agenda", "taller", "servicio"]) {
      const valor = req.body?.[ambito] ?? {};
      cambios[`notificaciones.whatsapp.${ambito}`] = {
        activo: valor.activo !== false,
        confirmacion: valor.confirmacion !== false,
        recordatorios: valor.recordatorios !== false,
        minutosAntes: Math.max(15, Math.min(10080, Number(valor.minutosAntes) || 1440)),
      };
    }
    const empresa = await Empresa.findOneAndUpdate({}, { $set: cambios }, { new: true });
    res.json({ preferencias: empresa.notificaciones.whatsapp });
  } catch (error) {
    next(error);
  }
});

router.get("/mensajes", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.estado) filtro.estado = req.query.estado;
    if (req.query.ambito) filtro["origen.ambito"] = req.query.ambito;
    if (req.query.desde || req.query.hasta) {
      filtro.createdAt = {};
      if (req.query.desde) filtro.createdAt.$gte = new Date(`${req.query.desde}T00:00:00`);
      if (req.query.hasta) filtro.createdAt.$lte = new Date(`${req.query.hasta}T23:59:59.999`);
    }
    if (req.query.q) {
      const q = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filtro.$or = [{ telefono: { $regex: q, $options: "i" } }, { clienteNombre: { $regex: q, $options: "i" } }];
    }
    res.json(await MensajeWhatsApp.find(filtro).sort({ createdAt: -1 }).limit(500).lean());
  } catch (error) {
    next(error);
  }
});

router.post("/enviar", async (req, res, next) => {
  try {
    const mensaje = await programarMensajeManual({ ...req.body, usuario: req.usuario });
    res.status(201).json(mensaje);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/mensajes/:id/reintentar", async (req, res, next) => {
  try {
    const mensaje = await MensajeWhatsApp.findOneAndUpdate(
      { _id: req.params.id, estado: "fallido" },
      { estado: "programado", programadoPara: new Date(), proximoIntento: new Date(), $unset: { error: 1, errorCodigo: 1, fallidoAt: 1 } },
      { new: true }
    );
    if (!mensaje) return res.status(404).json({ error: "Mensaje fallido no encontrado" });
    res.json(mensaje);
  } catch (error) {
    next(error);
  }
});

router.post("/prueba", soloAdmin, async (req, res) => {
  try {
    const mensaje = await programarMensajeManual({
      telefono: req.body.telefono,
      clienteNombre: "Prueba",
      tipo: "cliente",
      usuario: req.usuario,
    });
    res.status(201).json(mensaje);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;