import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "./config/db.js";
import apiRouter from "./routes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

app.use("/api", apiRouter);

// Producción: la API sirve también el cliente compilado (client/dist).
// Así todo NEXOSPRO corre en un único puerto y un único proceso.
const distDir = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, {
    setHeaders(res, filePath) {
      // El index.html nunca se cachea: así cada recarga trae la última versión
      // (los assets JS/CSS llevan hash y sí se cachean con seguridad).
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    },
  }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((err, req, res, next) => {
  if (err?.name === "MongooseError") {
    return res.status(503).json({ error: "Base de datos no disponible" });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 4700;
connectDB().finally(() => {
  app.listen(PORT, () => {
    console.log(`NEXOSPRO API escuchando en http://localhost:${PORT}`);
  });
});
