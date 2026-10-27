// Hace que la tecla Enter salte al siguiente campo del formulario,
// como si fuera Tab (costumbre muy extendida en entrada de datos).
// No afecta a botones, checkboxes ni áreas de texto.
//
// enterComoTab(e, contenedor?, alFinal?)
//  - contenedor: ref opcional que delimita los campos (por defecto el
//    form o .panel más cercano).
//  - alFinal: se ejecuta si Enter se pulsa en el último campo y ese campo
//    pertenece a una línea de documento (data-editor="linea") — se usa en
//    EditorLineas para añadir una línea nueva.
export function enterComoTab(e, contenedor, alFinal) {
  if (e.key !== "Enter") return;
  if (e.__enterTab) return; // ya gestionado por un contenedor interior
  const el = e.target;
  if (!(el instanceof HTMLElement)) return;
  // Los campos de línea del editor de documentos son textareas (la
  // descripción crece a varias líneas): Enter avanza igual que en los
  // INPUT, y Shift+Enter deja el salto de línea. El resto de textareas
  // (notas, mensajes…) conservan el comportamiento normal de Enter.
  const esCampoLinea = el.tagName === "TEXTAREA" && el.dataset.editor === "linea";
  if (!["INPUT", "SELECT"].includes(el.tagName) && !esCampoLinea) return;
  if (e.shiftKey) return; // Shift+Enter = salto de línea manual
  if (["submit", "button", "checkbox", "radio", "file"].includes(el.type)) return;

  e.preventDefault();
  e.__enterTab = true;
  const raiz = contenedor?.current ?? el.closest("form, .panel") ?? document;
  const campos = [...raiz.querySelectorAll("input, select, textarea")].filter(
    (c) =>
      !c.disabled &&
      !["checkbox", "radio", "file", "submit", "button"].includes(c.type) &&
      c.offsetParent !== null
  );
  const i = campos.indexOf(el);
  if (i === -1) return;
  const siguiente = campos[i + 1];
  if (siguiente) {
    siguiente.focus();
    siguiente.select?.();
  } else if (el.dataset.editor === "linea") {
    alFinal?.();
  } else {
    el.blur();
  }
}
