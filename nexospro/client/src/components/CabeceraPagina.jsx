// El título de la página vive en la barra superior negra (vía portal) y los
// botones de acción se dibujan dentro del contenido, flotados a la derecha,
// en el hueco que queda junto al buscador. Las páginas la usan igual que antes.
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
      {children && (
        <div className="no-print float-right flex items-center gap-2 flex-wrap justify-end ml-3 mb-3">
          {children}
        </div>
      )}
    </>
  );
}
