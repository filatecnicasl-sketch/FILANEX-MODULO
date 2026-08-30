import { chromium } from "playwright";

let browser = null;
let browserPromise = null;
let pages = [];

export async function getBrowser() {
  if (browser) return browser;
  if (browserPromise) return browserPromise;
  browserPromise = chromium.launch({ headless: true });
  browser = await browserPromise;
  browserPromise = null;
  browser.on("disconnected", () => {
    browser = null;
    pages = [];
  });
  return browser;
}

async function getPage() {
  const b = await getBrowser();
  if (pages.length > 0) return pages.pop();
  return b.newPage();
}

function releasePage(page) {
  try {
    page.setViewportSize({ width: 1, height: 1 }).catch(() => {});
  } catch {}
  pages.push(page);
}

/**
 * Renderiza HTML/CSS estático a PDF. pageSize/orientation se pasan a @page.
 * Devuelve un Buffer.
 */
export async function renderPdf({ html, css = "", pageSize = "A4", pageOrientation = "portrait" }) {
  const b = await getBrowser();
  const page = await getPage();
  try {
    const fullHtml = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: ${pageSize} ${pageOrientation}; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; color: #111; background: #fff; }
    ${css}
  </style>
</head>
<body>${html}</body>
<script>
  // Auto-ajuste: si un texto no cabe en su caja, reduce la fuente hasta que
  // quepa en vez de solaparse con el elemento de debajo (nombres y
  // direcciones largas en la cabecera de los documentos).
  document.querySelectorAll("[data-fit]").forEach((n) => {
    const base = parseFloat(n.style.fontSize);
    if (!base) return;
    let f = 1;
    while (f > 0.55 && n.scrollHeight > n.clientHeight + 1) {
      f -= 0.05;
      n.style.fontSize = (base * f).toFixed(2) + "pt";
    }
  });
</script>
</html>`;

    await page.setContent(fullHtml, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: pageSize,
      landscape: pageOrientation === "landscape",
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1,
    });
    return Buffer.from(pdf);
  } finally {
    releasePage(page);
  }
}

export async function cerrarPoolPdf() {
  if (browser) {
    await browser.close();
    browser = null;
    pages = [];
  }
}
