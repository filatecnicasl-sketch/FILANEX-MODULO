// Gestión de usuarios (Sistema → Usuarios): las cuentas de la empresa de la
// sesión. Viven en la BD plataforma (modelo Cuenta) y siempre se filtran por
// la empresa del token: un usuario solo ve y toca las cuentas de su empresa.
import { Router } from "express";
import crypto from "node:crypto";
import Cuenta from "../models/plataforma/Cuenta.js";

const router = Router();

export function hashContrasena(pass) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pass, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verificarContrasena(pass, almacenado) {
  const [salt, hash] = String(almacenado ?? "").split(":");
  if (!salt || !hash) return false;
  const calculado = crypto.scryptSync(pass, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), calculado);
}

function validar({ nombre, email, password, passwordOpcional }) {
  if (!String(nombre ?? "").trim()) return "El nombre es obligatorio";
  const correo = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return "El email no es válido";
  if (!passwordOpcional || password) {
    if (String(password ?? "").length < 6) {
      return "La contraseña debe tener al menos 6 caracteres";
    }
  }
  return null;
}

// Filtro de empresa de la sesión: todas las operaciones quedan acotadas.
const delTenant = (req) => ({ tenant: req.usuario.tid });

// GET /api/usuarios
router.get("/", async (req, res, next) => {
  try {
    const usuarios = await Cuenta.find(delTenant(req))
      .select("-passwordHash")
      .sort({ nombre: 1 })
      .lean();
    res.json(usuarios);
  } catch (err) {
    next(err);
  }
});

// POST /api/usuarios
router.post("/", async (req, res, next) => {
  try {
    const { nombre, email, password, rol } = req.body;
    const error = validar({ nombre, email, password });
    if (error) return res.status(400).json({ error });

    const correo = String(email).trim().toLowerCase();
    // El email es único en toda la plataforma (el login no pide empresa).
    if (await Cuenta.findOne({ email: correo })) {
      return res.status(409).json({ error: "Ya existe un usuario con ese email" });
    }
    const cuenta = await Cuenta.create({
      nombre: String(nombre).trim(),
      email: correo,
      passwordHash: hashContrasena(String(password)),
      rol: rol === "admin" ? "admin" : "usuario",
      tenant: req.usuario.tid,
    });
    const { passwordHash, ...resto } = cuenta.toObject();
    res.status(201).json(resto);
  } catch (err) {
    next(err);
  }
});

// PUT /api/usuarios/:id (contraseña opcional: solo si se quiere cambiar)
router.put("/:id", async (req, res, next) => {
  try {
    const cuenta = await Cuenta.findOne({ _id: req.params.id, ...delTenant(req) });
    if (!cuenta) return res.status(404).json({ error: "Usuario no encontrado" });

    const { nombre, email, password, rol } = req.body;
    const error = validar({ nombre, email, password, passwordOpcional: true });
    if (error) return res.status(400).json({ error });

    const correo = String(email).trim().toLowerCase();
    const duplicado = await Cuenta.findOne({ email: correo, _id: { $ne: cuenta._id } });
    if (duplicado) return res.status(409).json({ error: "Ya existe un usuario con ese email" });

    // No dejar la empresa sin administradores.
    if (cuenta.rol === "admin" && rol === "usuario") {
      const admins = await Cuenta.countDocuments({
        rol: "admin",
        _id: { $ne: cuenta._id },
        ...delTenant(req),
      });
      if (admins === 0) {
        return res.status(409).json({ error: "Debe quedar al menos un administrador" });
      }
    }

    cuenta.nombre = String(nombre).trim();
    cuenta.email = correo;
    cuenta.rol = rol === "admin" ? "admin" : "usuario";
    if (password) cuenta.passwordHash = hashContrasena(String(password));
    await cuenta.save();

    const { passwordHash, ...resto } = cuenta.toObject();
    res.json(resto);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/usuarios/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const cuenta = await Cuenta.findOne({ _id: req.params.id, ...delTenant(req) });
    if (!cuenta) return res.status(404).json({ error: "Usuario no encontrado" });
    if (cuenta.rol === "admin") {
      const admins = await Cuenta.countDocuments({
        rol: "admin",
        _id: { $ne: cuenta._id },
        ...delTenant(req),
      });
      if (admins === 0) {
        return res.status(409).json({ error: "No puedes eliminar el último administrador" });
      }
    }
    await cuenta.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
