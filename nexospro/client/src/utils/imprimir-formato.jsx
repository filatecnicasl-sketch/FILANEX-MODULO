import { createRoot } from "react-dom/client";
import { PrintSheet } from "../editor/PrintSheet.jsx";

/**
 * Imprime una plantilla del editor de formatos (Sistema → Formatos) rellena
 * con datos reales. Monta la hoja a tamaño real en la propia página (oculta
 * en pantalla, visible al imprimir gracias a .print-sheet), esconde la app
 * con .no-print y lanza window.print() — sin ventanas emergentes, así no
 * hay bloqueos de popup. Al terminar o cancelar se desmonta todo.
 */
export function imprimirFormato(template, formData, signatures = {}) {
  const cont = document.createElement("div");
  document.body.appendChild(cont);
  const root = createRoot(cont);
  // Varias plantillas = varias copias (una hoja cada una, con salto de página).
  const paginas = Array.isArray(template) ? template : undefined;
  root.render(
    paginas ? (
      <PrintSheet paginas={paginas} formData={formData} signatures={signatures} />
    ) : (
      <PrintSheet template={template} formData={formData} signatures={signatures} />
    )
  );

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

  // Da tiempo a React a pintar la hoja antes de abrir la vista de impresión.
  setTimeout(() => window.print(), 80);
  // Red de seguridad por si afterprint no dispara (cierres raros del diálogo).
  setTimeout(limpiar, 120000);
}
