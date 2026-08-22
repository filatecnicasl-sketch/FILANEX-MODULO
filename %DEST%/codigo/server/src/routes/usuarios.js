// Gestión de usuarios (Sistema → Usuarios). Prepara la versión multiusuario:
// el inicio de sesión aún no está activo, pero las cuentas quedan creadas
// con contraseña hasheada (scrypt) listas para usar.
import { Router } from "express";
import crypto from "node:crypto";
import Usuario from "../models/Usuario.js";
import Empresa from "../models/Empresa.js";

const router = Router();

function hashContrasena(pass) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pass, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Listo para el futuro login.
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

// GET /api/usuarios
router.get("/", async (req, res, next) => {
  try {
    const usuarios = await Usuario.find().select("-passwordHash").sort({ nombre: 1 }).lean();
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
    if (await Usuario.findOne({ email: correo })) {
      return res.status(409).json({ error: "Ya existe un usuario con ese email" });
    }
    const empresa = await Empresa.findOne().lean();
    const usuario = await Usuario.create({
      nombre: String(nombre).trim(),
      email: correo,
      passwordHash: hashContrasena(String(password)),
      rol: rol === "admin" ? "admin" : "usuario",
      empresa: empresa?._id,
    });
    const { passwordHash, ...resto } = usuario.toObject();
    res.status(201).json(resto);
  } catch (err) {
    next(err);
  }
});

// PUT /api/usuarios/:id (contraseña opcional: solo si se quiere cambiar)
router.put("/:id", async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

    const { nombre, email, password, rol } = req.body;
    const error = validar({ nombre, email, password, passwordOpcional: true });
    if (error) return res.status(400).json({ error });

    const correo = String(email).trim().toLowerCase();
    const duplicado = await Usuario.findOne({ email: correo, _id: { $ne: usuario._id } });
    if (duplicado) return res.status(409).json({ error: "Ya existe un usuario con ese email" });

    // No dejar el sistema sin administradores.
    if (usuario.rol === "admin" && rol === "usuario") {
      const admins = await Usuario.countDocuments({ rol: "admin", _id: { $ne: usuario._id } });
      if (admins === 0) {
        return res.status(409).json({ error: "Debe quedar al menos un administrador" });
      }
    }

    usuario.nombre = String(nombre).trim();
    usuario.email = correo;
    usuario.rol = rol === "admin" ? "admin" : "usuario";
    if (password) usuario.passwordHash = hashContrasena(String(password));
    await usuario.save();

    const { passwordHash, ...resto } = usuario.toObject();
    res.json(resto);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/usuarios/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
    if (usuario.rol === "admin") {
      const admins = await Usuario.countDocuments({ rol: "admin", _id: { $ne: usuario._id } });
      if (admins === 0) {
        return res.status(409).json({ error: "No puedes eliminar el último administrador" });
      }
    }
    await usuario.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
