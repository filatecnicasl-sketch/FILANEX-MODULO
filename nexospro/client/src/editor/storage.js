import { BUILTIN_TEMPLATES } from "./builtinTemplates.js";

const LS_KEY = "nexospro-formatos-v1";
const LS_MIGRATED = "nexospro-formatos-migrated";

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
    return docs.map((d) => ({
      id: d._id,
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
      return { ...template, id: created._id };
    }
    await fetchJson(`/api/formatos/${template.id}`, {
      method: "PUT",
      body: JSON.stringify({
        nombre: template.name,
        page: template.page,
        elements: template.elements,
        cssExtra: template.cssExtra,
      }),
    });
    return template;
  } catch (err) {
    console.error("[formatos] Guardado fallido:", err.message);
    // Fallback offline.
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    const idx = all.findIndex((t) => t.id === template.id);
    if (idx >= 0) all[idx] = template;
    else all.push(template);
    localStorage.setItem(LS_KEY, JSON.stringify(all));
    return template;
  }
}

export async function deleteTemplateRemote(id) {
  try {
    await fetchJson(`/api/formatos/${id}`, { method: "DELETE" });
  } catch (err) {
    console.error("[formatos] Borrado remoto fallido:", err.message);
  }
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

export async function loadTiposDocumento() {
  return fetchJson("/api/formatos/tipos");
}
