// Lado EMPRESA del vínculo con la asesoría: consultar el estado, buscar la
// asesoría por su código, firmar la autorización RGPD y revocarla.
import { Router } from "express";
import Tenant from "../models/plataforma/Tenant.js";
import VinculoAsesoria from "../models/plataforma/VinculoAsesoria.js";
import Empresa from "../models/Empresa.js";
import { requiereRol } from "../middleware/auth.js";
import {
  buscarAsesoriaPorCodigo,
  vinculoVigenteDeCliente,
  asegurarClienteEnCartera,
} from "../services/vinculos-asesoria.js";
import { TEXTO_AUTORIZACION_V1, VERSION_TEXTO, datosAutorizacion } from "../services/autorizacion-asesoria.js";

const router = Router();

async function tenantActual(req) {
  return Tenant.findOne({ slug: req.usuario.t });
}

function vistaVinculo(vinculo, tenantAsesoria) {
  if (!vinculo) return null;
  return {
    id: vinculo._id,
    estado: vinculo.estado,
    compartir: vinculo.compartir,
    asesoria: tenantAsesoria
      ? { nombre: tenantAsesoria.nombre, nif: tenantAsesoria.nif ?? "", ciudad: tenantAsesoria.ciudad ?? "" }
      : null,
    autorizacion: vinculo.autorizacion ?? {},
    revocacion: vinculo.revocacion ?? {},
  };
}

// Estado actual del vínculo de esta empresa.
router.get("/", async (req, res, next) => {
  try {
    const tenant = await tenantActual(req);
    if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });
    const vinculo = await vinculoVigenteDeCliente(tenant._id).lean();
    if (!vinculo) return res.json({ vinculo: null, versionTexto: VERSION_TEXTO });
    const asesoria = await Tenant.findById(vinculo.asesoria).lean();
    res.json({ vinculo: vistaVinculo(vinculo, asesoria), versionTexto: VERSION_TEXTO });
  } catch (err) {
    next(err);
  }
});

// Vista previa antes de firmar: a qué asesoría pertenece un código.
router.post("/buscar", async (req, res, next) => {
  try {
    const asesoria = await buscarAsesoriaPorCodigo(req.body?.codigo);
    if (!asesoria) {
      return res.status(404).json({ error: "No hay ninguna asesoría activa con ese código" });
    }
    const tenant = await tenantActual(req);
    if (tenant && String(tenant._id) === String(asesoria._id)) {
      return res.status(400).json({ error: "No puedes vincular tu empresa consigo misma" });
    }
    res.json({ asesoria, texto: TEXTO_AUTORIZACION_V1, versionTexto: VERSION_TEXTO });
  } catch (err) {
    next(err);
  }
});

// Firma de la autorización y activación del vínculo.
router.post("/vincular", requiereRol("admin"), async (req, res, next) => {
  try {
    const { codigo, acepto, compartir } = req.body ?? {};
    if (acepto !== true) {
      return res.status(400).json({ error: "Hay que aceptar expresamente la autorización" });
    }
    const tenant = await tenantActual(req);
    if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });

    const asesoria = await buscarAsesoriaPorCodigo(codigo);
    if (!asesoria) {
      return res.status(404).json({ error: "No hay ninguna asesoría activa con ese código" });
    }
    if (String(tenant._id) === String(asesoria._id)) {
      return res.status(400).json({ error: "No puedes vincular tu empresa consigo misma" });
    }

    const vigente = await vinculoVigenteDeCliente(tenant._id);
    if (vigente && vigente.estado === "activo") {
      return res.status(409).json({
        error: "Ya tienes una asesoría vinculada. Revoca la autorización actual antes de vincular otra.",
      });
    }

    // Puede existir un vínculo pendiente creado desde la plataforma o uno
    // revocado con esta misma asesoría: se actualiza en vez de duplicar.
    const vinculo =
      vigente ??
      (await VinculoAsesoria.findOne({ asesoria: asesoria._id, cliente: tenant._id })) ??
      new VinculoAsesoria({ asesoria: asesoria._id, cliente: tenant._id });

    if (String(vinculo.asesoria) !== String(asesoria._id)) {
      return res.status(409).json({ error: "El vínculo pendiente pertenece a otra asesoría" });
    }

    vinculo.estado = "activo";
    vinculo.compartir = {
      ventas: compartir?.ventas !== false,
      compras: compartir?.compras !== false,
      tickets: compartir?.tickets !== false,
    };
    vinculo.autorizacion = {
      versionTexto: VERSION_TEXTO,
      fechaAceptacion: new Date(),
      usuarioEmail: req.usuario.email,
      ip: req.ip ?? "",
    };
    vinculo.revocacion = undefined;
    vinculo.origen = vinculo.origen ?? "codigo";

    // Alta automática en la cartera de la asesoría con los datos fiscales
    // de la empresa (se lee de la ficha de Empresa del propio tenant).
    const empresa = await Empresa.findOne().lean();
    const tenantAsesoria = await Tenant.findById(asesoria._id);
    vinculo.clienteCarteraId = await asegurarClienteEnCartera(vinculo, tenantAsesoria, {
      nombre: empresa?.nombre ?? tenant.nombre,
      nif: empresa?.nif ?? tenant.nif ?? "",
      email: empresa?.email ?? tenant.emailContacto ?? "",
      telefono: empresa?.telefono ?? tenant.telefono ?? "",
    });

    await vinculo.save();
    res.status(201).json({ vinculo: vistaVinculo(vinculo.toObject(), tenantAsesoria.toObject()) });
  } catch (err) {
    next(err);
  }
});

// Revocación: la asesoría pierde el acceso al momento.
router.post("/revocar", requiereRol("admin"), async (req, res, next) => {
  try {
    const tenant = await tenantActual(req);
    if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });
    const vinculo = await vinculoVigenteDeCliente(tenant._id);
    if (!vinculo || vinculo.estado !== "activo") {
      return res.status(404).json({ error: "No hay ninguna autorización activa" });
    }
    vinculo.estado = "revocado";
    vinculo.revocacion = { fecha: new Date(), usuarioEmail: req.usuario.email };
    await vinculo.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Texto + datos de la autorización firmada, para imprimirla o descargarla.
router.get("/autorizacion", async (req, res, next) => {
  try {
    const tenant = await tenantActual(req);
    if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });
    const vinculo = await vinculoVigenteDeCliente(tenant._id).lean();
    if (!vinculo?.autorizacion?.fechaAceptacion) {
      return res.status(404).json({ error: "No hay ninguna autorización firmada" });
    }
    const asesoria = await Tenant.findById(vinculo.asesoria).lean();
    const empresa = await Empresa.findOne().lean();
    res.json({
      texto: TEXTO_AUTORIZACION_V1,
      datos: datosAutorizacion({
        empresa: { nombre: empresa?.nombre ?? tenant.nombre, nif: empresa?.nif ?? tenant.nif ?? "" },
        asesoria: { nombre: asesoria?.nombre ?? "", nif: asesoria?.nif ?? "" },
        vinculo,
      }),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
