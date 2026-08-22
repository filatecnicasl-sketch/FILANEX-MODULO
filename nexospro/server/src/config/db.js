// Conexión a MongoDB en modo multiempresa: la conexión por defecto apunta a
// la BD plataforma (cuentas y empresas). Las BD de negocio —una por empresa—
// se derivan de ella con useDb bajo demanda (ver models/tenant.js).
import mongoose from "mongoose";

// Falla rápido si no hay conexión, en lugar de encolar operaciones.
mongoose.set("bufferCommands", false);

// URI base sin nombre de base de datos (p.ej. mongodb://localhost:27017).
// Si solo existe la MONGODB_URI antigua (con BD), se deriva quitando la BD.
export function uriBase() {
  if (process.env.MONGODB_URI_BASE) {
    return process.env.MONGODB_URI_BASE.replace(/\/+$/, "");
  }
  return (process.env.MONGODB_URI ?? "").replace(/\/[^/?]+(\?.*)?$/, "");
}

export function nombreBdPlataforma() {
  return process.env.BD_PLATAFORMA || "filanex_plataforma";
}

// Prefijo de las BD de negocio nuevas: <prefijo><slug> (p.ej. filanex_acme).
export function prefijoBd() {
  return process.env.PREFIJO_BD || "filanex_";
}

export async function connectDB() {
  const base = uriBase();
  if (!base) {
    console.warn("MONGODB_URI_BASE no definida: la API arranca sin base de datos.");
    return;
  }
  try {
    await mongoose.connect(`${base}/${nombreBdPlataforma()}`);
    console.log(`MongoDB conectado (plataforma: ${nombreBdPlataforma()}).`);
  } catch (err) {
    console.error("No se pudo conectar a MongoDB:", err.message);
  }
}
