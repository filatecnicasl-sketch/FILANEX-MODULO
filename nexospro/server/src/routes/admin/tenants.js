import { Router } from "express";
import Tenant from "../../models/plataforma/Tenant.js";
import Cuenta from "../../models/plataforma/Cuenta.js";
import { requiereAuth, requiereRol } from "../../middleware/auth.js";
import { crearTenant, resumenTenants } from "../../services/tenant.js";

const router = Router();

// Solo administradores de la plataforma.
router.use(requiereAuth, requiereRol("admin"));

router.get("/", async (req, res, next) => {
  try {
    res.json(await resumenTenants());
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { slug, nombre, email, password, adminNombre, plan, limiteUsuarios, notas } = req.body;
    if (!slug || !nombre || !email || !password) {
      return res.status(400).json({ error: "slug, nombre, email y password son obligatorios" });
    }
    const tenant = await crearTenant({ slug, nombre, email, password, adminNombre });
    if (plan !== undefined) tenant.plan = String(plan);
    if (limiteUsuarios !== undefined) tenant.limiteUsuarios = Math.max(1, Number(limiteUsuarios) || 1);
    if (notas !== undefined) tenant.notas = String(notas);
    if (plan !== undefined || limiteUsuarios !== undefined || notas !== undefined) {
      await tenant.save();
    }
    res.status(201).json({
      id: tenant._id,
      slug: tenant.slug,
      nombre: tenant.nombre,
      dbName: tenant.dbName,
      activa: tenant.activa,
      plan: tenant.plan,
      limiteUsuarios: tenant.limiteUsuarios,
      notas: tenant.notas,
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { activa, plan, limiteUsuarios, notas } = req.body;
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });
    if (activa !== undefined) tenant.activa = Boolean(activa);
    if (plan !== undefined) tenant.plan = String(plan);
    if (limiteUsuarios !== undefined) tenant.limiteUsuarios = Math.max(1, Number(limiteUsuarios) || 1);
    if (notas !== undefined) tenant.notas = String(notas);
    await tenant.save();
    res.json({
      id: tenant._id,
      slug: tenant.slug,
      nombre: tenant.nombre,
      activa: tenant.activa,
      plan: tenant.plan,
      limiteUsuarios: tenant.limiteUsuarios,
      notas: tenant.notas,
    });
  } catch (err) {
    next(err);
  }
});

// Resetea la contraseña del administrador de un tenant.
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

export default router;
