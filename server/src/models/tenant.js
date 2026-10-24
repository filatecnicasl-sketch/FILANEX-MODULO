// Núcleo multi-empresa: cada petición HTTP trabaja contra la base de datos
// de su empresa. El middleware de empresa abre un contexto
// (AsyncLocalStorage) con la conexión correspondiente y los modelos de
// negocio se resuelven perezosamente contra ese contexto, así las rutas y
// servicios no necesitan saber a qué empresa pertenece la petición.
//
// La conexión por defecto de mongoose apunta a la BD plataforma (cuentas y
// empresas); las BD de negocio cuelgan de ella con useDb (pool compartido).
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

export const alsEmpresa = new AsyncLocalStorage();

const esquemas = new Map();   // nombre → schema (registro global de modelos tenant)
const conexiones = new Map(); // dbName → conexión (useDb cacheada)

function registrarEsquemas(conn) {
  for (const [nombre, schema] of esquemas) {
    if (!conn.modelNames().includes(nombre)) conn.model(nombre, schema);
  }
}

// Conexión cacheada a la BD de una empresa, con todos los esquemas
// registrados (imprescindible para que populate() resuelva los refs).
export function conexionTenant(dbName) {
  let conn = conexiones.get(dbName);
  if (!conn) {
    conn = mongoose.connection.useDb(dbName, { useCache: true });
    conexiones.set(dbName, conn);
  }
  registrarEsquemas(conn);
  return conn;
}

// Contexto de la petición actual: { conn, slug, dbName } o null (scripts).
export function contextoActual() {
  return alsEmpresa.getStore() ?? null;
}

// Slug de la empresa actual ("local" como valor seguro fuera de contexto).
export function slugActual() {
  return contextoActual()?.slug ?? "local";
}

// Vuelve a abrir un contexto de empresa capturado antes de una espera larga.
//
// Hace falta porque una llamada a un servicio externo (el OCR, por ejemplo)
// puede resolverse sobre una conexión reutilizada de otra petición; en ese
// caso el contexto que se hereda no es el de esta empresa y las escrituras
// posteriores acabarían en la base de datos equivocada. Se captura el
// contexto con contextoActual() antes de esperar y se restaura después.
export function conContexto(contexto, fn) {
  return contexto ? alsEmpresa.run(contexto, fn) : fn();
}

// Proxy perezoso de un modelo de negocio: cada acceso se resuelve contra la
// conexión del contexto actual. Fuera de contexto (scripts CLI) usa la
// conexión por defecto de mongoose. Soporta tanto Modelo.find(...) como
// new Modelo({...}).
export function modeloTenant(nombre, schema) {
  if (!esquemas.has(nombre)) {
    esquemas.set(nombre, schema);
    for (const conn of conexiones.values()) registrarEsquemas(conn);
  }
  const obtener = () => {
    const conn = contextoActual()?.conn ?? mongoose.connection;
    return conn.model(nombre, schema);
  };
  return new Proxy(function () {}, {
    get(_t, prop) {
      const modelo = obtener();
      const valor = modelo[prop];
      return typeof valor === "function" ? valor.bind(modelo) : valor;
    },
    has(_t, prop) {
      return prop in obtener();
    },
    construct(_t, args) {
      const Modelo = obtener();
      return new Modelo(...args);
    },
  });
}

// Subidas aisladas por empresa: los archivos nuevos van a
// uploads/<slug>/<subcarpeta> y la URL guardada incluye el slug
// (/uploads/local/taller/x.jpg). Los archivos anteriores a la multiempresa
// siguen sirviéndose desde su ruta antigua (uploads/<subcarpeta>).
export function dirUploads(subcarpeta = "") {
  const dir = path.join(process.cwd(), "uploads", slugActual(), subcarpeta);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function urlUploads(subcarpeta = "") {
  return `/uploads/${slugActual()}${subcarpeta ? `/${subcarpeta}` : ""}`;
}
