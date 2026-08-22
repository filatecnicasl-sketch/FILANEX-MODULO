import { pageDimensions } from "./types.js";
import { ElementContent } from "./ElementContent.jsx";

/**
 * Hoja oculta en pantalla que se renderiza a tamaño real (mm) solo al imprimir.
 * window.print() la convierte en papel o PDF desde el navegador.
 */
export function PrintSheet({ template, formData, signatures }) {
  const { w, h } = pageDimensions(template.page);
  const cssSize =
    template.page.orientation === "landscape" ? `${template.page.size} landscape` : template.page.size;

  return (
    <>
      <style>{`
        @media print {
          @page { size: ${cssSize}; margin: 0; }
          body { margin: 0 !important; }
        }
      `}</style>
      <div className="print-sheet">
        <div style={{ position: "relative", width: `${w}mm`, height: `${h}mm`, background: "#fff", overflow: "hidden" }}>
          {template.elements.map((el) => (
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
      </div>
    </>
  );
}
