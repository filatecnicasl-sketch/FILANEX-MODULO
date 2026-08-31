import { Router } from "express";
import mongoose from "mongoose";
import Tenant, { ESTADOS, PLANES } from "../../models/plataforma/Tenant.js";
import Cuenta from "../../models/plataforma/Cuenta.js";
import VinculoAsesoria from "../../models/plataforma/VinculoAsesoria.js";
import Empresa from "../../models/Empresa.js";
import { requiereAuth, requiereSuperAdmin } from "../../middleware/auth.js";
import { crearTenant, resumenTenants } from "../../services/tenant.js";
import { prefijoBd } from "../../config/db.js";
import { MODULOS, MODULOS_ACTIVABLES } from "../../config/modulos.js";
import { conexionTenant, conContexto } from "../../models/tenant.js";
import { buscarAsesoriaPorCodigo } from "../../services/vinculos-asesoria.js";

const router = Router();

router.use(requiereAuth, requiereSuperAdmin);

function diasRestantes(fecha) {
  if (!fecha) return null;
  const diff = new Date(fecha).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function normalizarModulos(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.filter((m) => MODULOS_ACTIVABLES.includes(m));
}

async function sincronizarModulosEmpresa(tenant, modulos) {
  try {
    await conContexto(
      { conn: conexionTenant(tenant.dbName), slug: tenant.slug, dbName: tenant.dbName },
      async () => {
        let empresa = await Empresa.findOne();
        if (!empresa) {
          empresa = new Empresa({ nombre: tenant.nombre });
        }
        empresa.modulos = modulos;
        await empresa.save();
      }
    );
  } catch (e) {
    console.error(`Error sincronizando módulos en ${tenant.dbName}:`, e.message);
  }
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
    // Asesoría referente de cada empresa (vínculo activo o pendiente de firma).
    const vinculos = await VinculoAsesoria.find({ estado: { $in: ["activo", "pendiente"] } }).lean();
    const asesoriasIds = [...new Set(vinculos.map((v) => String(v.asesoria)))];
    const asesorias = await Tenant.find({ _id: { $in: asesoriasIds } }).select("nombre").lean();
    const nombreAsesoria = new Map(asesorias.map((a) => [String(a._id), a.nombre]));
    const referentePorCliente = new Map(
      vinculos.map((v) => [
        String(v.cliente),
        { nombre: nombreAsesoria.get(String(v.asesoria)) ?? "—", estado: v.estado },
      ])
    );
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
        asesoriaReferente: referentePorCliente.get(String(t._id)) ?? null,
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

router.get("/modulos-catalogo", async (req, res) => {
  res.json(
    Object.entries(MODULOS).map(([clave, m]) => ({ clave, ...m }))
  );
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
      modulos, codigoAsesoriaCliente,
    } = req.body;

    if (!slug || !nombre || !email || !password) {
      return res.status(400).json({ error: "slug, nombre, email y password son obligatorios" });
    }

    const modulosLimpios = normalizarModulos(modulos);
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
    tenant.modulos = modulosLimpios;

    await tenant.save();
    await sincronizarModulosEmpresa(tenant, modulosLimpios);

    // Si viene recomendado por una asesoría, se deja el vínculo preparado en
    // pendiente: la empresa lo firma en su primer acceso (Ajustes → Asesoría).
    let avisoVinculo = null;
    if (codigoAsesoriaCliente) {
      const asesoria = await buscarAsesoriaPorCodigo(codigoAsesoriaCliente);
      if (!asesoria) {
        avisoVinculo = "Empresa creada, pero el código de asesoría no existe o no está activo.";
      } else if (String(asesoria._id) === String(tenant._id)) {
        avisoVinculo = "Empresa creada; no se puede vincular una empresa consigo misma.";
      } else {
        await VinculoAsesoria.findOneAndUpdate(
          { asesoria: asesoria._id, cliente: tenant._id },
          { $setOnInsert: { asesoria: asesoria._id, cliente: tenant._id, estado: "pendiente", origen: "plataforma" } },
          { upsert: true }
        );
      }
    }

    res.status(201).json({ ...tenant.toObject(), ...(avisoVinculo ? { aviso: avisoVinculo } : {}) });
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
      modulos,
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

    let modulosLimpios;
    if (modulos !== undefined) {
      modulosLimpios = normalizarModulos(modulos);
      tenant.modulos = modulosLimpios;
    }

    await tenant.save();
    if (modulosLimpios !== undefined) {
      await sincronizarModulosEmpresa(tenant, modulosLimpios);
    }
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
    const { hashContrasena } = await import("../usuarios.js");
    admin.passwordHash = hashContrasena(String(password));
    await admin.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Usuarios de un cliente: quién tiene acceso, con qué rol y cuándo entró por
// última vez. Las contraseñas no se muestran porque se guardan cifradas en un
// solo sentido (scrypt con sal); si un usuario pierde el acceso se le
// restablece con el endpoint de abajo.
router.get("/:id/usuarios", async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.params.id).lean();
    if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });
    const cuentas = await Cuenta.find({ tenant: tenant._id })
      .select("nombre email rol activa ultimoAcceso createdAt sesion")
      .sort({ rol: 1, nombre: 1 })
      .lean();
    res.json(
      cuentas.map((c) => ({
        _id: c._id,
        nombre: c.nombre,
        email: c.email,
        rol: c.rol,
        activa: c.activa !== false,
        conectado: Boolean(c.sesion),
        ultimoAcceso: c.ultimoAcceso ?? null,
        creado: c.createdAt ?? null,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// Restablece la contraseña de un usuario concreto del cliente. Si no se envía
// contraseña, se genera una segura y se devuelve UNA sola vez para poder
// dictársela; después ya no se puede volver a consultar.
router.post("/:id/usuarios/:cuentaId/password", async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });
    const cuenta = await Cuenta.findOne({ _id: req.params.cuentaId, tenant: tenant._id });
    if (!cuenta) return res.status(404).json({ error: "Usuario no encontrado" });

    let password = req.body?.password ? String(req.body.password) : "";
    const generada = !password;
    if (generada) {
      const { randomInt } = await import("node:crypto");
      const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      const minus = "abcdefghijkmnopqrstuvwxyz";
      const nums = "23456789";
      const saca = (juego, n) => Array.from({ length: n }, () => juego[randomInt(juego.length)]).join("");
      password = `${saca(letras, 2)}${saca(minus, 5)}-${saca(nums, 4)}`;
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const { hashContrasena } = await import("../usuarios.js");
    cuenta.passwordHash = hashContrasena(password);
    cuenta.sesion = ""; // cierra las sesiones abiertas de ese usuario
    await cuenta.save();
    res.json({ ok: true, email: cuenta.email, password, generada });
  } catch (err) {
    next(err);
  }
});

// Activa o desactiva el acceso de un usuario del cliente.
router.put("/:id/usuarios/:cuentaId/activa", async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });
    const cuenta = await Cuenta.findOne({ _id: req.params.cuentaId, tenant: tenant._id });
    if (!cuenta) return res.status(404).json({ error: "Usuario no encontrado" });
    cuenta.activa = Boolean(req.body?.activa);
    if (!cuenta.activa) cuenta.sesion = "";
    await cuenta.save();
    res.json({ ok: true, activa: cuenta.activa });
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
