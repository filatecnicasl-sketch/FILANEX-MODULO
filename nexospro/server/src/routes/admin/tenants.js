import { Router } from "express";
import mongoose from "mongoose";
import Tenant, { ESTADOS, PLANES } from "../../models/plataforma/Tenant.js";
import Cuenta from "../../models/plataforma/Cuenta.js";
import { requiereAuth, requiereRol } from "../../middleware/auth.js";
import { crearTenant, resumenTenants } from "../../services/tenant.js";
import { prefijoBd } from "../../config/db.js";

const router = Router();

router.use(requiereAuth, requiereRol("admin"));

function diasRestantes(fecha) {
  if (!fecha) return null;
  const diff = new Date(fecha).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

async function contarFacturasMes(dbName) {
  try {
    const conn = mongoose.connection.useDb(dbName);
    const coll = conn.collection("facturaventas");
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    return await coll.countDocuments({ createdAt: { $gte: inicioMes } });
  } catch {
    return 0;
  }
}

async function tamanoColecciones(dbName) {
  try {
    const conn = mongoose.connection.useDb(dbName);
    const stats = await conn.db.stats();
    return Math.round((stats.dataSize || 0) / (1024 * 1024));
  } catch {
    return 0;
  }
}

async function normalizarTenant(t) {
  // Los tenants antiguos usaban `activa` en vez de `estado`.
  const estado = t.estado || (t.activa === false ? "inactivo" : "activo");
  const plan = PLANES.includes(t.plan) ? t.plan : "basico";
  return { ...t, estado, plan };
}

router.get("/", async (req, res, next) => {
  try {
    const tenantsRaw = await resumenTenants();
    const completos = [];
    for (const raw of tenantsRaw) {
      const t = await normalizarTenant(raw);
      const [facturasMes, mbUsados, admin] = await Promise.all([
        contarFacturasMes(t.dbName),
        tamanoColecciones(t.dbName),
        Cuenta.findOne({ tenant: t._id, rol: "admin" }).lean(),
      ]);
      const usuarios = await Cuenta.countDocuments({ tenant: t._id });
      completos.push({
        ...t,
        usuarios,
        facturasMes,
        mbUsados,
        adminEmail: admin?.email,
        adminNombre: admin?.nombre,
        ultimoAcceso: admin?.ultimoAcceso,
        diasCaducidad: diasRestantes(t.fechaCaducidad),
      });
    }
    res.json(completos);
  } catch (err) {
    next(err);
  }
});

router.get("/planes", async (req, res) => {
  res.json({ estados: ESTADOS, planes: PLANES });
});

router.get("/alertas", async (req, res, next) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limiteCaducidad = new Date(hoy);
    limiteCaducidad.setDate(hoy.getDate() + 15);

    const caducan = await Tenant.find({
      estado: { $in: ["activo", "demo"] },
      fechaCaducidad: { $gte: hoy, $lte: limiteCaducidad },
    }).lean();

    const inactivos = await Tenant.find({
      estado: { $in: ["inactivo", "suspendido"] },
    }).lean();

    res.json({ caducan, inactivos });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const {
      slug, nombre, email, password, adminNombre,
      nif, direccion, codigoPostal, ciudad, provincia, telefono, emailContacto,
      estado, plan, importeMensual, fechaRenovacion, fechaCaducidad,
      limiteUsuarios, limiteFacturasMes, limiteAlmacenamientoMB, notas,
    } = req.body;

    if (!slug || !nombre || !email || !password) {
      return res.status(400).json({ error: "slug, nombre, email y password son obligatorios" });
    }

    const tenant = await crearTenant({ slug, nombre, email, password, adminNombre });

    if (nif !== undefined) tenant.nif = String(nif).toUpperCase().trim();
    if (direccion !== undefined) tenant.direccion = String(direccion).trim();
    if (codigoPostal !== undefined) tenant.codigoPostal = String(codigoPostal).trim();
    if (ciudad !== undefined) tenant.ciudad = String(ciudad).trim();
    if (provincia !== undefined) tenant.provincia = String(provincia).trim();
    if (telefono !== undefined) tenant.telefono = String(telefono).trim();
    if (emailContacto !== undefined) tenant.emailContacto = String(emailContacto).trim().toLowerCase();
    if (ESTADOS.includes(estado)) tenant.estado = estado;
    if (PLANES.includes(plan)) tenant.plan = plan;
    if (importeMensual !== undefined) tenant.importeMensual = Number(importeMensual) || 0;
    if (fechaRenovacion) tenant.fechaRenovacion = new Date(fechaRenovacion);
    if (fechaCaducidad) tenant.fechaCaducidad = new Date(fechaCaducidad);
    if (limiteUsuarios !== undefined) tenant.limiteUsuarios = Math.max(1, Number(limiteUsuarios) || 1);
    if (limiteFacturasMes !== undefined) tenant.limiteFacturasMes = Math.max(1, Number(limiteFacturasMes) || 1);
    if (limiteAlmacenamientoMB !== undefined) tenant.limiteAlmacenamientoMB = Math.max(1, Number(limiteAlmacenamientoMB) || 1);
    if (notas !== undefined) tenant.notas = String(notas);

    await tenant.save();
    res.status(201).json(tenant.toObject());
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });

    const {
      nombre, nif, direccion, codigoPostal, ciudad, provincia, telefono, emailContacto,
      estado, plan, importeMensual, fechaRenovacion, fechaCaducidad,
      limiteUsuarios, limiteFacturasMes, limiteAlmacenamientoMB, notas,
    } = req.body;

    if (nombre !== undefined) tenant.nombre = String(nombre).trim();
    if (nif !== undefined) tenant.nif = String(nif).toUpperCase().trim();
    if (direccion !== undefined) tenant.direccion = String(direccion).trim();
    if (codigoPostal !== undefined) tenant.codigoPostal = String(codigoPostal).trim();
    if (ciudad !== undefined) tenant.ciudad = String(ciudad).trim();
    if (provincia !== undefined) tenant.provincia = String(provincia).trim();
    if (telefono !== undefined) tenant.telefono = String(telefono).trim();
    if (emailContacto !== undefined) tenant.emailContacto = String(emailContacto).trim().toLowerCase();
    if (ESTADOS.includes(estado)) tenant.estado = estado;
    if (PLANES.includes(plan)) tenant.plan = plan;
    if (importeMensual !== undefined) tenant.importeMensual = Number(importeMensual) || 0;
    if (fechaRenovacion !== undefined) tenant.fechaRenovacion = fechaRenovacion ? new Date(fechaRenovacion) : undefined;
    if (fechaCaducidad !== undefined) tenant.fechaCaducidad = fechaCaducidad ? new Date(fechaCaducidad) : undefined;
    if (limiteUsuarios !== undefined) tenant.limiteUsuarios = Math.max(1, Number(limiteUsuarios) || 1);
    if (limiteFacturasMes !== undefined) tenant.limiteFacturasMes = Math.max(1, Number(limiteFacturasMes) || 1);
    if (limiteAlmacenamientoMB !== undefined) tenant.limiteAlmacenamientoMB = Math.max(1, Number(limiteAlmacenamientoMB) || 1);
    if (notas !== undefined) tenant.notas = String(notas);

    await tenant.save();
    res.json(tenant.toObject());
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reset-password", async (req, res, next) => {
  try {
    const { password } = req.body;
    if (String(password).length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });
    const admin = await Cuenta.findOne({ tenant: tenant._id, rol: "admin" });
    if (!admin) return res.status(404).json({ error: "No se encontró el administrador" });
    const { hashContrasena } = await import("../routes/usuarios.js");
    admin.passwordHash = hashContrasena(String(password));
    await admin.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });
    await Cuenta.deleteMany({ tenant: tenant._id });
    await tenant.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
