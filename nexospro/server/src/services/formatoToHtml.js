import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIME_IMG = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp" };

/**
 * Chromium renderiza el HTML en memoria, así que una ruta relativa como
 * /uploads/... no se puede resolver. Se incrusta la imagen en base64.
 */
export function imagenComoDataUri(url) {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const rel = url.replace(/^\/+/, "");
  const abs = path.join(process.cwd(), rel);
  try {
    const buf = fs.readFileSync(abs);
    const mime = MIME_IMG[path.extname(abs).toLowerCase()] ?? "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

function mm(n) {
  return `${Number(n ?? 0).toFixed(2)}mm`;
}

/**
 * Sustituye los marcadores {{clave}} de un texto por el dato correspondiente.
 * Si la clave no existe en los datos, el marcador se elimina para no imprimir
 * llaves en el documento final.
 */
function sustituir(texto, formData) {
  return String(texto ?? "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, clave) => {
    const val = formData[clave];
    return val == null ? "" : String(val);
  });
}

function renderElement(el, formData, signatures, opts) {
  const style = `position:absolute;left:${mm(el.x)};top:${mm(el.y)};width:${mm(el.w)};height:${mm(el.h)};`;
  const common = `font-size:${el.fontSize ?? 9}pt;color:${el.color || "#000000"};text-align:${el.align || "left"};`;
  const box = el.boxed ? `border:0.4mm solid ${el.borderColor || "#999"};padding:1.5mm;border-radius:1mm;` : "";

  switch (el.type) {
    case "text":
      // data-fit: un script de la página reduce la fuente si el texto no cabe
      // en su caja, para que no se solape con el elemento de debajo.
      return `<div data-fit="1" style="${style}${common}${el.bold ? "font-weight:700;" : ""}line-height:1.15;white-space:pre-wrap;overflow:hidden;">${esc(sustituir(el.text, formData))}</div>`;

    case "field": {
      const val = formData[el.fieldKey] ?? "";
      return `<div style="${style}${common}${box}display:flex;align-items:center;">${esc(val)}</div>`;
    }

    case "textarea": {
      const val = formData[el.fieldKey] ?? "";
      return `<div style="${style}${common}${box}overflow:hidden;">${esc(val).replace(/\n/g, "<br>")}</div>`;
    }

    case "checkbox": {
      const checked = formData[el.fieldKey];
      return `<div style="${style}${common}display:flex;align-items:center;gap:1mm;">
        <span style="display:inline-block;width:3.5mm;height:3.5mm;border:0.4mm solid #333;${checked ? "background:#111;" : ""}"></span>
        ${esc(el.label)}
      </div>`;
    }

    case "image": {
      let src = el.src;
      if (src === "{{empresa.logo}}") src = opts.logoUrl || "";
      src = imagenComoDataUri(src);
      if (!src) return "";
      return `<img src="${src}" style="${style}object-fit:contain;" alt="" />`;
    }

    case "rect": {
      return `<div style="${style}border:${el.borderWidth ?? 1}px solid ${el.borderColor || "#000"};background:${el.background || "transparent"};"></div>`;
    }

    case "signature": {
      const sig = signatures[el.id];
      return `<div style="${style}${box}">
        ${sig ? `<img src="${esc(sig)}" style="width:100%;height:100%;object-fit:contain;" alt="Firma" />` : ""}
        ${el.label ? `<div style="position:absolute;bottom:0;left:0;font-size:6pt;color:#555;">${esc(el.label)}</div>` : ""}
      </div>`;
    }

    case "table": {
      return renderTable(el, formData);
    }

    default:
      return "";
  }
}

// Correspondencia entre el título de la columna en la plantilla y la clave de
// la línea del documento, para poder volcar las líneas reales en la tabla.
const CLAVES_COLUMNA = {
  concepto: "concepto",
  descripcion: "concepto",
  "descripción": "concepto",
  detalle: "concepto",
  tipo: "tipo",
  cant: "cantidad",
  cantidad: "cantidad",
  uds: "cantidad",
  precio: "precio",
  "p unit": "precio",
  importe: "importe",
  total: "importe",
  dto: "dto",
  descuento: "dto",
  iva: "iva",
  "mano de obra": "manoObra",
  material: "material",
  materiales: "material",
};

function claveColumna(col, indice) {
  if (col.key) return col.key;
  const t = String(col.title ?? "")
    .toLowerCase()
    .replace(/[.:%]/g, "")
    .trim();
  return CLAVES_COLUMNA[t] ?? `col${indice}`;
}

function renderTable(el, formData) {
  const cols = el.columns ?? [];
  const rows = el.rows ?? 1;
  const lineas = Array.isArray(formData.lineas) ? formData.lineas : null;
  let html = `<div style="position:absolute;left:${mm(el.x)};top:${mm(el.y)};width:${mm(el.w)};height:${mm(el.h)};">`;
  html += `<div style="font-size:${el.headerFontSize ?? 7}pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5pt;margin-bottom:1mm;">${esc(el.groupTitle)}</div>`;
  html += `<table style="width:100%;border-collapse:collapse;font-size:7.5pt;table-layout:fixed;">`;
  html += `<colgroup>`;
  if (el.showRowNumbers) html += `<col style="width:6%">`;
  for (const c of cols) html += `<col style="width:${((c.width ?? 1 / cols.length) * 100).toFixed(1)}%">`;
  html += `</colgroup>`;
  const claves = cols.map((c, i) => claveColumna(c, i));
  const alineacion = claves.map((k) =>
    ["cantidad", "precio", "importe", "iva", "dto", "manoObra", "material"].includes(k) ? "right" : "left",
  );
  html += `<thead><tr>`;
  if (el.showRowNumbers) html += `<th style="border-bottom:0.7mm solid #333;padding:1mm;text-align:left;">Nº</th>`;
  for (let c = 0; c < cols.length; c++) {
    html += `<th style="border-bottom:0.7mm solid #333;padding:1mm;text-align:${alineacion[c]};">${esc(cols[c].title)}</th>`;
  }
  html += `</tr></thead><tbody>`;
  // Con líneas reales del documento se pintan solo esas filas; si no, se
  // respetan las filas en blanco de la plantilla (hojas para rellenar a mano).
  const total = lineas ? Math.max(lineas.length, 1) : rows;
  for (let r = 0; r < total; r++) {
    html += `<tr style="border-bottom:0.3mm solid #ddd;">`;
    if (el.showRowNumbers) html += `<td style="padding:1mm;">${lineas && r >= lineas.length ? "" : r + 1}</td>`;
    for (let c = 0; c < cols.length; c++) {
      const val = lineas
        ? (lineas[r]?.[claves[c]] ?? "")
        : (formData[`tbl_${el.id}_${r}_${c}`] ?? "");
      html += `<td style="padding:1mm;text-align:${alineacion[c]};word-wrap:break-word;">${esc(val)}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table></div>`;
  return html;
}

/**
 * Convierte una plantilla del editor + datos en HTML/CSS listo para renderPdf.
 */
export function formatoToHtml(template, formData, signatures = {}, opts = {}) {
  const { w, h } = pageDimensions(template.page);
  const elementsHtml = template.elements.map((el) => renderElement(el, formData, signatures, opts)).join("\n");

  const css = `
    .hoja-pdf { position: relative; width: ${mm(w)}; height: ${mm(h)}; overflow: hidden; background: #fff; }
    ${template.cssExtra || ""}
  `;

  return {
    html: `<div class="hoja-pdf">${elementsHtml}</div>`,
    css,
    pageSize: template.page.size,
    pageOrientation: template.page.orientation,
  };
}

/**
 * Vuelca las líneas del documento en las celdas de la primera tabla de la
 * plantilla (claves tbl_<idTabla>_<fila>_<columna>). Se usa para la impresión
 * rápida en el navegador, que dibuja la tabla celda a celda.
 */
export function expandirLineasEnCeldas(template, formData) {
  const lineas = Array.isArray(formData.lineas) ? formData.lineas : null;
  if (!lineas) return formData;
  const tabla = (template.elements ?? []).find((el) => el.type === "table");
  if (!tabla) return formData;

  const claves = (tabla.columns ?? []).map((c, i) => claveColumna(c, i));
  const datos = { ...formData };
  lineas.forEach((linea, r) => {
    claves.forEach((clave, c) => {
      const val = linea[clave];
      if (val != null && val !== "") datos[`tbl_${tabla.id}_${r}_${c}`] = String(val);
    });
  });
  return datos;
}

/**
 * Prepara la plantilla para la impresión rápida en el navegador: sustituye
 * los marcadores {{clave}} de los textos y cambia el logo simbólico por la
 * URL real de la empresa. Devuelve una copia; la plantilla original no se toca.
 */
export function resolverPlantillaParaImpresion(template, formData, logoUrl = "") {
  return {
    ...template,
    elements: (template.elements ?? []).map((el) => {
      if (el.type === "text") return { ...el, text: sustituir(el.text, formData) };
      if (el.type === "image" && el.src === "{{empresa.logo}}") return { ...el, src: logoUrl || "" };
      return el;
    }),
  };
}

export function pageDimensions(page) {
  const sizes = {
    A4: { w: 210, h: 297 },
    A5: { w: 148, h: 210 },
    A3: { w: 297, h: 420 },
    Letter: { w: 216, h: 279 },
  };
  const base = sizes[page?.size] ?? sizes.A4;
  return page?.orientation === "landscape" ? { w: base.h, h: base.w } : base;
}
