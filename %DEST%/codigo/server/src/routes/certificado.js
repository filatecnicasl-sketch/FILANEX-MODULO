// Certificado electrónico del representante (VeriFactu / FACe).
// El .pfx se guarda en server/certificados/ y la ruta y contraseña en .env,
// que es donde los lee el servicio VeriFactu al firmar y remitir a la AEAT.
import { Router } from "express";
import multer from "multer";
import tls from "node:tls";
import path from "node:path";
import {
  existsSync, mkdirSync, writeFileSync, unlinkSync, statSync, readFileSync,
} from "node:fs";
import { actualizarEnv, borrarEnv } from "../services/env.js";

const router = Router();

const DIR_CERTS = path.resolve(process.cwd(), "certificados");
const NOMBRE_CERT = "certificado-aeat.pfx";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function estado() {
  const pfx = process.env.AEAT_CERT_PFX ? path.resolve(process.env.AEAT_CERT_PFX) : "";
  const existe = Boolean(pfx) && existsSync(pfx);
  return {
    configurado: existe,
    archivo: existe ? path.basename(pfx) : null,
    fecha: existe ? statSync(pfx).mtime : null,
    conPass: Boolean(process.env.AEAT_CERT_PASS),
    entorno: process.env.AEAT_ENTORNO === "produccion" ? "produccion" : "pruebas",
  };
}

router.get("/", (req, res) => res.json(estado()));

// Sube y valida el certificado (.pfx / .p12) con su contraseña.
router.post("/", upload.single("certificado"), (req, res) => {
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

    mkdirSync(DIR_CERTS, { recursive: true });
    const destino = path.join(DIR_CERTS, NOMBRE_CERT);
    writeFileSync(destino, req.file.buffer);
    actualizarEnv({ AEAT_CERT_PFX: destino, AEAT_CERT_PASS: pass });
    res.json(estado());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cambia el entorno VeriFactu (pruebas / produccion).
router.put("/entorno", (req, res) => {
  const entorno = req.body.entorno === "produccion" ? "produccion" : "pruebas";
  actualizarEnv({ AEAT_ENTORNO: entorno });
  res.json(estado());
});

// Revalida el certificado guardado (detecta borrado/corrupción posterior).
router.get("/probar", (req, res) => {
  try {
    const pfx = process.env.AEAT_CERT_PFX ? path.resolve(process.env.AEAT_CERT_PFX) : "";
    if (!pfx || !existsSync(pfx)) {
      return res.status(503).json({ ok: false, error: "No hay certificado cargado" });
    }
    tls.createSecureContext({
      pfx: readFileSync(pfx),
      passphrase: process.env.AEAT_CERT_PASS ?? "",
    });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, error: "El certificado guardado ya no es válido" });
  }
});

router.delete("/", (req, res) => {
  try {
    const pfx = process.env.AEAT_CERT_PFX ? path.resolve(process.env.AEAT_CERT_PFX) : "";
    if (pfx && existsSync(pfx)) unlinkSync(pfx);
    borrarEnv(["AEAT_CERT_PFX", "AEAT_CERT_PASS"]);
    res.json(estado());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
