/**
 * Descarga el PDF de un documento generado en el servidor a partir de la
 * plantilla editable correspondiente.
 *
 * Se pide con fetch (no con un enlace directo) porque la navegación del
 * navegador no lleva la cabecera Authorization de la sesión: el servidor
 * respondería 401 y Chrome mostraría "El archivo no estaba disponible en el
 * sitio". El envoltorio global de fetch sí añade el token.
 */
export async function descargarPdf(tipo, id, numero = "") {
  const r = await fetch(`/api/documentos/${tipo}/${id}/pdf`);
  if (!r.ok) {
    let mensaje = `No se pudo generar el PDF (${r.status})`;
    try {
      const datos = await r.json();
      if (datos?.error) mensaje = datos.error;
    } catch {
      // respuesta sin JSON: se deja el mensaje genérico
    }
    alert(mensaje);
    return;
  }

  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${tipo}-${numero || id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se libera con retardo para no cortar la descarga en curso.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Abre el PDF en una pestaña nueva en vez de descargarlo. */
export async function verPdf(tipo, id) {
  const r = await fetch(`/api/documentos/${tipo}/${id}/pdf`);
  if (!r.ok) {
    alert(`No se pudo generar el PDF (${r.status})`);
    return;
  }
  const url = URL.createObjectURL(await r.blob());
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Impresión rápida: pide al servidor la plantilla y los datos del documento y
 * lo dibuja directamente en el navegador (window.print), igual que la hoja de
 * entrada de taller. Sin generar PDF, así sale al instante.
 */
export async function imprimirDocumentoRapido(tipo, id) {
  const r = await fetch(`/api/documentos/${tipo}/${id}/formato`);
  if (!r.ok) {
    let mensaje = `No se pudo preparar la impresión (${r.status})`;
    try {
      const datos = await r.json();
      if (datos?.error) mensaje = datos.error;
    } catch {
      // respuesta sin JSON
    }
    alert(mensaje);
    return;
  }
  const { plantilla, formData, signatures } = await r.json();
  const { imprimirFormato } = await import("./imprimir-formato.jsx");
  imprimirFormato(plantilla, formData, signatures ?? {});
}
