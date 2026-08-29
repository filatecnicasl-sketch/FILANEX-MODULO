// Copias de seguridad por empresa: exporta TODAS las colecciones de la base
// de datos de la empresa a un ZIP (un archivo JSON por colección, en formato
// EJSON para conservar fechas, ObjectId y decimales tal cual) y lo guarda a
// través del adaptador de almacenamiento. Si hay S3/R2 configurado, la copia
// sale automáticamente del servidor; si no, queda en la carpeta backups/.
//
// Además lleva un programador diario que recorre todas las empresas activas
// y genera su copia (mismo patrón que el reintento de VeriFactu),
// conservando solo las últimas BACKUP_RETENER automáticas por empresa.
import { EJSON } from "bson";
import archiver from "archiver";
import fs from "node:fs";
import path from "node:path";
import Tenant from "../models/plataforma/Tenant.js";
import { conexionTenant } from "../models/tenant.js";
import { guardarArchivo, leerArchivo, borrarArchivo, listarArchivos } from "./storage.js";

const RETENER = Number(process.env.BACKUP_RETENER) || 14;
const HORA = process.env.BACKUP_HORA || "03:30";

// Carpeta elegida por el administrador del servidor para las copias
// (automáticas y manuales). Si BACKUP_DIR está definida y NO hay S3/R2, las
// copias van a esa carpeta (puede ser un disco externo, un NAS montado, etc.).
// Sin BACKUP_DIR, se usa el almacenamiento por defecto: la carpeta backups/
// del servidor, o el bucket S3/R2 cuando esté configurado.
const CARPETA = process.env.BACKUP_DIR?.trim() || null;
const S3_ACTIVO = Boolean(process.env.R2_ENDPOINT || process.env.S3_ENDPOINT);
const USA_CARPETA = Boolean(CARPETA) && !S3_ACTIVO;

/** Dónde se guardan las copias, para mostrarlo en Ajustes → Copias. */
export function almacenCopias() {
  if (S3_ACTIVO) return { tipo: "s3", descripcion: "almacenamiento externo (S3/R2), fuera del servidor" };
  if (USA_CARPETA) return { tipo: "carpeta", descripcion: CARPETA };
  return { tipo: "local", descripcion: "carpeta backups/ dentro del servidor" };
}

function rutaDisco(slug, archivo) {
  return path.join(CARPETA, slug, archivo);
}

async function guardarCopiaZip(slug, archivo, buffer) {
  if (USA_CARPETA) {
    const destino = rutaDisco(slug, archivo);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, buffer);
    return;
  }
  await guardarArchivo(rutaCopia(slug, archivo), buffer, "application/zip");
}

async function listarCopiasDisco(slug) {
  const dir = path.join(CARPETA, slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => fs.statSync(path.join(dir, f)).isFile())
    .map((f) => {
      const st = fs.statSync(path.join(dir, f));
      return { archivo: f, tamano: st.size, fecha: st.mtime };
    });
}

async function leerCopiaZip(slug, archivo) {
  if (USA_CARPETA) {
    const p = rutaDisco(slug, archivo);
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
  }
  try {
    return await leerArchivo(rutaCopia(slug, archivo));
  } catch {
    return null;
  }
}

async function borrarCopiaZip(slug, archivo) {
  if (USA_CARPETA) {
    const p = rutaDisco(slug, archivo);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return;
  }
  await borrarArchivo(rutaCopia(slug, archivo));
}

export const PATRON_NOMBRE = /^backup-(auto|manual)-\d{8}-\d{6}\.zip$/;

function nombreCopia(origen, fecha = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  const sello = `${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}-${p(fecha.getHours())}${p(fecha.getMinutes())}${p(fecha.getSeconds())}`;
  return `backup-${origen}-${sello}.zip`;
}

export function rutaCopia(slug, archivo) {
  return `backups/${slug}/${archivo}`;
}

function empaquetar(entradas) {
  return new Promise((resolve, reject) => {
    const zip = archiver("zip", { zlib: { level: 9 } });
    const trozos = [];
    zip.on("data", (t) => trozos.push(t));
    zip.on("end", () => resolve(Buffer.concat(trozos)));
    zip.on("error", reject);
    for (const { nombre, contenido } of entradas) zip.append(contenido, { name: nombre });
    zip.finalize();
  });
}

// Genera la copia completa de una empresa y la guarda. Devuelve su ficha.
export async function crearCopiaTenant({ slug, dbName, origen = "manual" }) {
  const conn = conexionTenant(dbName);
  const colecciones = await conn.db.listCollections().toArray();
  const entradas = [];
  const resumen = [];
  let total = 0;
  for (const { name } of colecciones) {
    const docs = await conn.db.collection(name).find({}).toArray();
    entradas.push({ nombre: `colecciones/${name}.json`, contenido: EJSON.stringify(docs, null, 1) });
    resumen.push({ nombre: name, documentos: docs.length });
    total += docs.length;
  }
  const metadatos = {
    aplicacion: "FILANEX",
    version: 1,
    fecha: new Date().toISOString(),
    empresa: { slug, dbName },
    origen,
    totalDocumentos: total,
    colecciones: resumen,
  };
  entradas.unshift({ nombre: "metadatos.json", contenido: JSON.stringify(metadatos, null, 2) });
  const zip = await empaquetar(entradas);
  const archivo = nombreCopia(origen);
  await guardarCopiaZip(slug, archivo, zip);
  return {
    archivo,
    tamano: zip.length,
    fecha: metadatos.fecha,
    origen,
    colecciones: resumen.length,
    documentos: total,
  };
}

export async function listarCopias(slug) {
  const archivos = USA_CARPETA
    ? await listarCopiasDisco(slug)
    : (await listarArchivos(`backups/${slug}`)).map((a) => ({
        archivo: a.ruta.split("/").pop(),
        tamano: a.tamano,
        fecha: a.fecha,
      }));
  return archivos
    .map((a) => {
      if (!PATRON_NOMBRE.test(a.archivo)) return null;
      return {
        archivo: a.archivo,
        tamano: a.tamano,
        fecha: a.fecha,
        origen: a.archivo.startsWith("backup-auto") ? "auto" : "manual",
      };
    })
    .filter(Boolean)
    .sort((x, y) => (x.archivo < y.archivo ? 1 : -1));
}

export async function descargarCopia(slug, archivo) {
  if (!PATRON_NOMBRE.test(archivo)) return null;
  return leerCopiaZip(slug, archivo);
}

export async function borrarCopia(slug, archivo) {
  if (!PATRON_NOMBRE.test(archivo)) throw new Error("Nombre de copia no válido");
  await borrarCopiaZip(slug, archivo);
}

// Deja solo las RETENER automáticas más recientes. Las manuales no se tocan:
// las creó el usuario a propósito y él decide cuándo borrarlas.
async function purgarCopias(slug) {
  const copias = await listarCopias(slug);
  const automaticas = copias.filter((c) => c.origen === "auto");
  for (const vieja of automaticas.slice(RETENER)) {
    await borrarCopiaZip(slug, vieja.archivo);
  }
}

function msHastaProxima() {
  const [h, m] = HORA.split(":").map(Number);
  const ahora = new Date();
  const proxima = new Date(ahora);
  proxima.setHours(h || 3, m || 30, 0, 0);
  if (proxima <= ahora) proxima.setDate(proxima.getDate() + 1);
  return proxima - ahora;
}

// Programador diario: primera pasada a la hora BACKUP_HORA y luego cada 24 h.
export function iniciarCopiasSeguridad() {
  if (process.env.BACKUP_DESACTIVADO === "true") return;
  const pasada = async () => {
    let tenants = [];
    try {
      tenants = await Tenant.find({ estado: { $nin: ["inactivo", "suspendido"] } }).lean();
    } catch (e) {
      console.warn("[backup] No se pudieron listar las empresas:", e.message);
      return;
    }
    for (const tenant of tenants) {
      try {
        const info = await crearCopiaTenant({ slug: tenant.slug, dbName: tenant.dbName, origen: "auto" });
        await purgarCopias(tenant.slug);
        console.log(
          `[backup] Copia diaria (${tenant.slug}): ${info.documentos} documentos, ${(info.tamano / 1024 / 1024).toFixed(1)} MB`
        );
      } catch (e) {
        console.warn(`[backup] Copia fallida (${tenant.slug}):`, e.message);
      }
    }
  };
  setTimeout(() => {
    pasada();
    setInterval(pasada, 24 * 60 * 60 * 1000);
  }, msHastaProxima());
  console.log(`[backup] Copias diarias a las ${HORA}; se conservan ${RETENER} automáticas por empresa`);
}
