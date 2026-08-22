import { buildRecepcionVehiculo } from "./builtinTemplates.js";

const LS_KEY = "nexospro-formatos-v1";

export function loadTemplates() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // datos corruptos: se reinicia con la plantilla de fábrica
  }
  const seed = [buildRecepcionVehiculo()];
  saveTemplates(seed);
  return seed;
}

export function saveTemplates(templates) {
  localStorage.setItem(LS_KEY, JSON.stringify(templates));
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
