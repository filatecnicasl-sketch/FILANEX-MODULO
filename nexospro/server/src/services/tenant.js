import Tenant from "../models/plataforma/Tenant.js";
import Cuenta from "../models/plataforma/Cuenta.js";
import { hashContrasena } from "../routes/usuarios.js";
import { prefijoBd } from "../config/db.js";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export function validarSlug(slug) {
  return SLUG_RE.test(slug);
}

export async function crearTenant({ slug, nombre, email, password, adminNombre }) {
  if (!validarSlug(slug)) {
    throw new Error("El slug solo puede tener minúsculas, números y guiones");
  }
  if (String(password).length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres");
  }
  const correo = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new Error("El email no es válido");
  }

  const dbName = `${prefijoBd()}${slug}`;
  if (await Tenant.findOne({ $or: [{ slug }, { dbName }] })) {
    throw new Error(`Ya existe una empresa con slug "${slug}"`);
  }
  if (await Cuenta.findOne({ email: correo })) {
    throw new Error(`Ya existe una cuenta con el email ${correo}`);
  }

  const tenant = await Tenant.create({
    slug,
    nombre: String(nombre).trim(),
    dbName,
  });

  await Cuenta.create({
    nombre: String(adminNombre || nombre).trim(),
    email: correo,
    passwordHash: hashContrasena(String(password)),
    rol: "admin",
    tenant: tenant._id,
  });

  return tenant;
}

export async function resumenTenants() {
  const tenants = await Tenant.find().sort({ nombre: 1 }).lean();
  const cuentas = await Cuenta.aggregate([
    { $group: { _id: "$tenant", total: { $sum: 1 } } },
  ]);
  const porTenant = new Map(cuentas.map((c) => [String(c._id), c.total]));
  return tenants.map((t) => ({
    ...t,
    usuarios: porTenant.get(String(t._id)) || 0,
  }));
}
