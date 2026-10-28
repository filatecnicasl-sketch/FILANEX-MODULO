import { createRoot } from "react-dom/client";
import { PrintSheet } from "../editor/PrintSheet.jsx";
import { urlApiConSesion } from "../lib/sesion.js";

/**
 * Imprime una plantilla del editor de formatos (Sistema → Formatos) rellena
 * con datos reales. Monta la hoja a tamaño real en la propia página (oculta
 * en pantalla, visible al imprimir gracias a .print-sheet), esconde la app
 * con .no-print y lanza window.print() — sin ventanas emergentes, así no
 * hay bloqueos de popup. Al terminar o cancelar se desmonta todo.
 */
export async function imprimirFormato(template, formData, signatures = {}) {
  // El elemento «Logo empresa» (src = {{empresa.logo}}) se resuelve aquí con
  // el logo que la empresa tenga subido en Ajustes → Configuración. Si no hay
  // logo, el hueco sale vacío (sin la caja gris de muestra del editor).
  let paginas = Array.isArray(template) ? template : [template];
  const usaLogo = paginas.some((t) =>
    t.elements?.some((e) => e.type === "image" && e.src === "{{empresa.logo}}")
  );
  if (usaLogo) {
    const logoUrl = await fetch("/api/empresa")
      .then((r) => (r.ok ? r.json() : {}))
      .then((e) => e?.logoUrl ?? "")
      .catch(() => "");
    // Los archivos subidos exigen sesión (?sesion=) desde el endurecimiento
    // de seguridad: sin ella el <img> del logo devolvería 401 y saldría vacío.
    const logoSrc = logoUrl ? urlApiConSesion(logoUrl) : "";
    paginas = paginas.map((t) => ({
      ...t,
      elements: t.elements.map((e) =>
        e.type === "image" && e.src === "{{empresa.logo}}" ? { ...e, src: logoSrc } : e
      ),
    }));
  }
  const cont = document.createElement("div");
  document.body.appendChild(cont);
  const root = createRoot(cont);
  // Varias plantillas = varias copias (una hoja cada una, con salto de página).
  root.render(<PrintSheet paginas={paginas} formData={formData} signatures={signatures} />);

  const app = document.getElementById("root");
  app?.classList.add("no-print");

  let limpiado = false;
  const limpiar = () => {
    if (limpiado) return;
    limpiado = true;
    app?.classList.remove("no-print");
    window.removeEventListener("afterprint", limpiar);
    setTimeout(() => {
      root.unmount();
      cont.remove();
    }, 50);
  };
  window.addEventListener("afterprint", limpiar);

  // Espera a que todas las imágenes de la hoja (logo de la empresa, siluetas,
  // fotos, rúbricas) terminen de cargar. Sin esto, el diálogo de impresión se
  // abre con el logo todavía descargándose y sale en blanco.
  const esperarImagenes = () =>
    new Promise((resolver) => {
      const pendientes = Array.from(cont.querySelectorAll("img")).filter((i) => !i.complete);
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
      // Tope de seguridad: no retener la impresión más de 5 segundos.
      setTimeout(resolver, 5000);
    });

  // Da tiempo a React a pintar la hoja antes de abrir la vista de impresión.
  // Se espera además a la fuente y a las imágenes: si no, los textos se miden
  // con la fuente de reserva y el auto-ajuste no reduce lo que hace falta,
  // y el logo puede aparecer sin cargar.
  const abrirImpresion = () => setTimeout(() => window.print(), 120);
  const todoListo = new Promise((r) => setTimeout(r, 80)).then(esperarImagenes);
  if (document.fonts?.ready) {
    Promise.all([document.fonts.ready, todoListo]).then(abrirImpresion).catch(abrirImpresion);
  } else {
    todoListo.then(abrirImpresion).catch(abrirImpresion);
  }
  // Red de seguridad por si afterprint no dispara (cierres raros del diálogo).
  setTimeout(limpiar, 120000);
}
