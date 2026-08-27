import { Router } from "express";
import Empresa from "../models/Empresa.js";
import { requiereRol } from "../middleware/auth.js";
import { cifrar } from "../services/cifrado.js";
import {
  configuracionPublica,
  enviarDocumentoCorreo,
  enviarPruebaCorreo,
  normalizarConfiguracionCorreo,
  verificarCorreoEmpresa,
} from "../services/correo.js";

const router = Router();
const soloAdmin = requiereRol("admin");

router.get("/configuracion", async (req, res, next) => {
  try {
    const empresa = await Empresa.findOne().lean();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });
    res.json(configuracionPublica(empresa));
  } catch (error) {
    next(error);
  }
});

router.put("/configuracion", soloAdmin, async (req, res, next) => {
  try {
    let empresa = await Empresa.findOne();
    if (!empresa) return res.status(404).json({ error: "No hay empresa configurada" });
    try {
      empresa.correo = normalizarConfiguracionCorreo(req.body, empresa);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const password = String(req.body.password ?? "");
    if (password) empresa.correo.passwordCifrada = cifrar(password);
    if (!empresa.correo.passwordCifrada) {
      empresa.correo.activo = false;
      empresa.correo.ultimoError = "Falta la contraseña del correo";
    }
    await empresa.save();
    res.json(configuracionPublica(empresa.toObject()));
  } catch (error) {
    next(error);
  }
});

router.post("/verificar", soloAdmin, async (req, res, next) => {
  try {
    res.json(await verificarCorreoEmpresa());
  } catch (error) {
    next(error);
  }
});

router.post("/prueba", async (req, res, next) => {
  try {
    const resultado = await enviarPruebaCorreo(req.body);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

router.post("/enviar-documento", async (req, res, next) => {
  try {
    const resultado = await enviarDocumentoCorreo(req.body);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
