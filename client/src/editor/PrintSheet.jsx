import { pageDimensions } from "./types.js";
import { ElementContent } from "./ElementContent.jsx";

/**
 * Hoja oculta en pantalla que se renderiza a tamaño real (mm) solo al imprimir.
 * window.print() la convierte en papel o PDF desde el navegador.
 * Acepta varias páginas (copias) que salen una por hoja con salto de página.
 */
export function PrintSheet({ template, paginas, formData, signatures }) {
  const lista = paginas ?? [template];
  const { w, h } = pageDimensions(lista[0].page);
  const cssSize =
    lista[0].page.orientation === "landscape" ? `${lista[0].page.size} landscape` : lista[0].page.size;

  return (
    <>
      <style>{`
        @media print {
          @page { size: ${cssSize}; margin: 0; }
          body { margin: 0 !important; }
        }
      `}</style>
      <div className="print-sheet">
        {lista.map((t, i) => (
          <div
            key={t.id ?? i}
            style={{
              position: "relative",
              width: `${w}mm`,
              height: `${h}mm`,
              background: "#fff",
              overflow: "hidden",
              pageBreakAfter: i < lista.length - 1 ? "always" : "auto",
              breakAfter: i < lista.length - 1 ? "page" : "auto",
            }}
          >
            {t.elements.map((el) => (
              <div
                key={el.id}
                style={{
                  position: "absolute",
                  left: `${el.x}mm`,
                  top: `${el.y}mm`,
                  width: `${el.w}mm`,
                  height: `${el.h}mm`,
                }}
              >
                <ElementContent
                  el={el}
                  variant="print"
                  zoom={1}
                  formData={formData}
                  signatures={signatures}
                  onFormValue={() => undefined}
                  onSignature={() => undefined}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
