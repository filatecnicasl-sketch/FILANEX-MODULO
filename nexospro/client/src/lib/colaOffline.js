// Cola de trabajos sin conexión.
//
// Cuando el móvil o la tableta se queda sin red, lo que el usuario guarda no
// se pierde: se apunta aquí (IndexedDB, sobrevive a cerrar la aplicación y a
// reiniciar el aparato) y se sube en cuanto vuelve la conexión, en el mismo
// orden en que se hizo y de una en una, para que una orden nunca se suba
// antes que el vehículo del que depende.
//
// Cada trabajo lleva una clave propia (X-Idem-Key): si la petición llegó al
// servidor y solo se perdió la respuesta, el reenvío no duplica nada.

import { nuevoIdTemporal, reglaOffline, respuestaSintetica } from "./rutasOffline.js";

const BD = "filanex-cola";
const VERSION = 1;
const OPS = "operaciones";
const FICHEROS = "ficheros";
const MAPA = "mapa";
const EVENTO = "filanex:cola";

let promesaBD = null;

function abrir() {
  if (promesaBD) return promesaBD;
  promesaBD = new Promise((resolver, rechazar) => {
    const solicitud = indexedDB.open(BD, VERSION);
    solicitud.onupgradeneeded = () => {
      const bd = solicitud.result;
      if (!bd.objectStoreNames.contains(OPS)) {
        bd.createObjectStore(OPS, { keyPath: "id", autoIncrement: true });
      }
      if (!bd.objectStoreNames.contains(FICHEROS)) {
        const almacen = bd.createObjectStore(FICHEROS, { keyPath: "id", autoIncrement: true });
        almacen.createIndex("operacion", "operacion");
      }
      if (!bd.objectStoreNames.contains(MAPA)) {
        bd.createObjectStore(MAPA, { keyPath: "temporal" });
      }
    };
    solicitud.onsuccess = () => resolver(solicitud.result);
    solicitud.onerror = () => rechazar(solicitud.error);
  });
  return promesaBD;
}

function comoPromesa(peticion) {
  return new Promise((resolver, rechazar) => {
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
  });
}

async function conAlmacen(nombres, modo, trabajo) {
  const bd = await abrir();
  const tx = bd.transaction(nombres, modo);
  // El final de la transacción se vigila antes de trabajar: si se registrase
  // después, podría haber terminado ya y la espera no acabaría nunca.
  const terminada = new Promise((resolver, rechazar) => {
    tx.oncomplete = resolver;
    tx.onerror = () => rechazar(tx.error);
    tx.onabort = () => rechazar(tx.error);
  });
  const resultado = await trabajo(...nombres.map((n) => tx.objectStore(n)));
  await terminada;
  return resultado;
}

function avisar() {
  window.dispatchEvent(new CustomEvent(EVENTO));
}

// ---------- Lectura ----------

export async function listarPendientes() {
  const lista = await conAlmacen([OPS], "readonly", (ops) => comoPromesa(ops.getAll()));
  return lista.sort((a, b) => a.id - b.id);
}

export async function contarPendientes() {
  const lista = await listarPendientes();
  return {
    total: lista.length,
    conError: lista.filter((o) => o.estado === "error").length,
  };
}

// ---------- Escritura ----------

/**
 * Apunta un trabajo y devuelve la respuesta que verá la pantalla.
 * `ficheros`: [{ campo, blob, nombre }] para las fotos.
 */
export async function encolar({ metodo, url, cuerpo, ficheros = [], regla }) {
  const idTemporal = nuevoIdTemporal();
  const operacion = {
    metodo: String(metodo).toUpperCase(),
    url,
    cuerpo: cuerpo ?? null,
    etiqueta: regla?.etiqueta ?? url,
    tipo: regla?.tipo ?? null,
    idTemporal,
    clave: `${idTemporal}-${Date.now()}`,
    estado: "pendiente",
    error: null,
    intentos: 0,
    creadoEn: new Date().toISOString(),
    tieneFicheros: ficheros.length > 0,
  };

  const sintetica = respuestaSintetica(regla ?? {}, cuerpo, idTemporal);
  // La recepción exprés devuelve dos documentos: el identificador temporal de
  // la orden es el que luego usarán las fotos y la firma.
  const idReferencia = sintetica?.orden?._id ?? idTemporal;
  operacion.idTemporal = idReferencia;

  const id = await conAlmacen([OPS], "readwrite", (ops) => comoPromesa(ops.add(operacion)));
  if (ficheros.length) {
    await conAlmacen([FICHEROS], "readwrite", async (almacen) => {
      for (const f of ficheros) {
        await comoPromesa(almacen.add({ operacion: id, campo: f.campo, blob: f.blob, nombre: f.nombre }));
      }
    });
  }
  avisar();
  return sintetica;
}

export async function descartar(id) {
  await conAlmacen([OPS], "readwrite", (ops) => comoPromesa(ops.delete(id)));
  const ficheros = await conAlmacen([FICHEROS], "readonly", (almacen) =>
    comoPromesa(almacen.index("operacion").getAllKeys(id))
  );
  if (ficheros.length) {
    await conAlmacen([FICHEROS], "readwrite", async (almacen) => {
      for (const clave of ficheros) await comoPromesa(almacen.delete(clave));
    });
  }
  avisar();
}

export async function reintentar(id) {
  await conAlmacen([OPS], "readwrite", async (ops) => {
    const op = await comoPromesa(ops.get(id));
    if (op) await comoPromesa(ops.put({ ...op, estado: "pendiente", error: null }));
  });
  avisar();
  return procesarCola();
}

// ---------- Identificadores temporales ----------

async function guardarEquivalencia(temporal, real) {
  if (!temporal || !real) return;
  await conAlmacen([MAPA], "readwrite", (mapa) => comoPromesa(mapa.put({ temporal, real })));
}

async function leerMapa() {
  const filas = await conAlmacen([MAPA], "readonly", (mapa) => comoPromesa(mapa.getAll()));
  return new Map(filas.map((f) => [f.temporal, f.real]));
}

// Sustituye los identificadores temporales por los reales, tanto en la
// dirección como dentro del cuerpo (a cualquier profundidad).
function sustituirTexto(texto, mapa) {
  return String(texto).replace(/tmp_[a-z0-9]+/gi, (marca) => mapa.get(marca) ?? marca);
}

function sustituirValor(valor, mapa) {
  if (typeof valor === "string") return sustituirTexto(valor, mapa);
  if (Array.isArray(valor)) return valor.map((v) => sustituirValor(v, mapa));
  if (valor && typeof valor === "object") {
    const salida = {};
    for (const [clave, v] of Object.entries(valor)) salida[clave] = sustituirValor(v, mapa);
    return salida;
  }
  return valor;
}

function quedanMarcas(texto) {
  return /tmp_[a-z0-9]+/i.test(texto);
}

// ---------- Subida ----------

let subiendo = false;

async function ficherosDe(id) {
  return conAlmacen([FICHEROS], "readonly", (almacen) => comoPromesa(almacen.index("operacion").getAll(id)));
}

async function enviar(op, mapa) {
  const url = sustituirTexto(op.url, mapa);
  const cuerpo = op.cuerpo ? sustituirValor(op.cuerpo, mapa) : null;
  if (quedanMarcas(url) || (cuerpo && quedanMarcas(JSON.stringify(cuerpo)))) {
    const error = new Error("Depende de algo que todavía no se ha subido");
    error.definitivo = true;
    throw error;
  }

  const cabeceras = { "X-Idem-Key": op.clave };
  let datos;
  if (op.tieneFicheros) {
    const formulario = new FormData();
    for (const f of await ficherosDe(op.id)) {
      formulario.append(f.campo, f.blob, f.nombre);
    }
    datos = formulario;
  } else if (cuerpo) {
    cabeceras["Content-Type"] = "application/json";
    datos = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch(url, { method: op.metodo, headers: cabeceras, body: datos, __cola: true });
  if (!respuesta.ok) {
    let mensaje = `El servidor respondió ${respuesta.status}`;
    try {
      const json = await respuesta.json();
      if (json?.error) mensaje = json.error;
    } catch {
      // Respuesta sin JSON: se queda el mensaje genérico.
    }
    const error = new Error(mensaje);
    // 4xx no se arregla reintentando solo: lo tiene que ver una persona.
    error.definitivo = respuesta.status >= 400 && respuesta.status < 500;
    throw error;
  }
  return respuesta.json().catch(() => ({}));
}

/**
 * Sube lo pendiente. Se detiene en el primer fallo para no romper el orden:
 * lo que va detrás casi siempre depende de lo que va delante.
 */
export async function procesarCola() {
  if (subiendo) return;
  if (!navigator.onLine) return;
  subiendo = true;
  try {
    const pendientes = (await listarPendientes()).filter((o) => o.estado !== "error");
    if (!pendientes.length) return;
    const mapa = await leerMapa();

    for (const op of pendientes) {
      try {
        const resultado = await enviar(op, mapa);
        const real = resultado?.orden?._id ?? resultado?._id;
        if (real) {
          mapa.set(op.idTemporal, String(real));
          await guardarEquivalencia(op.idTemporal, String(real));
        }
        if (resultado?.vehiculo?._id) {
          // El vehículo de la recepción exprés no se referencia después, pero
          // se guarda igual por si alguna pantalla lo necesitase.
          await guardarEquivalencia(`${op.idTemporal}-vehiculo`, String(resultado.vehiculo._id));
        }
        await descartar(op.id);
      } catch (error) {
        if (error?.definitivo) {
          await conAlmacen([OPS], "readwrite", async (ops) => {
            const actual = await comoPromesa(ops.get(op.id));
            if (actual) {
              await comoPromesa(
                ops.put({ ...actual, estado: "error", error: error.message, intentos: (actual.intentos ?? 0) + 1 })
              );
            }
          });
          avisar();
          continue;
        }
        // Sigue sin red: se deja tal cual y se prueba en el próximo intento.
        break;
      }
    }
  } finally {
    subiendo = false;
    avisar();
  }
}

// Sube al arrancar y cada vez que vuelve la conexión (Safari de iPhone no
// admite sincronización en segundo plano, así que este es el momento real:
// el usuario abre la aplicación y la cola se vacía).
export function arrancarCola() {
  if (window.__colaFilanex) return;
  window.__colaFilanex = true;
  window.addEventListener("online", () => procesarCola());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") procesarCola();
  });
  setTimeout(() => procesarCola(), 1500);
  setInterval(() => procesarCola(), 60000);
}

export { reglaOffline };
