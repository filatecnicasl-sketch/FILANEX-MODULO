// La cabecera de página vive dentro de la barra superior negra: esta
// componente inserta ahí (vía portal) el título + contador + descripción
// y los botones de acción. Las páginas la usan igual que antes.
import { useContext } from "react";
import { createPortal } from "react-dom";
import { CabeceraContext } from "./Layout.jsx";

export default function CabeceraPagina({ titulo, descripcion, contador, children }) {
  const { slotTitulo, slotAcciones } = useContext(CabeceraContext);
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
          <h1 className="text-[19px] font-bold text-white tracking-tight leading-tight truncate">
            {titulo}
            {textoContador && (
              <span className="text-slate-400 font-medium"> · {textoContador}</span>
            )}
          </h1>
          {descripcion && (
            <p className="text-[12px] text-slate-500 mt-1 truncate max-w-[360px]">{descripcion}</p>
          )}
        </>,
        slotTitulo
      )}
      {children && slotAcciones && createPortal(children, slotAcciones)}
    </>
  );
}
