// El título de la página vive en la barra superior negra (vía portal) y el
// contenido fluye en bloque ocupando todo el ancho disponible.
import { useContext } from "react";
import { createPortal } from "react-dom";
import { CabeceraContext } from "./Layout.jsx";

export default function CabeceraPagina({ titulo, descripcion, contador, children }) {
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
          {descripcion && (
            <p className="text-[0.75rem] text-slate-500 mt-1 truncate max-w-[360px]">{descripcion}</p>
          )}
        </>,
        slotTitulo
      )}
      {children && <div className="no-print w-full">{children}</div>}
    </>
  );
}
