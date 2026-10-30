import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { PrintSheet } from "../editor/PrintSheet.jsx";
import { urlApiConSesion } from "../lib/sesion.js";

/**
 * Imprime una plantilla del editor de formatos (Sistema → Formatos) rellena
 * con datos reales. La monta en un iframe con un documento aislado para que
 * el navegador imprima solo la plantilla, nunca la pantalla de la aplicación.
 */
export async function imprimirFormato(template, formData, signatures = {}) {
  // Resolver el logo de empresa antes de montar la hoja imprimible.
  let paginas = Array.isArray(template) ? template : [template];
  const usaLogo = paginas.some((t) =>
    t.elements?.some((e) => e.type === "image" && e.src === "{{empresa.logo}}")
  );
  if (usaLogo) {
    const logoUrl = await fetch("/api/empresa")
      .then((r) => (r.ok ? r.json() : {}))
      .then((e) => e?.logoUrl ?? "")
      .catch(() => "");
    const logoSrc = logoUrl ? urlApiConSesion(logoUrl) : "";
    paginas = paginas.map((t) => ({
      ...t,
      elements: t.elements.map((e) =>
        e.type === "image" && e.src === "{{empresa.logo}}" ? { ...e, src: logoSrc } : e
      ),
    }));
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.cssText = "position:fixed;width:210mm;height:297mm;border:0;left:-10000px;top:0";
  document.body.appendChild(iframe);

  const printWindow = iframe.contentWindow;
  const printDocument = iframe.contentDocument;
  printDocument.open();
  printDocument.write("<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
  printDocument.close();

  // Mantener tipografía y estilos de la aplicación dentro del documento
  // aislado; los demás elementos del #root no se copian.
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
  const stylesheetLoads = [];
  styles.forEach((source) => {
    const clone = source.cloneNode(true);
    if (clone.tagName === "LINK" && !clone.sheet) {
      stylesheetLoads.push(new Promise((resolve) => {
        clone.addEventListener("load", resolve, { once: true });
        clone.addEventListener("error", resolve, { once: true });
        setTimeout(resolve, 5000);
      }));
    }
    printDocument.head.appendChild(clone);
  });

  const cont = printDocument.createElement("div");
  printDocument.body.appendChild(cont);
  const root = createRoot(cont);
  flushSync(() => {
    root.render(<PrintSheet paginas={paginas} formData={formData} signatures={signatures} />);
  });

  let limpiado = false;
  let timeoutId;
  const limpiar = () => {
    if (limpiado) return;
    limpiado = true;
    clearTimeout(timeoutId);
    printWindow.removeEventListener("afterprint", limpiar);
    window.removeEventListener("afterprint", limpiar);
    root.unmount();
    iframe.remove();
  };
  printWindow.addEventListener("afterprint", limpiar);
  window.addEventListener("afterprint", limpiar);

  const esperarImagenes = () =>
    new Promise((resolver) => {
      const pendientes = Array.from(printDocument.querySelectorAll("img")).filter((i) => !i.complete);
      if (pendientes.length === 0) return resolver();
      let restantes = pendientes.length;
      const listo = () => {
        restantes -= 1;
        if (restantes <= 0) resolver();
      };
      pendientes.forEach((i) => {
        i.addEventListener("load", listo, { once: true });
        i.addEventListener("error", listo, { once: true });
      });
      setTimeout(resolver, 5000);
    });

  await Promise.all([
    printDocument.fonts?.ready ?? Promise.resolve(),
    esperarImagenes(),
    ...stylesheetLoads,
  ]).catch(() => {});
  printWindow.focus();
  timeoutId = setTimeout(limpiar, 120000);
  printWindow.print();
}
