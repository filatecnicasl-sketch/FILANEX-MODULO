import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "./config/db.js";
import apiRouter from "./routes/index.js";
import uploadsRouter from "./routes/uploads.js";
import whatsappWebhook from "./routes/whatsapp-webhook.js";
import backupsAgente from "./routes/backups-agente.js";
import { iniciarReintentoVerifactu } from "./services/verifactu-reintento.js";
import { iniciarColaWhatsApp } from "./services/whatsapp-cola.js";
import { iniciarCopiasSeguridad } from "./services/backup.js";
import { asegurarTareaCopiaWindows, asegurarArranqueWindows } from "./services/backup-tarea.js";

import { cerrarPoolPdf } from "./services/pdfRenderer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Detrás de Nginx (producción): sin esto Express ve siempre la IP del proxy
// (127.0.0.1) y el rate limiting agruparía a TODOS los clientes en el mismo
// cupo, de forma que un usuario podría bloquear el login de los demás.
app.set("trust proxy", 1);

// CORS restringido al frontend permitido y orígenes locales.
const permitidos = new Set([
  process.env.FRONTEND_URL,
  "http://localhost:4700",
  "http://localhost:5173",
  "http://127.0.0.1:4700",
  "http://127.0.0.1:5173",
].filter(Boolean));
app.use(cors({
  origin(origin, cb) {
    if (!origin || permitidos.has(origin)) return cb(null, true);
    const error = new Error("Origen no permitido");
    error.status = 403;
    cb(error);
  },
  credentials: true,
}));

app.use(express.json({
  limit: "2mb",
  verify(req, res, buffer) {
    if (req.originalUrl.startsWith("/api/whatsapp/webhook")) req.rawBody = Buffer.from(buffer);
  },
}));

app.use("/api/whatsapp/webhook", whatsappWebhook);
app.use("/api/backups-agente", backupsAgente);

// Rate limiting: protege login, bootstrap y la API en general.
const limitadorAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera unos minutos." },
});
const limitadorApi = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: process.env.STRESS_TEST === "true" ? 100000 : Number(process.env.API_RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Ralentiza un poco." },
});

// Archivos: el backend actúa como proxy frente a S3/R2 o disco local.
// El router sirve tanto /uploads/* como /cert/*.
app.use(uploadsRouter);

// Health check: debe responder incluso cuando se sirve el frontend compilado.
// `entorno` permite al cliente avisar cuando no está en producción (local o
// pruebas), para que nadie trabaje por error sobre datos que no son reales.
const responderHealth = (req, res) => {
  res.json({
    ok: true,
    servicio: "nexospro-api",
    version: "0.1.0",
    entorno: process.env.ENTORNO || "local",
  });
};
app.get("/health", responderHealth);
app.get("/api/health", responderHealth);

// API protegida por rate limiting general.
app.use("/api", limitadorApi, apiRouter);

// Descarga pública del agente de copia local: el instalador que se le lleva
// al cliente. Solo es un ZIP con un script, sin datos ni claves dentro.
const agenteZip = path.resolve(__dirname, "../agente/filanex-agente-copia.zip");
if (fs.existsSync(agenteZip)) {
  app.get("/agente/filanex-agente-copia.zip", (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Disposition", "attachment; filename=\"filanex-agente-copia.zip\"");
    res.sendFile(agenteZip);
  });
}

// Producción: la API sirve también el cliente compilado (client/dist).
// Así todo NEXOSPRO corre en un único puerto y un único proceso.
const distDir = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, {
    setHeaders(res, filePath) {
      // El index.html nunca se cachea: así cada recarga trae la última versión
      // (los assets JS/CSS llevan hash y sí se cachean con seguridad).
      // El service worker y el manifiesto tampoco: si el navegador guardase un
      // sw.js viejo, la app se quedaría anclada a una versión anterior.
      const nombre = path.basename(filePath);
      if (nombre === "index.html" || nombre === "sw.js" || nombre === "manifest.webmanifest") {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    },
  }));
  app.get(/^\/(?!api\/|uploads\/|cert\/).*/, (req, res) => {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((err, req, res, next) => {
  if (err?.name === "MongooseError") {
    return res.status(503).json({ error: "Base de datos no disponible" });
  }
  if (err?.status === 403) {
    return res.status(403).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 4700;
connectDB()
  .then(() => {
    iniciarReintentoVerifactu();
    iniciarColaWhatsApp();
    iniciarCopiasSeguridad();
    asegurarTareaCopiaWindows();
    asegurarArranqueWindows();
  })
  .finally(() => {
    const server = app.listen(PORT, () => {
      console.log(`NEXOSPRO API escuchando en http://localhost:${PORT}`);
    });

    function cerrar(salir = false) {
      cerrarPoolPdf().finally(() => {
        server.close(() => {
          if (salir) process.exit(0);
        });
      });
    }

    process.on("SIGINT", () => cerrar(true));
    process.on("SIGTERM", () => cerrar(true));
  });
