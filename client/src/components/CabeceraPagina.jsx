// El título de la página vive en la barra superior negra (vía portal) y el
// contenido fluye en bloque ocupando todo el ancho disponible. El subtítulo
// bajo el título se retiró: el nombre de la empresa y el título bastan.
import { useContext } from "react";
import { createPortal } from "react-dom";
import { CabeceraContext } from "./Layout.jsx";

export default function CabeceraPagina({ titulo, contador, children }) {
  const { slotTitulo } = useContext(CabeceraContext);
  if (!slotTitulo) return null; // páginas sin barra (editor de formatos)

  const textoContador =
    contador == null || contador === ""
      ? null
      : typeof contador === "number"
        ? `${contador} registros`
        : String(contador);

  return (
    <>
      {createPortal(
        <>
          <h1 className="text-[1.1875rem] font-bold text-white tracking-tight leading-tight truncate">
            {titulo}
            {textoContador && (
              <span className="text-slate-400 font-medium"> · {textoContador}</span>
            )}
          </h1>
        </>,
        slotTitulo
      )}
      {children && <div className="no-print w-full">{children}</div>}
    </>
  );
}
