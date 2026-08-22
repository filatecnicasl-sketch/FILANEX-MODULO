// Certificado electrónico de la empresa (VeriFactu / FACe).
// Multiempresa: cada empresa guarda el suyo — el archivo en
// certificados/<slug>-aeat.pfx y la contraseña cifrada en la ficha de la
// empresa (su propia base de datos). El servicio VeriFactu lo lee de ahí al
// firmar y remitir a la AEAT.
import { Router } from "express";
import tls from "node:tls";
import path from "node:path";
import { statSync } from "node:fs";
import Empresa from "../models/Empresa.js";
import { slugActual } from "../models/tenant.js";
import { contextoTrasSubida } from "../middleware/empresa.js";
import { cifrar, descifrar } from "../services/cifrado.js";
import { actualizarEnv } from "../services/env.js";
import { uploadMemoria } from "../middleware/upload.js";
import {
  guardarArchivo,
  leerArchivo,
  existeArchivo,
  borrarArchivo,
  urlPublica,
} from "../services/storage.js";

const router = Router();

const s3Activo = () => Boolean(process.env.R2_ENDPOINT || process.env.S3_ENDPOINT);
const rutaCertificado = () => `certificados/${slugActual()}-aeat.pfx`;
const urlCertificado = () => urlPublica(rutaCertificado());

async function estado() {
  const empresa = await Empresa.findOne().select("certificado").lean();
  const cert = empresa?.certificado;
  const remoto = rutaCertificado();
  const existe = await existeArchivo(remoto);
  let fecha = null;
  if (existe && !s3Activo()) {
    try {
      fecha = statSync(path.join(process.cwd(), remoto)).mtime;
    } catch {
      fecha = null;
    }
  }
  return {
    configurado: existe,
    archivo: existe ? path.basename(remoto) : null,
    fecha,
    conPass: Boolean(cert?.passCifrada),
    entorno: process.env.AEAT_ENTORNO === "produccion" ? "produccion" : "pruebas",
  };
}

router.get("/", async (req, res, next) => {
  try {
    res.json(await estado());
  } catch (err) {
    next(err);
  }
});

// Sube y valida el certificado (.pfx / .p12) con su contraseña.
router.post("/", [uploadMemoria.single("certificado"), contextoTrasSubida], async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se ha subido ningún archivo" });
    const nombre = (req.file.originalname ?? "").toLowerCase();
    if (!nombre.endsWith(".pfx") && !nombre.endsWith(".p12")) {
      return res.status(400).json({ error: "El certificado debe ser un archivo .pfx o .p12" });
    }
    const pass = String(req.body.pass ?? "");
    if (!pass) return res.status(400).json({ error: "Indica la contraseña del certificado" });

    // Valida de verdad: si la contraseña no es correcta o el archivo está
    // dañado, createSecureContext lanza y no guardamos nada.
    try {
      tls.createSecureContext({ pfx: req.file.buffer, passphrase: pass });
    } catch {
      return res.status(400).json({
        error: "El certificado no se pudo leer: contraseña incorrecta o archivo dañado",
      });
    }

    const empresa = await Empresa.findOne();
    if (!empresa) {
      return res.status(409).json({ error: "Configura primero los datos de la empresa" });
    }
    const remoto = rutaCertificado();
    await guardarArchivo(remoto, req.file.buffer, req.file.mimetype || "application/x-pkcs12");
    empresa.certificado = { ruta: urlCertificado(), passCifrada: cifrar(pass) };
    await empresa.save();
    res.json(await estado());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cambia el entorno VeriFactu (pruebas / produccion). Es un ajuste global
// del servidor, común a todas las empresas de la instalación.
router.put("/entorno", (req, res) => {
  const entorno = req.body.entorno === "produccion" ? "produccion" : "pruebas";
  actualizarEnv({ AEAT_ENTORNO: entorno });
  estado().then(
    (e) => res.json(e),
    () => res.json({ entorno })
  );
});

// Revalida el certificado guardado (detecta borrado/corrupción posterior).
router.get("/probar", async (req, res) => {
  try {
    const empresa = await Empresa.findOne().select("certificado").lean();
    const cert = empresa?.certificado;
    const remoto = rutaCertificado();
    if (!cert?.ruta || !(await existeArchivo(remoto))) {
      return res.status(503).json({ ok: false, error: "No hay certificado cargado" });
    }
    const pfx = await leerArchivo(remoto);
    tls.createSecureContext({
      pfx,
      passphrase: cert.passCifrada ? descifrar(cert.passCifrada) : "",
    });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, error: "El certificado guardado ya no es válido" });
  }
});

router.delete("/", async (req, res) => {
  try {
    const empresa = await Empresa.findOne();
    if (empresa?.certificado?.ruta) {
      await borrarArchivo(rutaCertificado()).catch(() => {});
    }
    if (empresa) {
      empresa.certificado = undefined;
      await empresa.save();
    }
    res.json(await estado());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
