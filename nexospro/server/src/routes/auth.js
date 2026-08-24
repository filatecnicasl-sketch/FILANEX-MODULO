// Autenticación central de la plataforma: login, estado (¿hay cuentas?),
// bootstrap del primer administrador (solo instalación nueva, sin empresas)
// y datos de la sesión. Las cuentas viven en la BD plataforma y el token
// lleva la empresa (slug + base de datos) a la que pertenecen.
import { Router } from "express";
import rateLimit from "express-rate-limit";
import Cuenta from "../models/plataforma/Cuenta.js";
import Tenant from "../models/plataforma/Tenant.js";
import { firmarToken } from "../services/jwt.js";
import { verificarContrasena, hashContrasena } from "./usuarios.js";
import { requiereAuth } from "../middleware/auth.js";
import { prefijoBd } from "../config/db.js";

const router = Router();

const limitadorAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera unos minutos." },
});

function tokenDe(cuenta, tenant) {
  return firmarToken({
    sub: String(cuenta._id),
    nombre: cuenta.nombre,
    email: cuenta.email,
    rol: cuenta.rol,
    superadmin: !!cuenta.superadmin,
    t: tenant.slug,
    tid: String(tenant._id),
    db: tenant.dbName,
  });
}

function publico(cuenta, tenant) {
  return {
    id: cuenta._id,
    nombre: cuenta.nombre,
    email: cuenta.email,
    rol: cuenta.rol,
    superadmin: !!cuenta.superadmin,
    empresa: tenant?.nombre ?? null,
  };
}

// ¿Hay cuentas dadas de alta? Lo usa la pantalla de login para ofrecer la
// creación del primer administrador en instalaciones nuevas. Con una sola
// empresa activa (instalación local) se devuelve su nombre para mostrarlo;
// en la nube (varias empresas) la cabecera es genérica.
router.get("/estado", async (req, res, next) => {
  try {
    const usuarios = await Cuenta.countDocuments();
    const activos = await Tenant.find({ estado: { $ne: "inactivo" } }).select("nombre").lean();
    res.json({ usuarios, empresa: activos.length === 1 ? activos[0].nombre : null });
  } catch (err) {
    next(err);
  }
});

// Inicio de sesión: email + contraseña → token de 12 horas con la empresa.
router.post("/login", limitadorAuth, async (req, res, next) => {
  try {
    const correo = String(req.body.email ?? "").trim().toLowerCase();
    const cuenta = await Cuenta.findOne({ email: correo });
    const tenant = cuenta ? await Tenant.findById(cuenta.tenant) : null;
    if (
      !cuenta ||
      !cuenta.activa ||
      tenant?.estado === "inactivo" ||
      tenant?.estado === "suspendido" ||
      !verificarContrasena(String(req.body.password ?? ""), cuenta.passwordHash)
    ) {
      return res.status(401).json({ error: "Email o contraseña incorrectos" });
    }
    res.json({ token: tokenDe(cuenta, tenant), usuario: publico(cuenta, tenant) });
  } catch (err) {
    next(err);
  }
});

// Primer administrador: solo funciona en una instalación nueva (sin ninguna
// empresa ni cuenta). Crea la empresa "local" y su administrador; después
// queda bloqueado para siempre. En la nube, las empresas nuevas se dan de
// alta con scripts/crear-tenant.mjs (panel de plataforma en una fase 4).
router.post("/bootstrap", limitadorAuth, async (req, res, next) => {
  try {
    if ((await Cuenta.countDocuments()) > 0 || (await Tenant.countDocuments()) > 0) {
      return res.status(409).json({ error: "Ya hay usuarios dados de alta" });
    }
    const { nombre, email, password } = req.body;
    if (!String(nombre ?? "").trim()) return res.status(400).json({ error: "El nombre es obligatorio" });
    const correo = String(email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return res.status(400).json({ error: "El email no es válido" });
    if (String(password ?? "").length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }
    const tenant = await Tenant.create({
      slug: "local",
      nombre: String(nombre).trim(),
      dbName: `${prefijoBd()}local`,
    });
    const cuenta = await Cuenta.create({
      nombre: String(nombre).trim(),
      email: correo,
      passwordHash: hashContrasena(String(password)),
      rol: "admin",
      superadmin: true,
      tenant: tenant._id,
    });
    res.status(201).json({ token: tokenDe(cuenta, tenant), usuario: publico(cuenta, tenant) });
  } catch (err) {
    next(err);
  }
});

// Datos de la sesión actual (requiere token).
router.get("/me", requiereAuth, (req, res) => {
  res.json({
    id: req.usuario.sub,
    nombre: req.usuario.nombre,
    email: req.usuario.email,
    rol: req.usuario.rol,
    superadmin: !!req.usuario.superadmin,
    empresa: req.usuario.t,
  });
});

export default router;
