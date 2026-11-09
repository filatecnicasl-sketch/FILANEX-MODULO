import { BUILTIN_TEMPLATES } from "./builtinTemplates.js";

const LS_KEY = "nexospro-formatos-v1";
const LS_MIGRATED = "nexospro-formatos-migrated";
const colasGuardado = new Map();
const versiones = new Map();

const BUILTIN_MAP = Object.fromEntries(
  BUILTIN_TEMPLATES.map((builder) => {
    const t = builder();
    return [t.builtin || t.tipoDocumento, builder];
  })
);

export const BUILTIN_LIST = BUILTIN_TEMPLATES.map((builder) => {
  const t = builder();
  return { key: t.builtin || t.tipoDocumento, name: t.name, tipoDocumento: t.tipoDocumento };
});

async function fetchJson(url, options = {}) {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

async function seedServer() {
  const existing = await fetchJson("/api/formatos");
  if (existing.length > 0) return existing;

  // Migrar plantillas antiguas de localStorage si las hay y aún no se migraron.
  const migrated = localStorage.getItem(LS_MIGRATED);
  if (!migrated) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const t of parsed) {
            if (!t.tipoDocumento) t.tipoDocumento = "generico";
            await fetchJson("/api/formatos/importar", {
              method: "POST",
              body: JSON.stringify(t),
            });
          }
          localStorage.setItem(LS_MIGRATED, "1");
          return fetchJson("/api/formatos");
        }
      }
    } catch {
      // datos corruptos: se ignoran
    }
  }

  // Crear plantillas de fábrica.
  for (const builder of BUILTIN_TEMPLATES) {
    const t = builder();
    await fetchJson("/api/formatos", {
      method: "POST",
      body: JSON.stringify({
        tipoDocumento: t.tipoDocumento,
        nombre: t.name,
        page: t.page,
        elements: t.elements,
        cssExtra: t.cssExtra,
      }),
    });
  }
  return fetchJson("/api/formatos");
}

export async function loadTemplates() {
  try {
    let docs = await fetchJson("/api/formatos");
    if (docs.length === 0) {
      docs = await seedServer();
    }
    for (const doc of docs) versiones.set(doc._id, doc.__v ?? 0);
    return docs.map((d) => ({
      id: d._id,
      version: d.__v ?? 0,
      tipoDocumento: d.tipoDocumento,
      name: d.nombre,
      porDefecto: d.porDefecto,
      page: d.page,
      elements: d.elements,
      cssExtra: d.cssExtra,
      updatedAt: d.updatedAt,
    }));
  } catch (err) {
    console.error("[formatos] No se pudieron cargar del servidor:", err.message);
    // Fallback offline.
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return BUILTIN_TEMPLATES.map((b) => b());
  }
}

export async function saveTemplate(template) {
  const clave = template.id || "nuevo";
  const anterior = colasGuardado.get(clave) ?? Promise.resolve();
  const siguiente = anterior.catch(() => {}).then(() => guardarTemplate(template));
  colasGuardado.set(clave, siguiente);
  try {
    return await siguiente;
  } finally {
    if (colasGuardado.get(clave) === siguiente) colasGuardado.delete(clave);
  }
}

async function guardarTemplate(template) {
  try {
    if (!template.id) {
      const created = await fetchJson("/api/formatos", {
        method: "POST",
        body: JSON.stringify({
          tipoDocumento: template.tipoDocumento,
          nombre: template.name,
          page: template.page,
          elements: template.elements,
          cssExtra: template.cssExtra,
        }),
      });
      versiones.set(created._id, created.__v ?? 0);
      return { ...template, id: created._id, version: created.__v ?? 0, updatedAt: created.updatedAt };
    }
    const saved = await fetchJson(`/api/formatos/${template.id}`, {
      method: "PUT",
      body: JSON.stringify({
        nombre: template.name,
        tipoDocumento: template.tipoDocumento,
        version: versiones.get(template.id) ?? template.version,
        page: template.page,
        elements: template.elements,
        cssExtra: template.cssExtra,
      }),
    });
    versiones.set(template.id, saved.__v ?? 0);
    return { ...template, version: saved.__v ?? 0, updatedAt: saved.updatedAt };
  } catch (err) {
    console.error("[formatos] Guardado fallido:", err.message);
    let copiaLocal = false;
    try {
      const all = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      const idx = all.findIndex((t) => t.id === template.id);
      if (idx >= 0) all[idx] = template;
      else all.push(template);
      localStorage.setItem(LS_KEY, JSON.stringify(all));
      copiaLocal = true;
    } catch {}
    throw new Error(`No guardado en el servidor: ${err.message}. ${copiaLocal ? "Se conserva una copia en este navegador; no está publicada." : "Tampoco se pudo guardar una copia local. No cierres esta pantalla y exporta el formato."}`);
  }
}

export async function deleteTemplateRemote(id) {
  await colasGuardado.get(id)?.catch(() => {});
  await fetchJson(`/api/formatos/${id}`, { method: "DELETE" });
  versiones.delete(id);
}

export async function duplicateTemplateRemote(id) {
  const created = await fetchJson(`/api/formatos/${id}/duplicar`, { method: "POST" });
  return {
    id: created._id,
    tipoDocumento: created.tipoDocumento,
    name: created.nombre,
    porDefecto: created.porDefecto,
    page: created.page,
    elements: created.elements,
    cssExtra: created.cssExtra,
  };
}

export async function setDefaultTemplateRemote(id) {
  await fetchJson(`/api/formatos/${id}/predeterminar`, { method: "POST" });
}

export function exportTemplate(t) {
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${t.name.replace(/[^\wáéíóúñü -]/gi, "").trim() || "formato"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportedTemplate(json) {
  try {
    const obj = JSON.parse(json);
    if (!obj || !Array.isArray(obj.elements) || !obj.page) return null;
    return obj;
  } catch {
    return null;
  }
}

export async function importTemplateRemote(obj) {
  const t = {
    tipoDocumento: obj.tipoDocumento || "generico",
    nombre: obj.name || obj.nombre || "Plantilla importada",
    page: obj.page,
    elements: obj.elements,
    cssExtra: obj.cssExtra,
  };
  const created = await fetchJson("/api/formatos/importar", {
    method: "POST",
    body: JSON.stringify(t),
  });
  return mapDoc(created);
}

const mapDoc = (created) => ({
  id: created._id,
  tipoDocumento: created.tipoDocumento,
  name: created.nombre,
  porDefecto: created.porDefecto,
  page: created.page,
  elements: created.elements,
  cssExtra: created.cssExtra,
});

export async function createBuiltinTemplateRemote(builtinName) {
  const builder = BUILTIN_MAP[builtinName];
  if (!builder) throw new Error(`Plantilla prediseñada no encontrada: ${builtinName}`);
  const t = builder();
  const created = await fetchJson("/api/formatos", {
    method: "POST",
    body: JSON.stringify({
      tipoDocumento: t.tipoDocumento,
      nombre: t.name,
      page: t.page,
      elements: t.elements,
      cssExtra: t.cssExtra,
    }),
  });
  return mapDoc(created);
}

export async function resetTemplateToBuiltinRemote(id, builtinName) {
  const builder = BUILTIN_MAP[builtinName];
  if (!builder) throw new Error(`Plantilla prediseñada no encontrada: ${builtinName}`);
  // Se borra la plantilla actual para evitar acumular versiones rotas.
  await fetchJson(`/api/formatos/${id}`, { method: "DELETE" });
  const t = builder();
  const created = await fetchJson("/api/formatos", {
    method: "POST",
    body: JSON.stringify({
      tipoDocumento: t.tipoDocumento,
      nombre: t.name,
      page: t.page,
      elements: t.elements,
      cssExtra: t.cssExtra,
    }),
  });
  // La nueva pasa a ser la predeterminada de su tipo.
  await fetchJson(`/api/formatos/${created._id}/predeterminar`, { method: "POST" });
  return mapDoc(created);
}

export async function loadTiposDocumento() {
  return fetchJson("/api/formatos/tipos");
}
